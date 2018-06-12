import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input, Renderer2, NgZone, ViewEncapsulation } from '@angular/core';
import { PanZoomConfig } from './panzoom-config';
import { Point } from './panzoom-point';
import { PanZoomModel } from './panzoom-model';
import { PanZoomAPI } from './panzoom-api';
import { Rect } from './panzoom-rect';
declare var $: any;
declare var log;
// if (!log) { log = console; }

interface ZoomAnimation {
  deltaZoomLevel: number;
  translationFromZoom: Function;
  duration: number;
  progress: number;
}

interface Position {
  x?: number;
  y?: number;
  length?: number;
}

@Component( {
  // tslint:disable-next-line:component-selector
  selector: 'pan-zoom',
  // changeDetection: ChangeDetectionStrategy.OnPush,  // we don't want to kill change detection for all elements beneath this.  They can implement OnPush if they want to.  We can get away with this because the kwheel directive runs outside of Angular, so it won't trigger change detection.
  template: `
<div #frameElement class="pan-zoom-frame" (dblclick)="onDblClick($event)" (kwheel)="onMouseWheel($event)" (mousedown)="onMousedown($event)" style="position:relative; width: 100%; height: 100%; overflow: hidden;">
  <div #panElement class="panElement" style="position: absolute; left: 0px; top: 0px;">
    <div #zoomElement class="zoomElement">
      <ng-content></ng-content>
    </div>
  </div>
</div>
<div #panzoomOverlay style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; opacity: 0; display: none; pointer-events: none;"></div>
  `
} )

export class PanZoomComponent implements OnInit, AfterViewInit, OnDestroy {

  constructor ( private el: ElementRef,
                private renderer: Renderer2,
                private zone: NgZone ) {}

  @ViewChild('frameElement') private frameElementRef: ElementRef;
  @ViewChild('panElement') private panElementRef: ElementRef;
  @ViewChild('zoomElement') private zoomElementRef: ElementRef;
  @ViewChild('panzoomOverlay') private panzoomOverlayRef: ElementRef;

  @Input() private config: PanZoomConfig;

  private base: PanZoomModel; // this is what the pan/zoom view is before a zoom animation begins and after it ends.  It also updates with every mouse drag or freeZoom
  private model: PanZoomModel; // this is used for incremental changes to the pan/zoom view during each animation frame.  Setting it will update the pan/zoom coordinates on the next call to syncModelToDom()
  private api: PanZoomAPI;
  private viewportHeight: number;
  private viewportWidth: number;
  private lastMouseEventTime: number;
  private previousPosition: Position = null;
  private isDragging = false;
  private panVelocity: Point = null;
  private zoomAnimation: ZoomAnimation = null;
  private frameElement: JQuery;
  private animationFrame: Function; // reference to the appropriate getAnimationFrame function for the client browser
  private onMouseMoveRemoveFunc: Function;
  private onMouseUpRemoveFunc: Function;
  private onTouchEndRemoveFunc: Function;
  private onTouchMoveRemoveFunc: Function;
  private touchStartRemoveFunc: Function;
  private lastTick = 0;
  private isChrome = false;
  private willChangeNextFrame = false; // used for scaling in Chrome
  private animationId: number;
  private isMobile = false;
  private scale: number;
  private isFirstSync = true;
  private isZoomingToFit = false;
  private lastClickPoint: Point;

  private maxScale: number; // the highest scale that we will allow in free zoom mode (calculated)
  private minScale: number; // the smallest scale that we will allow in free zoom mode (calculated)



  ngOnInit(): void {
    // log.debug('PanZoomComponent: ngOnInit(): initializing PanZoomComponent');
    let frameStyle = this.frameElementRef.nativeElement.attributes.style.value;

    if (this.config.initialZoomToFit) {
      this.base = this.calcZoomToFit(this.config.initialZoomToFit);
    }
    else {
      this.base = {
        zoomLevel: this.config.initialZoomLevel,
        pan: {
          x: this.config.initialPanX,
          y: this.config.initialPanY
        }
      };
    }

    this.model = {
      zoomLevel: this.base.zoomLevel,
      isPanning: false,     // Only true if panning has actually taken place, not just after mousedown
      pan: {
        x: this.base.pan.x,
        y: this.base.pan.y
      }
    };

    // create public API
    this.api = {
      model: this.model,
      config: this.config,
      changeZoomLevel: this.changeZoomLevel.bind(this),
      zoomIn: this.zoomInToLastClickPoint.bind(this),
      zoomOut: this.zoomOutFromLastClickPoint.bind(this),
      zoomToFit: this.zoomToFit.bind(this),
      resetView: this.resetView.bind(this),
      getViewPosition: this.getViewPosition.bind(this),
      getModelPosition: this.getModelPosition.bind(this)
    };

    this.config.api.next(this.api);

    if (this.config.freeMouseWheel) {
      this.scale = this.getCssScale(this.config.initialZoomLevel);
      let maxZoomLevel = this.config.zoomLevels - 1;
      this.maxScale = this.getCssScale(maxZoomLevel);
      this.minScale = this.getCssScale(0);
    }

  }



  ngAfterViewInit(): void {
    // log.debug('PanZoomComponent: ngAfterViewInit()');

    this.frameElement = $('.pan-zoom-frame');
    this.viewportHeight = this.zoomElementRef.nativeElement.height;
    this.viewportWidth = this.zoomElementRef.nativeElement.width;

    if (navigator.userAgent.search('Chrome') >= 0) {
      this.isChrome = true;
      this.zoomElementRef.nativeElement.style.transform = 'translateZ(0)'; // translateZ hack for GPU acceleration
    }
    (<any>this.zoomElementRef.nativeElement.style).willChange = 'transform';

    this.zone.runOutsideAngular( () => this.animationFrame = window.requestAnimationFrame ||
                            (<any>window).webkitRequestAnimationFrame ||
                            (<any>window).mozRequestAnimationFrame ||
                            (<any>window).oRequestAnimationFrame ||
                            (<any>window).msRequestAnimationFrame );


    if (this.isMobileDevice()) {
      this.isMobile = true;
      this.touchStartRemoveFunc = this.zone.runOutsideAngular( () =>  this.renderer.listen(this.el.nativeElement, 'touchstart', (event: any) => this.onTouchStart(event) ) );
    }

    this.syncModelToDOM(); // this is needed to apply the initial pan / zoom view set in OnInit
    this.isFirstSync = false;
    if (this.config.freeMouseWheel) {
      // if we don't do this here,
      // freeZoom will be out of sync with the view
      // and will jump when we first spin the mouse wheel to zoom
      this.scale = this.getCssScale(this.base.zoomLevel);
    }

  }



  ngOnDestroy(): void {
    // log.debug('PanZoomComponent: ngOnDestroy()');
    if (this.touchStartRemoveFunc) {
      this.touchStartRemoveFunc();
    }
    if (this.animationFrame && this.animationId) {
      window.cancelAnimationFrame(this.animationId);
    }
  }



  //////////////////////////// END OF LIFECYCLE HOOKS ////////////////////////////


  private isMobileDevice(): boolean {
    return (typeof window.orientation !== 'undefined') || (navigator.userAgent.indexOf('IEMobile') !== -1);
  }







  ////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////////// EVENT HANDLERS /////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  public onMouseWheel(e: any): void {
    // log.debug('PanZoomComponent: OnMouseWheel() e:', e);

    let event = e.event;
    let deltaY = e.deltaY;

    if (this.config.zoomOnMouseWheel) {
      // event.preventDefault();

      if (this.zoomAnimation) {
        return; // already zooming
      }

      let sign = deltaY / Math.abs(deltaY);


      if (this.config.invertMouseWheel) {
        sign = -sign;
      }

      let clickPoint: Point = {
        x: event.originalEvent.pageX - this.frameElement.offset().left,
        y: event.originalEvent.pageY - this.frameElement.offset().top
      };

      this.lastClickPoint = clickPoint;

      // log.debug("clickPoint:", clickPoint);

      if (!this.config.freeMouseWheel) {
        if (sign < 0) {
          this.zoomIn(clickPoint);
        }
        else if (sign > 0) {
          this.zoomOut(clickPoint);
        }
      }
      else {
        // free wheel scroll
        this.freeZoom(clickPoint, deltaY);
      }
    }
  }



  public onDblClick(event: any) {
    // log.debug('PanZoomComponent: onDblClick()');
    if (this.config.zoomOnDoubleClick) {
      let clickPoint: Point = {
        x: event.pageX - this.frameElement.offset().left,
        y: event.pageY - this.frameElement.offset().top
      };
      this.lastClickPoint = clickPoint;
      this.zoomIn(clickPoint);
    }
  }



  public onMousedown(event: any) {
    // log.debug('PanZoomComponent: onMousedown()', event);

    if (event.button === 0 || event.type === 'touchstart') {
      if (this.config.panOnClickDrag) {
        this.previousPosition = {
          x: event.pageX,
          y: event.pageY
        };
        this.lastMouseEventTime = (new Date).getTime();
        this.isDragging = true;
        this.model.isPanning = false;

        if (!this.isMobile) {
          this.onMouseMoveRemoveFunc = this.zone.runOutsideAngular( () =>  this.renderer.listen('document', 'mousemove', (e: any) => this.onMouseMove(e) )); // leave this on document
          this.onMouseUpRemoveFunc = this.zone.runOutsideAngular( () => this.renderer.listen('document', 'mouseup', () => this.onMouseUp() )); // leave this on document
        }
        else {
          this.onTouchEndRemoveFunc = this.zone.runOutsideAngular( () => this.renderer.listen('document', 'touchend', (e: any) => this.onTouchEnd(e)));
          this.onTouchMoveRemoveFunc = this.zone.runOutsideAngular( () =>  this.renderer.listen('document', 'touchmove', (e: any) => this.onTouchMove(e)));
        }
      }

      return false;
    }
  }



  private onMouseMove(event: any) {
    // log.debug(`PanZoomComponent: onMouseMove()`);
    // Called when moving the mouse with the left button down

    // event.preventDefault();
    event.stopPropagation();

    // log.debug(`onMouseMove(): pageX: ${event.pageX} pageY: ${event.pageY}`);
    // log.debug(`onMouseMove(): base.pan.x: ${this.base.pan.x} base.pan.y: ${this.base.pan.y}`);

    let now = (new Date).getTime();
    let timeSinceLastMouseEvent = (now - this.lastMouseEventTime) / 1000;
    this.lastMouseEventTime = now;
    let dragDelta = {
      // a representation of how far each coordinate has moved since the last time it was moved
      x: event.pageX - this.previousPosition.x,
      y: event.pageY - this.previousPosition.y
    };

    if (this.config.keepInBounds) {
      let topLeftCornerView = this.getViewPosition( { x: 0, y: 0 } );
      let bottomRightCornerView = this.getViewPosition( { x: this.viewportWidth, y: this.viewportHeight } );

      if (topLeftCornerView.x > 0 && dragDelta.x > 0) {
        dragDelta.x *= Math.min(Math.pow(topLeftCornerView.x, -this.config.keepInBoundsDragPullback), 1);
      }

      if (topLeftCornerView.y > 0 && dragDelta.y > 0) {
        dragDelta.y *= Math.min(Math.pow(topLeftCornerView.y, -this.config.keepInBoundsDragPullback), 1);
      }

      if (bottomRightCornerView.x < this.viewportWidth && dragDelta.x < 0) {
        dragDelta.x *= Math.min(Math.pow(this.viewportWidth - bottomRightCornerView.x, -this.config.keepInBoundsDragPullback), 1);
      }

      if (bottomRightCornerView.y < this.viewportHeight && dragDelta.y < 0) {
        dragDelta.y *= Math.min(Math.pow(this.viewportHeight - bottomRightCornerView.y, -this.config.keepInBoundsDragPullback), 1);
      }
    }

    this.pan(dragDelta);
    this.zone.runOutsideAngular( () => this.animationId = this.animationFrame(this.animationTick) );

    if (!this.model.isPanning) {
      // This will improve the performance,
      // because the browser stops evaluating hits against the elements displayed inside the pan zoom view.
      // Besides this, mouse events will not be sent to any other elements,
      // this prevents issues like selecting elements while dragging.
      this.panzoomOverlayRef.nativeElement.style.display = 'block';
    }

    this.model.isPanning = true;

    // set these for the animation slow down once drag stops
    this.panVelocity = {
      x: dragDelta.x / timeSinceLastMouseEvent,
      y: dragDelta.y / timeSinceLastMouseEvent
    };

    this.previousPosition = {
      x: event.pageX,
      y: event.pageY
    };

  }



  private onMouseUp() {
    // log.debug('PanZoomComponent: onMouseup()');

    let now = (new Date).getTime();
    let timeSinceLastMouseEvent = (now - this.lastMouseEventTime) / 1000;

    if (this.panVelocity) {
      // apply strong initial dampening if the mouse up occured much later than
      // the last mouse move, indicating that the mouse hasn't moved recently
      // TBD experiment with this formula
      let initialMultiplier = Math.max(0, <number>Math.pow(timeSinceLastMouseEvent + 1, -4) - 0.2);

      this.panVelocity.x *= initialMultiplier;
      this.panVelocity.y *= initialMultiplier;
    }

    this.isDragging = false;
    this.model.isPanning = false;

    if (!this.isMobile) {
      this.onMouseMoveRemoveFunc();
      this.onMouseUpRemoveFunc();
    }
    else {
      this.onTouchEndRemoveFunc();
      this.onTouchMoveRemoveFunc();
    }

    // Set the overlay to non-blocking again:
    this.panzoomOverlayRef.nativeElement.style.display = 'none';
  }



  private onTouchStart(event: any) {
    // log.debug('PanZoomComponent: onTouchStart()', event);
    // event.preventDefault();

    if (event.touches.length === 1) {
      // single touch, get ready for panning
      this.onMousedown(event);
    }
    else {
      // multiple touches, get ready for zooming

      // Calculate x and y distance between touch events
      let x = event.touches[0].pageX - event.touches[1].pageX;
      let y = event.touches[0].pageY - event.touches[1].pageY;

      // Calculate length between touch points with pythagoras
      // There is no reason to use Math.pow and Math.sqrt as we
      // only want a relative length and not the exact one.
      this.previousPosition = {
        length: x * x + y * y
      };
    }
  }



  private onTouchMove(event: any) {
    // log.debug('PanZoomComponent: onTouchMove()');
    // event.preventDefault();

    if (event.touches.length === 1) {
      // single touch, emulate mouse move
      this.onMouseMove(event);
    }
    else {
      // multiple touches, zoom in/out

      // Calculate x and y distance between touch events
      let x = event.touches[0].pageX - event.touches[1].pageX;
      let y = event.touches[0].pageY - event.touches[1].pageY;
      // Calculate length between touch points with pythagoras
      // There is no reason to use Math.pow and Math.sqrt as we
      // only want a relative length and not the exact one.
      let length = x * x + y * y;

      // Calculate delta between current position and last position
      let delta = length - this.previousPosition.length;

      // Naive hysteresis
      if (Math.abs(delta) < 100) {
        return;
      }

      // Calculate center between touch points
      let centerX = event.touches[1].pageX + x / 2;
      let centerY = event.touches[1].pageY + y / 2;

      // Calculate zoom center
      let clickPoint = {
        x: centerX - this.frameElement.offset().left,
        y: centerY - this.frameElement.offset().top
      };
      this.lastClickPoint = clickPoint;

      this.changeZoomLevel( this.base.zoomLevel + delta * 0.0001, clickPoint);

      // Update length for next move event
      this.previousPosition = {
        length: length
      };
    }
  }



  private onTouchEnd(event: any) {
    // log.debug('PanZoomComponent: onTouchEnd()');
    this.onMouseUp();
  }



  private onMouseleave() {
    // log.debug('PanZoomComponent: onMouseleave()');
    this.onMouseUp(); // same behaviour
  }



  ////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////// END EVENT HANDLERS ///////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////







  private pan(delta: Point): void {
    // log.debug('PanZoomComponent: pan()');
    delta.x = delta.x || 0;
    delta.y = delta.y || 0;
    this.base.pan.x += delta.x;
    this.base.pan.y += delta.y;
    this.syncModelToDOM();
    // this.config.modelChanged.next(this.model);
  }



  private animationTick = (timestamp: any) => {
    // log.debug('PanZoomComponent: animationTick()');

    let deltaTime = (timestamp - this.lastTick) / 1000;

    this.lastTick = timestamp;

    if (this.zoomAnimation) {
      // when we're zooming
      // log.debug('PanZoomComponent: animationTick(): model is zooming');

      this.zoomAnimation.progress += Math.abs(deltaTime / this.zoomAnimation.duration);
      // log.debug('PanZoomComponent: animationTick(): zoomAnimation.progress:', this.zoomAnimation.progress);


      if (this.zoomAnimation.progress >= 1.0) {
        // when the zoom has finished, sync the base to the model.
        this.zoomAnimation.progress = 1.0;
        this.syncModelToDOM();
        this.base.zoomLevel = this.model.zoomLevel;
        this.base.pan.x = this.model.pan.x;
        this.base.pan.y = this.model.pan.y;
        this.zoomAnimation = null;
        this.config.modelChanged.next(this.model);
        if (this.config.freeMouseWheel) {
          this.scale = this.getCssScale(this.base.zoomLevel);
        }
      }
    }

    if (this.panVelocity && !this.isDragging) {
      // log.debug('got to 0.2');
      // this is when we've panned and released the mouse button and the view is "free-floating" until it slows to a stop
      // prevent overshooting if delta time is large for some reason. We apply the simple solution of
      // slicing delta time into smaller pieces and applying each one
      while (deltaTime > 0) {
        let dTime = Math.min(0.02, deltaTime);

        deltaTime = deltaTime - dTime;

        this.base.pan.x = this.panVelocity.x * dTime + this.base.pan.x;

        this.panVelocity.x = (1 - this.config.friction * dTime) * this.panVelocity.x;

        this.base.pan.y = this.panVelocity.y * dTime + this.base.pan.y;

        this.panVelocity.y = (1 - this.config.friction * dTime) * this.panVelocity.y;

        let speed = this.length(this.panVelocity);

        if (speed < this.config.haltSpeed) {
          this.panVelocity = null;
          this.config.modelChanged.next(this.base);
          break;
        }
      }
      // log.debug(`baseAfterDrag: x: ${this.base.pan.x} y: ${this.base.pan.y} zoomlevel: ${this.base.zoomLevel}` );
    }

    if (this.config.keepInBounds && !this.isDragging) {
      // log.debug('got to 0.3');
      let topLeftCornerView = this.getViewPosition({ x: 0, y: 0 });
      let bottomRightCornerView = this.getViewPosition({ x: this.viewportWidth, y: this.viewportHeight });

      if (topLeftCornerView.x > 0) {
        this.base.pan.x -= this.config.keepInBoundsRestoreForce * topLeftCornerView.x;
      }

      if (topLeftCornerView.y > 0) {
        this.base.pan.y -= this.config.keepInBoundsRestoreForce * topLeftCornerView.y;
      }

      if (bottomRightCornerView.x < this.viewportWidth) {
        this.base.pan.x -= this.config.keepInBoundsRestoreForce * (bottomRightCornerView.x - this.viewportWidth);
      }

      if (bottomRightCornerView.y < this.viewportHeight) {
        this.base.pan.y -= this.config.keepInBoundsRestoreForce * (bottomRightCornerView.y - this.viewportHeight);
      }
    }

    this.syncModelToDOM();

    if (this.isDragging) {
      this.config.modelChanged.next(this.base);
    }

    if ( this.animationFrame && ( this.zoomAnimation || this.panVelocity ) ) {
      // are we zooming or panning?  If so, do this...
      // console.log(`zoomAnimation: ${this.zoomAnimation}, panVelocity: ${this.panVelocity}`);

      if (this.isChrome && this.willChangeNextFrame && (this.zoomAnimation || this.isZoomingToFit)) {
        (<any>this.zoomElementRef.nativeElement.style).willChange = 'transform';
        this.willChangeNextFrame = false;
      }
      if (this.isChrome && !this.willChangeNextFrame && (this.zoomAnimation || this.isZoomingToFit)) {
        (<any>this.zoomElementRef.nativeElement.style).willChange = null;
        this.willChangeNextFrame = true;
      }

      this.animationFrame(this.animationTick); // Call the next animation frame
    }

  }



  private syncModelToDOM() {
    // log.debug('PanZoomComponent: syncModelToDOM()');
    // called by either the animationFrame animationTick() function or by the pan() function or by zoomToFit()
    // this does not get called by freeZoom(), which operates independently of animationTick() and syncModelToDOM()
    // log.debug('PanZoomComponent: syncModelToDOM(): base.pan', this.base.pan);
    // log.debug('PanZoomComponent: syncModelToDOM(): model.pan', this.model.pan);
    // log.debug('model.pan', this.model.pan);


    if (!this.zoomAnimation) {
      // Just panning.  No zoom
      // sync model to base
      this.model.zoomLevel = this.base.zoomLevel;
      this.model.pan.x = this.base.pan.x;
      this.model.pan.y = this.base.pan.y;
    }
    else {
      // we're zooming (but not freeZooming)
      this.model.zoomLevel = this.base.zoomLevel + this.zoomAnimation.deltaZoomLevel * this.zoomAnimation.progress; // calculate how far we need to zoom in or out for the current animationTick
      let deltaTranslation = this.zoomAnimation.translationFromZoom(this.model.zoomLevel); // calculate how far to pan the view to based on our translated coordinates
      // log.debug('PanZoomComponent: syncModelToDOM(): deltaTranslation:', deltaTranslation);
      // log.debug('deltaTranslation:', deltaTranslation);
      this.model.pan = {
        // sync the model pan coordinates to our translated pan coordinates
        // we do this by adding how far we want to move in each direction to our our existing base pan coordinates (where we started)
        x: this.base.pan.x + deltaTranslation.x,
        y: this.base.pan.y + deltaTranslation.y
      };

      if (this.config.keepInBounds && !this.isZoomingToFit) {
        let topLeftCornerView = this.getViewPosition({ x: 0, y: 0 });
        let bottomRightCornerView = this.getViewPosition({ x: this.viewportWidth, y: this.viewportHeight });

        if (topLeftCornerView.x > 0) {
          this.model.pan.x = 0;
        }

        if (topLeftCornerView.y > 0) {
          this.model.pan.y = 0;
        }

        if (bottomRightCornerView.x < this.viewportWidth) {
          this.model.pan.x -= (bottomRightCornerView.x - this.viewportWidth);
        }

        if (bottomRightCornerView.y < this.viewportHeight) {
          this.model.pan.y -= (bottomRightCornerView.y - this.viewportHeight);
        }
      }
    }

    /////////////////////////////////////////////
    //////////////// APPLY SCALING ////////////////
    /////////////////////////////////////////////
    if (this.zoomAnimation || this.isFirstSync) {
      let scale = this.getCssScale(this.model.zoomLevel);
      let scaleString = `scale3d(${scale},${scale},${scale})`;
      if (this.isChrome) {
        // Chrome scaling
        // For Chrome, use the zoom style by default, as it doesn't handle nested SVG very well when using transform
        if ( this.config.chromeUseTransform ) {
          // example: scale(0.8218728816747501)
          // example1: -webkit-transform: scale(0.8218728816747501)
          this.zoomElementRef.nativeElement.style.webkitTransformOrigin = '0 0';
          this.zoomElementRef.nativeElement.style.webkitTransform = scaleString;
        }
        else {
          // http://caniuse.com/#search=zoom
          this.zoomElementRef.nativeElement.style.zoom = scale.toString();
        }
      }
      else {
        // Not Chrome
        // http://caniuse.com/#search=transform

        // Firefox
        (<any>this.zoomElementRef.nativeElement.style).MozTransformOrigin = '0 0';
        (<any>this.zoomElementRef.nativeElement.style).MozTransform = scaleString;

        // Other webkit browsers: Safari etc...
        this.zoomElementRef.nativeElement.style.webkitTransformOrigin = '0 0';
        this.zoomElementRef.nativeElement.style.webkitTransform = scaleString;

        // IE 9.0
        // Special handling of IE, as it doesn't support the zoom style
        (<any>this.zoomElementRef.nativeElement.style).msTransformOrigin = '0 0';
        (<any>this.zoomElementRef.nativeElement.style).msTransform = scaleString;

        // IE > 9.0
        this.zoomElementRef.nativeElement.style.transformOrigin = '0 0';
        this.zoomElementRef.nativeElement.style.transform = scaleString;
      }
    }

    ////////////////////////////////////////////////////
    //////////////// APPLY PAN ANIMATION /////////////////
    ////////////////////////////////////////////////////
    if (this.config.useHardwareAcceleration) {
      let translate3d = `translate3d(${this.model.pan.x}px, ${this.model.pan.y}px, 0)`;
      this.panElementRef.nativeElement.style.webkitTransform = translate3d;
      (<any>this.panElementRef.nativeElement.style).MozTransform = translate3d;
      this.panElementRef.nativeElement.style.transform = translate3d;
      (<any>this.panElementRef.nativeElement.style).msTransform = translate3d;
    }
    else {
      this.panElementRef.nativeElement.style.left = `${this.model.pan.x}px`;
      this.panElementRef.nativeElement.style.top = `${this.model.pan.y}px`;
    }
  }



  private getModelPosition(viewPosition: Point) {
    // log.debug('PanZoomComponent: getModelPosition()');
    // p = (1/s)(p' - t)
    let pmark = viewPosition;
    let s = this.getCssScale(this.base.zoomLevel);
    let t = this.base.pan;

    return {
      x: (1 / s) * (pmark.x - t.x),
      y: (1 / s) * (pmark.y - t.y)
    };
  }



  private zoomToFit(rectangle: Rect, duration: number = null) {
    // log.debug('PanZoomComponent: zoomToFit(): rectangle', rectangle);

    // when a user clicks a zoom to fit button
    // example rectangle: { "x": 0, "y": 100, "width": 100, "height": 100 }

    if (this.config.freeMouseWheel) {
      this.scale = this.getCssScale(this.base.zoomLevel);
    }
    let target: PanZoomModel = this.calcZoomToFit(rectangle);
    // target.pan.x is the panElement left style property
    // target.pan.y is the panElement top style property
    this.lastTick = performance.now();
    this.animateToTarget(target, duration);
    this.zone.runOutsideAngular( () => this.animationId = this.animationFrame(this.animationTick) );
  }



  private resetView() {
    // Only use if config.initialZoomToFit is set
    // log.debug('PanZoomComponent: resetView()');
    this.zoomToFit(this.config.initialZoomToFit);
  }



  private length(vector2d: any) {
    // log.debug('PanZoomComponent: length()');
    return Math.sqrt(vector2d.x * vector2d.x + vector2d.y * vector2d.y);
  }



  private getCenterPoint(): Point {
    // log.debug('PanZoomComponent: getCenterPoint()');
    // log.debug('PanZoomComponent: getCenterPoint(): projectedContentRef:', this.projectedContentRef);
    let center = {
      // x: this.frameElement.width() / 2,
      x: this.frameElementRef.nativeElement.offsetWidth / 2,
      // x: this.projectedContentRef.nativeElement.offsetWidth / 2,
      // y: this.frameElement.height() / 2
      y: this.frameElementRef.nativeElement.offsetHeight / 2
      // y: this.projectedContentRef.nativeElement.offsetHeight / 2
    };
    return center;
  }



  private getViewPosition(modelPosition: Point) {
    // log.debug('PanZoomComponent: getViewPosition()');
    //  p' = p * s + t
    let p = modelPosition;
    let s = this.getCssScale(this.base.zoomLevel);
    let t = this.base.pan;

    if (this.zoomAnimation) {
      s = this.getCssScale(this.base.zoomLevel + this.zoomAnimation.deltaZoomLevel * this.zoomAnimation.progress);
      let deltaT = this.zoomAnimation.translationFromZoom(this.model.zoomLevel);
      t = { x: this.base.pan.x + deltaT.x, y: this.base.pan.y + deltaT.y };
    }

    return {
      x: p.x * s + t.x,
      y: p.y * s + t.y
    };
  }



  private getCssScale(zoomLevel: any): number {
    // log.debug('PanZoomComponent: getCssScale()');
    return Math.pow(this.config.scalePerZoomLevel, zoomLevel - this.config.neutralZoomLevel);
  }



  private getZoomLevel(cssScale: any) {
    // log.debug('PanZoomComponent: getZoomLevel()');
    return Math.log10(cssScale) / Math.log10(this.config.scalePerZoomLevel) + this.config.neutralZoomLevel;
  }



  private calcZoomToFit(rect: Rect): PanZoomModel {
    // log.debug('PanZoomComponent: calcZoomToFit(): rect:', rect);
    // let (W, H) denote the size of the viewport
    // let (w, h) denote the size of the rectangle to zoom to
    // then we must CSS scale by the min of W/w and H/h in order to just fit the rectangle
    // returns the target left and top coordinates for the panElement and target zoomLevel

    let W = this.frameElementRef.nativeElement.offsetWidth;
    let H = this.frameElementRef.nativeElement.offsetHeight;

    let w = rect.width;
    let h = rect.height;

    let cssScaleExact = Math.min( W / w, H / h );
    let zoomLevelExact = this.getZoomLevel(cssScaleExact);
    let zoomLevel = zoomLevelExact * this.config.zoomToFitZoomLevelFactor;
    let cssScale = this.getCssScale(zoomLevel);

    // log.debug('cssScaleExact:', cssScaleExact);
    // log.debug('cssScale:', cssScale);
    // log.debug('zoomLevel:', zoomLevel);

    return {
        zoomLevel: zoomLevel,
        pan: {
            x: -rect.x * cssScale + (W - w * cssScale) / 2,
            y: -rect.y * cssScale + (H - h * cssScale) / 2
        }
    };
  }



  private freeZoom(clickPoint: Point, wheelDelta: number): void {
    // log.debug('PanZoomComponent: freeZoom(): this.base:', this.base);
    // log.debug(`PanZoomComponent: freeZoom(): baseBeforeZoom: x: ${this.base.pan.x} y: ${this.base.pan.y} zoomlevel: ${this.base.zoomLevel}` );

    let t0: Point = {
      // the current base coordinates
      x: this.base.pan.x,
      y: this.base.pan.y
    };
    let s0 = this.scale; // get the current CSS scale (scale0)
    let pmark = clickPoint; // the point we are aiming to zoom to

    let s1 = wheelDelta * this.config.freeMouseWheelFactor * this.scale + this.scale;

    s1 = Math.max(this.minScale, Math.min( this.maxScale, s1 ));
    this.scale = s1;
    // log.debug('scale:', this.scale);

    let t1: Point = {
      // The target point to zoom to.  It must stay the same as the untranslated point
      x: pmark.x - (s1 / s0) * (pmark.x - t0.x),
      y: pmark.y - (s1 / s0) * (pmark.y - t0.y)
    };

    // Apply Scale
    let scaleString = `scale3d(${this.scale}, ${this.scale}, ${this.scale})`;
    // webkit - chrome, safari
    this.zoomElementRef.nativeElement.style.webkitTransformOrigin = '0 0';
    this.zoomElementRef.nativeElement.style.webkitTransform = scaleString;
    // firefox
    (<any>this.zoomElementRef.nativeElement.style).MozTransformOrigin = '0 0';
    (<any>this.zoomElementRef.nativeElement.style).MozTransform = scaleString;
    // ie 9
    (<any>this.zoomElementRef.nativeElement.style).msTransformOrigin = '0 0';
    (<any>this.zoomElementRef.nativeElement.style).msTransform = scaleString;
    // ie > 9
    this.zoomElementRef.nativeElement.style.transformOrigin = '0 0';
    this.zoomElementRef.nativeElement.style.transform = scaleString;

    // Apply Pan
    let translate3d = `translate3d(${t1.x}px, ${t1.y}px, 0)`;
    this.panElementRef.nativeElement.style.webkitTransform = translate3d;
    (<any>this.panElementRef.nativeElement.style).MozTransform = translate3d;
    this.panElementRef.nativeElement.style.transform = translate3d;
    (<any>this.panElementRef.nativeElement.style).msTransform = translate3d;

    if (this.isChrome) {
      if (this.willChangeNextFrame) {
        (<any>this.zoomElementRef.nativeElement.style).willChange = 'transform';
        this.willChangeNextFrame = false;
      }
      else {
        (<any>this.zoomElementRef.nativeElement.style).willChange = null;
        this.willChangeNextFrame = true;
      }
    }

    this.base.pan = t1;
    this.base.zoomLevel = this.getZoomLevel(this.scale);
    this.config.modelChanged.next(this.base);
    // log.debug(`PanZoomComponent: freeZoom(): baseAfterZoom: x: ${this.base.pan.x} y: ${this.base.pan.y} zoomlevel: ${this.base.zoomLevel}` );
  }



  private zoomIn(clickPoint: Point) {
    // log.debug('PanZoomComponent: zoomIn(): clickPoint:', clickPoint);
    this.lastTick = performance.now();
    this.changeZoomLevel( this.base.zoomLevel + this.config.zoomButtonIncrement, clickPoint );
    this.zone.runOutsideAngular( () => this.animationId = this.animationFrame(this.animationTick) );
    if (this.config.freeMouseWheel) {
      this.scale = this.getCssScale(this.base.zoomLevel);
    }
  }



  private zoomInToLastClickPoint() {
    // log.debug('PanZoomComponent: zoomInToLastClickPoint(): lastClickPoint', this.lastClickPoint);
    this.lastTick = performance.now();
    this.changeZoomLevel( this.base.zoomLevel + this.config.zoomButtonIncrement, this.lastClickPoint );
    this.zone.runOutsideAngular( () => this.animationId = this.animationFrame(this.animationTick) );
    if (this.config.freeMouseWheel) {
      this.scale = this.getCssScale(this.base.zoomLevel);
    }
  }



  private zoomOut(clickPoint: Point) {
    // log.debug('PanZoomComponent: zoomOut()');
    this.lastTick = performance.now();
    this.changeZoomLevel( this.base.zoomLevel - this.config.zoomButtonIncrement, clickPoint );
    this.zone.runOutsideAngular( () => this.animationId = this.animationFrame(this.animationTick) );
    if (this.config.freeMouseWheel) {
      this.scale = this.getCssScale(this.base.zoomLevel);
    }
  }



  private zoomOutFromLastClickPoint() {
    // log.debug('PanZoomComponent: zoomOutFromLastClickPoint()');
    this.lastTick = performance.now();
    this.changeZoomLevel( this.base.zoomLevel - this.config.zoomButtonIncrement, this.lastClickPoint );
    this.zone.runOutsideAngular( () => this.animationId = this.animationFrame(this.animationTick) );
    if (this.config.freeMouseWheel) {
      this.scale = this.getCssScale(this.base.zoomLevel);
    }
  }



  private animateToTarget(target: PanZoomModel, duration = null) {
    // log.debug('PanZoomComponent: animateToTarget()');

    if (this.zoomAnimation) {
      // make the user wait for existing animation to finish before clicking
      return;
    }

    let deltaZoomLevel = target.zoomLevel - this.base.zoomLevel; // deltaZoomLevel is the number of zoom levels we are changing here

    let oldBase: Point = {
      // the current base coordinates
      x: this.base.pan.x,
      y: this.base.pan.y
    };
    this.model.pan.x = this.base.pan.x;
    this.model.pan.y = this.base.pan.y;

    let translationFromZoom = (zoomLevel: number) => {
      // this function gets called during every animation tick in syncModelToDOM(), to calculate where to move the model pan coordinates to (i.e. the translation) for that tick,
      // where zoomLevel is calculated from the current zoomLevel + the target zoomLevel * the progress of the current animation
      let t1: Point = {
        // The target point to zoom to for the current animation frame.  It must stay the same as the untranslated point
        x: (oldBase.x - target.pan.x) * this.zoomAnimation.progress,
        y: (oldBase.y - target.pan.y) * this.zoomAnimation.progress
      };

      return { x: -t1.x, y: -t1.y };
    };

    // now rewind to the start of the anim and let it run its course
    this.zoomAnimation = {
      deltaZoomLevel: deltaZoomLevel, // the destination zoom level for this zoom operation (when the animation is completed)
      translationFromZoom: translationFromZoom,
      duration: duration || this.config.zoomStepDuration, // how long the animation should take
      progress: this.config.disableZoomAnimation ? 1.0 : 0.0 // If zoom animation is disabled set progress to the finished point so that the animation completes on the first tick
    };

  }



  private changeZoomLevel(newZoomLevel: number, clickPoint: Point) {
    // log.debug('PanZoomComponent: changeZoomLevel()');

    if (this.zoomAnimation) {
      // cancel any existing zoom animation (if they pressed a zoom button - this shouldn't ever happen on mousewheel)
      this.base.zoomLevel = this.model.zoomLevel;
      this.base.pan.x = this.model.pan.x;
      this.base.pan.y = this.model.pan.y;
      this.zoomAnimation = null;
    }

    // keep zoom level in bounds
    let minimumAllowedZoomLevel = this.config.keepInBounds ? this.config.neutralZoomLevel : 0;
    newZoomLevel = Math.max(minimumAllowedZoomLevel, newZoomLevel);
    newZoomLevel = Math.min(this.config.zoomLevels - 1, newZoomLevel);
    // log.debug('newZoomLevel:', newZoomLevel);

    let deltaZoomLevel = newZoomLevel - this.base.zoomLevel; // deltaZoomLevel is the number of zoom levels we are changing here
    if (!deltaZoomLevel) {
      // a deltaZoomLevel of zero means that we aren't changing zoom, because we're either zoomed all the way in or all the way out
      return;
    }

    //
    // Let p be the vector to the clicked point in view coords and let p' be the same point in model coords. Let s be a scale factor
    // and let t be a translation vector. Let the transformation be defined as:
    //
    //  p' = p * s + t
    //
    // And conversely:
    //
    //  p = (1/s)(p' - t)
    //
    // Now use subscription 0 to denote the value before transform and zoom and let 1 denote the value after transform. Scale
    // changes from s0 to s1. Translation changes from t0 to t1. But keep p and p' fixed so that the view coordinate p' still
    // corresponds to the model coordinate p. This can be expressed as an equation relying upon solely upon p', s0, s1, t0, and t1:
    //
    //  (1/s0)(p - t0) = (1/s1)(p - t1)
    //
    // Every variable but t1 is known, thus it is easily isolated to:
    //
    //  t1 = p' - (s1/s0)*(p' - t0)
    //

    let t0: Point = {
      // the current base coordinates
      x: this.base.pan.x,
      y: this.base.pan.y
    };
    let s0 = this.getCssScale(this.base.zoomLevel); // get the current CSS scale (scale0)
    let pmark = clickPoint || this.getCenterPoint(); // the point we are aiming to zoom to (either the click point or the centre of the page)


    let translationFromZoom = (zoomLevel: number) => {
      // this function gets called during every animation tick, to calculate where to move the model pan coordinates to (i.e. the translation) for that tick,
      // where zoomLevel is calculated from the current zoomLevel + the target zoomLevel * the progress of the current animation
      let s1 = this.getCssScale(zoomLevel); // the scale to translate to for the current animation tick
      let t1: Point = {
        // The target point to zoom to.  It must stay the same as the untranslated point
        x: pmark.x - (s1 / s0) * (pmark.x - t0.x),
        y: pmark.y - (s1 / s0) * (pmark.y - t0.y)
      };

      return {
        // now return the difference between our initial click point and our translated (zoomed) click point
        // these are not absolute coordinates - just how far to move them
        x: t1.x - t0.x,
        y: t1.y - t0.y
      };
    };

    // now rewind to the start of the anim and let it run its course
    this.zoomAnimation = {
      deltaZoomLevel: deltaZoomLevel, // the destination zoom level for this zoom operation (when the animation is completed)
      translationFromZoom: translationFromZoom,
      duration: this.config.zoomStepDuration, // how long the animation should take
      progress: this.config.disableZoomAnimation ? 1.0 : 0.0 // If zoom animation is disabled set progress to the finished point so that the animation completes on the first tick
    };

  }


}
