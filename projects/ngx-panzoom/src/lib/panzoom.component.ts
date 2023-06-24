/* eslint-disable @angular-eslint/component-selector */
import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  Input,
  NgZone
} from '@angular/core';
import { PanZoomConfig } from './panzoom-config';
import {
  isMobileDevice,
  length,
  isMouseDownEvent,
  isMouseUpEvent,
  isMouseMoveEvent,
  isTouchStartEvent,
  isTouchEndEvent,
  isTouchMoveEvent,
  animationFrameFunc,
  isParentElement,
  isChrome,
  getMatrix,
  getTranslate,
  getScale
} from './utils'
import {
  Offset,
  Point,
  Rect,
  ZoomAnimation,
  Position,
  PanZoomModel,
  PanZoomAPI,
  ZoomType,
  Distance
} from './types';


@Component({
  selector: 'pan-zoom',
  // we don't want to kill change detection for all elements beneath this, so we don't set OnPush.  Child views can implement OnPush if the developer wants to.  We can get away with this because the 'wheel' event handler runs outside of Angular, therefore it doesn't trigger change detection.
  templateUrl: './panzoom.component.html',
  styleUrls: [
    './panzoom.component.css'
  ]
})

export class PanZoomComponent implements OnInit, AfterViewInit, OnDestroy {

  constructor (
    private zone: NgZone,
    el: ElementRef
  ) {
    this.frameElement = el.nativeElement;
  }

  // @ViewChild('panElement') private panElementRef: ElementRef;
  @ViewChild('zoomElement') private zoomElementRef: ElementRef;
  @ViewChild('trackElement') private trackElementRef: ElementRef;
  @ViewChild('panzoomOverlay') private panzoomOverlayRef: ElementRef;
  @Input() config: PanZoomConfig;

  private frameElement: HTMLElement;
  private zoomElement: HTMLElement;
  private trackElement: HTMLElement;
  private panzoomOverlay: HTMLElement;

  private base: PanZoomModel; // this is what the pan/zoom view is before a zoom animation begins and after it ends.  It also updates with every mouse drag or freeZoom, but the animation is mostly tied to the model.
  private model: PanZoomModel; // this is used for incremental changes to the pan/zoom view during each animation frame.  Setting it will update the pan/zoom coordinates on the next call to updateDOM().  Not used during mouse drag.
  private api: PanZoomAPI;
  private contentHeight: number;
  private contentWidth: number;
  private frameHeight: number;
  private frameWidth: number;
  private lastMouseEventTime: number;
  private lastTouchEventTime: number;
  private previousPosition: Position;
  private isDragging = false;
  private panVelocity: Point;
  private animationParams: ZoomAnimation;
  private lastTick = 0;
  private willChangeNextFrame = true; // used for scaling in Chrome
  private animationId: number;
  private isMobile = isMobileDevice();
  private scale: number;
  private isFirstSync = true;
  private lastClickPoint: Point;
  private zoomLevelIsChanging = false;
  private dragFinishing = false;
  private dragMouseButton: number;
  private maxScale: number; // the highest scale (furthest zoomed in) that we will allow in free zoom mode (calculated)
  private minScale: number; // the smallest scale (furthest zoomed out) that we will allow in free zoom mode (calculated)
  private minimumAllowedZoomLevel = 0;
  private resizeObserver: ResizeObserver;

  private _modelNew: PanZoomModel;
  private get modelNew(): PanZoomModel {
    return this._modelNew;
  }
  private set modelNew(value: PanZoomModel) {
    this._modelNew = value;
  }
  
  private frameBoundingRect: DOMRect;
  private intersectionObserver: IntersectionObserver;
  private originX = 0;
  private originY = 0;



  ngOnInit(): void {
    // console.log('PanZoomComponent: ngOnInit(): initializing PanZoomComponent');
    // create public API
    this.api = {
      model: this.model,
      config: this.config,
      changeZoomLevel: this.zoomToLevelAndPoint.bind(this),
      zoomIn: this.zoomIn.bind(this),
      zoomOut: this.zoomOut.bind(this),
      zoomToFit: this.zoomToFit.bind(this),
      resetView: this.resetView.bind(this),
      getViewPosition: this.getViewPosition.bind(this),
      getModelPosition: this.getModelPosition.bind(this),
      panToPoint: this.panToPoint.bind(this),
      panDelta: this.panDelta.bind(this),
      panDeltaPercent: this.panDeltaPercent.bind(this),
      panDeltaAbsolute: this.panDeltaAbsolute.bind(this),
      centerContent: this.centerContent.bind(this),
      centerX: this.centerX.bind(this),
      centerY: this.centerY.bind(this),
      centerTopLeft: this.centerTopLeftCorner.bind(this),
      centerBottomLeft: this.centerBottomLeftCorner.bind(this),
      centerTopRight: this.centerTopRightCorner.bind(this),
      centerBottomRight: this.centerBottomRightCorner.bind(this),
      updateContentDimensions: this.updateContentDimensions.bind(this),
      detectContentDimensions: this.detectContentDimensions.bind(this)
    };
    this.config.api.next(this.api);
  }



  ngAfterViewInit(): void {
    // console.log('PanZoomComponent: ngAfterViewInit()');
    // this.panElement = this.panElementRef.nativeElement;
    this.zoomElement = this.zoomElementRef.nativeElement;
    this.panzoomOverlay = this.panzoomOverlayRef.nativeElement;
    this.trackElement = this.trackElementRef.nativeElement;

    this.base = this.config.initialZoomToFit
      ? this.calcZoomToFit(this.config.initialZoomToFit)
      : {
        zoomLevel: this.config.initialZoomLevel,
        pan: {
          x: this.config.initialPanX,
          y: this.config.initialPanY
        }
      };

    this.model = {
      zoomLevel: this.base.zoomLevel,
      isPanning: false, // Only true if panning is actually taking place, not just after mousedown
      pan: {
        x: this.base.pan.x,
        y: this.base.pan.y
      }
    };
    this.config.modelChanged.next(this.model);

    if (this.config.freeMouseWheel) {
      this.scale = this.getCssScale(this.config.initialZoomLevel);
      const maxZoomLevel = this.config.zoomLevels - 1;
      this.maxScale = this.getCssScale(maxZoomLevel);
      this.minScale = this.getCssScale(0);
    }

    if (this.config.keepInBounds) {
      this.minimumAllowedZoomLevel = this.config.neutralZoomLevel;
      this.minScale = this.getCssScale(this.config.neutralZoomLevel);
    }

    // this.zoomElement.style.willChange = 'transform';
    // if (isChrome) {
    //   this.zoomElement.style.transform = 'translateZ(0)';
    // }

    // if (this.config.acceleratePan) {
    //   this.panElement.style.willChange = 'transform';
    //   if (navigator.userAgent.search('Chrome') >= 0) {
    //     this.isChrome = true;
    //     this.panElement.style.transform = 'translateZ(0)';
    //   }
    // }

    this.animationTick();
    this.scale = this.getCssScale(this.base.zoomLevel);
    this.isFirstSync = false;
    switch (this.config.dragMouseButton) {
      case 'left':
        this.dragMouseButton = 0;
        break;
      case 'middle':
        this.dragMouseButton = 1;
        this.zone.runOutsideAngular(
          () => this.frameElement.addEventListener('auxclick', this.preventDefault )
        );
        break;
      case 'right':
        this.zone.runOutsideAngular(
          () => document.addEventListener('contextmenu', this.preventDefault )
        );
        this.dragMouseButton = 2;
        break;
      default:
        this.dragMouseButton = 0; // left
    }

    this.detectContentDimensions();
    const frameStyle = getComputedStyle(this.frameElement);
    this.frameHeight = parseInt(
      frameStyle.getPropertyValue('height').split('px')[0]
    );
    this.frameWidth = parseInt(
      frameStyle.getPropertyValue('width').split('px')[0]
    );

    if (this.config.dynamicContentDimensions) {
      if (!window.ResizeObserver) {
        throw new Error('ResizeObserver API is not supported by this browser.  See https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver for info on browser compatibility.');
      }
      this.resizeObserver = new window.ResizeObserver(
        (entries) => this.onContentDimensionsChangeDetected(entries)
      );
      this.zone.runOutsideAngular(
        () => this.resizeObserver.observe(this.zoomElement)
      );
    }

    this.zone.runOutsideAngular( () => {
      if (this.isMobile) {
        this.frameElement.addEventListener('touchstart', this.onTouchStart);
        return;
      }
      this.frameElement.addEventListener('mousedown', this.onMouseDown);
      this.frameElement.addEventListener('dblclick', this.onDblClick );
      this.frameElement.addEventListener(
        'wheel',
        (event) => animationFrameFunc(
          () => this.onMouseWheel(event)
        ),
        { passive: true }
      );
    });

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        // this is much more performant than getBoundingClientRect(), which forces a reflow
        console.log({boundingClientRect: entry.boundingClientRect})
        this.frameBoundingRect = entry.boundingClientRect;
      },
      {
        // root: this.frameElement
      } as any
    )
    this.intersectionObserver.observe(this.trackElement);
  }



  ngOnDestroy(): void {
    // console.log('PanZoomComponent: ngOnDestroy()');
    if (this.isMobile) {
      this.frameElement.removeEventListener('touchstart', this.onTouchStart);
    }
    else {
      this.frameElement.removeEventListener('mousedown', this.onMouseDown);
      this.frameElement.removeEventListener('wheel', (event) => animationFrameFunc(
        () => this.onMouseWheel(event) )
      );
      this.frameElement.removeEventListener('dblclick', this.onDblClick);
    }
    if (animationFrameFunc && this.animationId) {
      window.cancelAnimationFrame(this.animationId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    switch (this.config.dragMouseButton) {
      case 'middle':
        this.dragMouseButton = 1;
        this.zone.runOutsideAngular(
          () => this.frameElement.removeEventListener('auxclick', this.preventDefault )
        );
        break;
      case 'right':
        this.zone.runOutsideAngular(
          () => document.removeEventListener('contextmenu', this.preventDefault )
        );
        this.dragMouseButton = 2;
        break;
    }
    this.intersectionObserver.disconnect()
  }

  //////////////////////////// END OF LIFECYCLE HOOKS ////////////////////////////








  ////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////////// EVENT HANDLERS ///////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  private onMouseWheel = (event: WheelEvent) => {
    // console.log('PanZoomComponent: OnMouseWheel()', {eventPageX: event.pageX, eventPageY: event.pageY});
    const alreadyZooming = !!this.animationParams;
    if (!this.config.zoomOnMouseWheel || alreadyZooming) {
      return;
    }
    const deltaY = this.config.invertMouseWheel
      ? event.deltaY
      : -event.deltaY;
    // const { left, top } = this.getFrameElementOffset();
    // const wheelPoint: Point = {
    //   x: event.pageX - left,
    //   y: event.pageY - top
    // };
    const wheelPoint: Point = {
      x: event.pageX,
      y: event.pageY
    };
    switch (true) {
      case this.config.freeMouseWheel:
        this.freeZoom(wheelPoint, deltaY);
        break;
      case deltaY < 0:
        this.zoomInToPoint(wheelPoint);
        break;
      case deltaY > 0:
        this.zoomOutFromPoint(wheelPoint);
        break;
    }
    this.lastClickPoint = wheelPoint;
  }



  private onMouseDown = (event: MouseEvent): void => {
    // console.log('PanZoomComponent: onMousedown()', event);
    /* Check if clicked location is inside element from which
       dragging is prevented. */
    if (
      !this.config.panOnClickDrag
      || (
        this.config.noDragFromElementClass
        && isParentElement(this.config.noDragFromElementClass, event.target as Element)
      )
    ) {
      return;
    }
    const isDragMouseButton = isMouseDownEvent(event) && event?.button === this.dragMouseButton;
    if (!isDragMouseButton) {
      return
    }

    if (isDragMouseButton) {
      event.preventDefault();
    }

    this.dragFinishing = false;
    this.panVelocity = undefined;

    this.previousPosition = {
      x: event.pageX,
      y: event.pageY
    }
    this.lastMouseEventTime = event.timeStamp;
    this.isDragging = true;
    this.model.isPanning = false;

    document.addEventListener('mousemove', this.onMouseMove, { passive: true, capture: false } );
    document.addEventListener('mouseup', this.onMouseUp );
  }



  private onTouchStart = (event: TouchEvent) => {
    // console.log('PanZoomComponent: onTouchStart()', event);
    // console.log('PanZoomComponent: onTouchStart(): touches:', event.touches.length);
    switch (event.touches.length) {
      case 1: {
        this.previousPosition = {
          x: event.touches[0].pageX,
          y: event.touches[0].pageY
        }
        break;
      }
      case 2: {
        // multiple touches, get ready for zooming
        // Calculate x and y distance between touch events
        const x = event.touches[0].pageX - event.touches[1].pageX;
        const y = event.touches[0].pageY - event.touches[1].pageY;
    
        // Calculate length between touch points with pythagoras
        // There is no reason to use Math.pow and Math.sqrt as we
        // only want a relative length and not the exact one.
        this.previousPosition = {
          length: x * x + y * y
        };
        break;
      }
    }
    document.addEventListener('touchend', this.onTouchEnd, false );
    document.addEventListener('touchmove', this.onTouchMove, { passive: true, capture: false } );
  }



  private onMouseMove = (event: MouseEvent) => {
    // console.log('PanZoomComponent: onMouseMove()');
    // Called when moving the mouse with the left button down
    const mousePosition: Point = {
      x: event.pageX,
      y: event.pageY
    }
    const now = event.timeStamp;
    const timeDelta = (now - this.lastMouseEventTime) / 1000;
    this.lastMouseEventTime = now;
    const dragDelta: Distance = {
      x: mousePosition.x - this.previousPosition.x,
      y: mousePosition.y - this.previousPosition.y
    };

    if (this.config.keepInBounds) {
      const topLeftCornerView = this.getViewPosition({ x: 0, y: 0 });
      const bottomRightCornerView = this.getViewPosition({ x: this.contentWidth, y: this.contentHeight });
      if (topLeftCornerView.x > 0 && dragDelta.x > 0) {
        dragDelta.x *= Math.min(
          1,
          Math.pow(topLeftCornerView.x, -this.config.keepInBoundsDragPullback)
        );
      }

      if (topLeftCornerView.y > 0 && dragDelta.y > 0) {
        dragDelta.y *= Math.min(
          1,
          Math.pow(topLeftCornerView.y, -this.config.keepInBoundsDragPullback)
        );
      }

      if (bottomRightCornerView.x < this.contentWidth && dragDelta.x < 0) {
        dragDelta.x *= Math.min(
          1,
          Math.pow(this.contentWidth - bottomRightCornerView.x, -this.config.keepInBoundsDragPullback)
        );
      }

      if (bottomRightCornerView.y < this.contentHeight && dragDelta.y < 0) {
        dragDelta.y *= Math.min(
          1,
          Math.pow(this.contentHeight - bottomRightCornerView.y, -this.config.keepInBoundsDragPullback)
        );
      }
    }

    // now pan the view
    this.model.pan.x += dragDelta.x;
    this.model.pan.y += dragDelta.y;
    this.syncModelToBase();
    // this.animationTick();
    animationFrameFunc(this.animationTick);

    if (!this.model.isPanning) {
      // This will improve the performance,
      // because the browser stops evaluating hits against the elements displayed inside the pan zoom view.
      // Besides this, mouse events will not be sent to any other elements,
      // this prevents issues like selecting elements while dragging.
      this.panzoomOverlay.style.display = 'block';
    }
    this.model.isPanning = true;

    // set these for the animation slow down once drag stops
    // panVelocity is a measurement of speed for x and y coordinates, in pixels per mouse move event.  It is a measure of how fast the mouse is moving
    const panVelocityX = dragDelta.x / timeDelta;
    const panVelocityY = dragDelta.y / timeDelta;
    this.panVelocity = {
      x: !Number.isFinite(panVelocityX) ? 0 : panVelocityX,
      y: !Number.isFinite(panVelocityY) ? 0 : panVelocityY
    };

    this.previousPosition = {
      x: mousePosition.x,
      y: mousePosition.y
    };
  }
  
  
  
  private onTouchMove = (event: TouchEvent) => {
    // console.log('PanZoomComponent: onMouseMove()', event);
    // console.log(`PanZoomComponent: onMouseMove(): event.timeStamp:`, event.timeStamp);
    // timestamp - 10587.879999999132 - milliseconds
    // Called when moving the mouse with the left button down
    const touchPosition = { 
      x: event.touches[0].pageX,
      y: event.touches[0].pageY
    }

    const now = event.timeStamp;
    const timeDelta = (now - this.lastTouchEventTime) / 1000;
    this.lastTouchEventTime = now;
    const dragDelta = {
      // a representation of how far each coordinate has moved since the last time it was moved
      x: touchPosition.x - this.previousPosition.x,
      y: touchPosition.y - this.previousPosition.y
    };

    if (this.config.keepInBounds) {
      const topLeftCornerView = this.getViewPosition( { x: 0, y: 0 } );
      const bottomRightCornerView = this.getViewPosition( { x: this.contentWidth, y: this.contentHeight } );
      if (topLeftCornerView.x > 0 && dragDelta.x > 0) {
        dragDelta.x *= Math.min(
          1,
          Math.pow(topLeftCornerView.x, -this.config.keepInBoundsDragPullback)
        );
      }

      if (topLeftCornerView.y > 0 && dragDelta.y > 0) {
        dragDelta.y *= Math.min(
          1,
          Math.pow(topLeftCornerView.y, -this.config.keepInBoundsDragPullback)
        );
      }

      if (bottomRightCornerView.x < this.contentWidth && dragDelta.x < 0) {
        dragDelta.x *= Math.min(
          1,
          Math.pow(this.contentWidth - bottomRightCornerView.x, -this.config.keepInBoundsDragPullback)
        );
      }

      if (bottomRightCornerView.y < this.contentHeight && dragDelta.y < 0) {
        dragDelta.y *= Math.min(
          1,
          Math.pow(this.contentHeight - bottomRightCornerView.y, -this.config.keepInBoundsDragPullback)
        );
      }
    }

    // now pan the view
    const delta: Point = {
      x: dragDelta.x ?? 0,
      y: dragDelta.y ?? 0
    };
    this.model.pan.x += delta.x;
    this.model.pan.y += delta.y;
    this.syncModelToBase();
    // this.animationTick();
    animationFrameFunc(this.animationTick);

    if (!this.model.isPanning) {
      // This will improve the performance,
      // because the browser stops evaluating hits against the elements displayed inside the pan zoom view.
      // Besides this, mouse events will not be sent to any other elements,
      // this prevents issues like selecting elements while dragging.
      this.panzoomOverlay.style.display = 'block';
    }
    this.model.isPanning = true;

    // set these for the animation slow down once drag stops
    // panVelocity is a measurement of speed for x and y coordinates, in pixels per mouse move event.  It is a measure of how fast the mouse is moving
    const panVelocityX = dragDelta.x / timeDelta;
    const panVelocityY = dragDelta.y / timeDelta;
    this.panVelocity = {
      x: !Number.isFinite(panVelocityX) ? 0 : panVelocityX,
      y: !Number.isFinite(panVelocityY) ? 0 : panVelocityY
    };
    // console.log(`PanZoomComponent: onMouseMove(): panVelocity:`, this.panVelocity);
    this.previousPosition = touchPosition;
  }



  private onMouseUp = (event: MouseEvent): void => {
    // console.log('PanZoomComponent: onMouseup()', event);
    event.preventDefault();

    const now = event.timeStamp;
    const deltaTime = (now - this.lastMouseEventTime) / 1000;

    if (this.panVelocity && (this.panVelocity.x !== 0 || this.panVelocity.y !== 0) ) {
      // apply strong initial dampening if the mouse up occured much later than the last mouse move, indicating that the mouse hasn't moved recently
      // TBD - experiment with this formula
      const initialMultiplier = Math.max(
        0,
        -0.2 + Math.pow(deltaTime + 1, -4)
        );

      this.panVelocity.x *= initialMultiplier;
      this.panVelocity.y *= initialMultiplier;
      this.dragFinishing = true;
      this.zone.runOutsideAngular(
        () => this.animationId = animationFrameFunc(this.animationTick)
      );
    }
    else {
      this.panVelocity = undefined;
      this.dragFinishing = false;
      this.model.isPanning = false;
      this.config.modelChanged.next(this.model);
      this.syncModelToBase();
    }

    this.isDragging = false;
    document.removeEventListener('mousemove', this.onMouseMove, { capture: false } );
    document.removeEventListener('mouseup', this.onMouseUp);

    // Set the overlay to non-blocking again:
    this.panzoomOverlay.style.display = 'none';
  }



  private onTouchEnd = (event: TouchEvent) => {
    // console.log('PanZoomComponent: onTouchEnd()');
    event.preventDefault();
    const now = event.timeStamp;
    const deltaTime = (now - this.lastMouseEventTime) / 1000;

    if (this.panVelocity && (this.panVelocity.x !== 0 || this.panVelocity.y !== 0) ) {
      // apply strong initial dampening if the mouse up occured much later than the last mouse move, indicating that the mouse hasn't moved recently
      // TBD - experiment with this formula
      const initialMultiplier = Math.max(
        0,
        -0.2 + Math.pow(deltaTime + 1, -4)
        );

      this.panVelocity.x *= initialMultiplier;
      this.panVelocity.y *= initialMultiplier;
      this.dragFinishing = true;
      this.zone.runOutsideAngular(
        () => this.animationId = animationFrameFunc(this.animationTick)
      );
    }
    else {
      this.panVelocity = undefined;
      this.dragFinishing = false;
      this.model.isPanning = false;
      this.config.modelChanged.next(this.model);
      this.syncModelToBase();
    }

    this.isDragging = false;
    document.removeEventListener('touchmove', this.onTouchMove, { capture: false } );
    document.removeEventListener('touchstart', this.onTouchStart);

    // Set the overlay to non-blocking again:
    this.panzoomOverlay.style.display = 'none';
  }



  private onDblClick = (event: MouseEvent) => {
    // console.log('PanZoomComponent: onDblClick()');
    event.preventDefault();
    if (!this.config.zoomOnDoubleClick) {
      return;
    }

    const frameElementOffset = this.getFrameElementOffset();
    const clickPoint: Point = {
      x: event.pageX - frameElementOffset.left,
      y: event.pageY - frameElementOffset.top
    };
    this.lastClickPoint = clickPoint;
    this.zoomInToPoint(clickPoint);
  }



  private preventDefault = (event: Event) => {
    event.preventDefault();
  }



  ////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////// END EVENT HANDLERS ///////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////










  ////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////// APPLY ANIMATIONS /////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////



  private animationTick = (timestamp = performance.now()) => {
    // console.log('PanZoomComponent: animationTick()');
    // timestamp looks like 76916.963.  The unit is milliseconds and should be accurate to 5 µs (microseconds)

    let deltaTime = this.lastTick !== 0
      ? timestamp - this.lastTick // orig - milliseconds since the last animationTick
      : 0;
    this.lastTick = timestamp;

    if (this.animationParams) {
      // when an animation is running (but not waiting for a released drag to halt)
      this.animationParams.progress += Math.abs(deltaTime / this.animationParams.duration);

      if (this.animationParams.progress >= 1.0) {
        // Only when the animation has finished, sync the base to the model.
        this.animationParams.progress = 1.0;
        this.updateDOM();
        this.animationParams = undefined;
      }
    }

    if (this.panVelocity && this.dragFinishing) {
      // This is when we've panned and released the mouse button and the view is "free-floating" until it slows to a halt.  Don't let the while loop fool you - this only applies it for the current frame.
      // Prevent overshooting if delta time is large for some reason. We apply the simple solution of slicing delta time into smaller pieces and applying each one
      if (deltaTime > 0) {
        deltaTime = deltaTime / 1000;
      }
      while (deltaTime > 0) {
        const dTime = Math.min(.02, deltaTime);
        deltaTime = deltaTime - dTime;

        this.model.pan.x = this.model.pan.x + this.panVelocity.x * dTime;
        this.panVelocity.x = this.panVelocity.x * (1 - this.config.friction * dTime);

        this.model.pan.y = this.model.pan.y + this.panVelocity.y * dTime;
        this.panVelocity.y = this.panVelocity.y * (1 - this.config.friction * dTime);

        const speed = length(this.panVelocity);
        if (speed <= this.config.haltSpeed) {
          this.panVelocity = undefined;
          this.dragFinishing = false;
          break;
        }
      }
    }

    if (this.config.keepInBounds || this.dragFinishing) {
      // Checks that keepInBounds is set and that the mouse button isn't pressed, and if so, it stops the contents from going out of view
      const topLeftCornerView = this.getViewPosition({ x: 0, y: 0 });
      const bottomRightCornerView = this.getViewPosition({ x: this.contentWidth, y: this.contentHeight });

      if (topLeftCornerView.x > 0) {
        this.base.pan.x -= this.config.keepInBoundsRestoreForce * topLeftCornerView.x;
      }

      if (topLeftCornerView.y > 0) {
        this.base.pan.y -= this.config.keepInBoundsRestoreForce * topLeftCornerView.y;
      }

      if (bottomRightCornerView.x < this.contentWidth) {
        this.base.pan.x -= this.config.keepInBoundsRestoreForce * (bottomRightCornerView.x - this.contentWidth);
      }

      if (bottomRightCornerView.y < this.contentHeight) {
        this.base.pan.y -= this.config.keepInBoundsRestoreForce * (bottomRightCornerView.y - this.contentHeight);
      }
    }

    this.updateDOM();
    this.config.modelChanged.next(this.model);

    switch (true) {

      case (!!this.animationParams || (!!this.panVelocity && this.dragFinishing)):
        // If an animation is active, run the next frame
        if (this.zoomLevelIsChanging) {
          this.updateWillChange();
        }
        animationFrameFunc(this.animationTick); // Call the next animation frame
        break;

      case this.panVelocity && !this.dragFinishing:
        return;

      default:
        // Animation has ended
        if (this.model.isPanning) {
          this.model.isPanning = false;
        } 
        this.syncModelToBase();
        this.config.modelChanged.next(this.model);
        this.scale = this.getCssScale(this.base.zoomLevel);
        this.willChangeNextFrame = true;
        this.zoomElement.style.willChange = 'transform';
        this.zoomLevelIsChanging = false;
        this.lastTick = 0;
    }
  }



  private updateDOM() {
    // console.log('PanZoomComponent: updateDOM()');
    // Called by ngAfterViewInit() and animationTick()
    // This function does not get called by freeZoom(), which operates independently of animationTick() and updateDOM().

    if (this.animationParams) {
      // we're running an animation sequence (but not freeZooming or panning with onMouseMove() )
      this.model.zoomLevel = this.base.zoomLevel + this.animationParams.deltaZoomLevel * this.animationParams.progress; // calculate how far we need to zoom in or out for the current animationTick
      const deltaTranslation = this.animationParams.panStepFunc(this.model.zoomLevel); // calculate how far to pan the view to based on our translated coordinates

      // sync the model pan coordinates to our translated pan coordinates
      // we do this by adding how far we want to move in each direction to our our existing base pan coordinates (where we started)
      this.model.pan.x = this.base.pan.x + deltaTranslation.x;
      this.model.pan.y = this.base.pan.y + deltaTranslation.y;

      if (this.config.keepInBounds) {
        const topLeftCornerView = this.getViewPosition({ x: 0, y: 0 });
        const bottomRightCornerView = this.getViewPosition({ x: this.contentWidth, y: this.contentHeight });

        if (topLeftCornerView.x > 0) {
          this.model.pan.x = 0;
        }

        if (topLeftCornerView.y > 0) {
          this.model.pan.y = 0;
        }

        if (bottomRightCornerView.x < this.contentWidth) {
          this.model.pan.x -= (bottomRightCornerView.x - this.contentWidth);
        }

        if (bottomRightCornerView.y < this.contentHeight) {
          this.model.pan.y -= (bottomRightCornerView.y - this.contentHeight);
        }
      }
    }

    this.scale = this.getCssScale(this.model.zoomLevel);

    // APPLY SCALING
    if (this.animationParams || this.isFirstSync) {
      // const zoomStyle = `transform-origin: 0 0; transform: scale(${scale});`;
      // this.zoomElement.setAttribute('style', zoomStyle);
    }
    this.zoomElement.style.transform = getMatrix({
      scale: this.scale,
      translateX: this.model.pan.x,
      translateY: this.model.pan.y
    });
  }



  private freeZoomOld(clickPoint: Point, wheelDelta: number): void {
    // console.log('PanZoomComponent: freeZoom(): this.base:', this.base);
    if (this.isDragging) {
      // don't allow zooming if the mouse is down
      return;
    }

    console.log(this.zoomElement.style.transformOrigin)
    // console.log({x: clickPoint.x, y: clickPoint.y})

    this.animationParams = undefined; // cancel any existing animation

    if (this.panVelocity) {
      this.dragFinishing = false;
      this.panVelocity = undefined;
    }

    let newScale = this.scale + (wheelDelta * this.config.freeMouseWheelFactor * this.scale);

    // takes either the minimum scale (furthest allowable zoomed out) or the calculated current scale, whichever is greater, unless calculated current scale exceeds maxScale (furthest allowable zoomed in), in which case maxScale is used
    newScale = Math.max(
      this.minScale,
      Math.min(
        this.maxScale,
        newScale
      )
    );
    this.scale = newScale;


    // Apply Pan
    this.zoomElement.style.transformOrigin = `${clickPoint.x}px ${clickPoint.y}px`;
    
    // Apply Scale
    const scaleString = `scale(${this.scale})`;
    this.updateWillChange();
    // const zoomStyle = `transform-origin: 0 0; transform: ${scaleString};${willChange}`;

    // apply zoom css
    // this.zoomElement.setAttribute('style', zoomStyle);
    this.zoomElement.style.transform = scaleString;
    this.model = {
      ...this.model,
      // pan: targetPoint,
      pan: clickPoint,
      zoomLevel: this.getZoomLevel(this.scale)
    };
    this.syncModelToBase();
    this.config.modelChanged.next(this.model);
  }



  private freeZoom({x, y}: Point, wheelDelta: number): void {
    // console.log('PanZoomComponent: freeZoom(): this.base:', this.base);
    if (this.isDragging) {
      // don't allow zooming if the mouse is down
      return;
    }
    
    this.animationParams = undefined; // cancel any existing animation
    this.dragFinishing = false;
    this.panVelocity = undefined;

    const { minScale, maxScale, scale } = this;
    // const { left, top } = this.frameBoundingRect;
    const { left, top } = this.zoomElement.getBoundingClientRect();
    // console.log(`left: ${left}, top: ${top}`)

    const originX = x - left;
    const originY = y - top;
    const newOriginX = originX / scale;
    const newOriginY = originY / scale;
    
    let newScale = this.scale + (wheelDelta * this.config.freeMouseWheelFactor * this.scale);
    newScale = Math.max(
      minScale,
      Math.min(
        maxScale,
        newScale
      )
    );
    const translate = getTranslate({
      scale,
      minScale,
      maxScale
    });
    const translateX = translate({
      pos: originX,
      prevPos: this.originX,
      translate: this.base.pan.x
    });
    const translateY = translate({
      pos: originY,
      prevPos: this.originY,
      translate: this.base.pan.y
    });

    this.zoomElement.style.transformOrigin = `${newOriginX}px ${newOriginY}px`;
    this.zoomElement.style.transform = getMatrix({
      scale: newScale,
      translateX,
      translateY
    });
    this.updateWillChange();
    
    // state.transformation = {
    //   originX: newOriginX,
    //   originY: newOriginY,
    //   translateX,
    //   translateY,
    //   scale: newScale
    // };
    
    this.originX = newOriginX;
    this.originY = newOriginY;
    this.model = {
      ...this.model,
      pan: {
        x: translateX,
        y: translateY
      },
      zoomLevel: this.getZoomLevel(newScale)
    };
    this.scale = newScale;
    this.syncModelToBase();
    this.config.modelChanged.next(this.model);
  }

  ////////////////////////////////////////////////////
  //////////////// HELPER FUNCTIONS //////////////////
  ////////////////////////////////////////////////////

  private updateWillChange() {
    // run will-change toggle hack on Chrome to trigger re-rasterization
    // see https://developers.google.com/web/updates/2016/09/re-rastering-composite
    if (!isChrome) {
      return;
    }
    this.zoomElement.style.willChange = this.willChangeNextFrame
      ? 'auto'
      : 'transform'
    this.willChangeNextFrame = !this.willChangeNextFrame;
  }

  private syncModelToBase() {
    this.base = {
      isPanning: this.base.isPanning,
      pan: this.model.pan,
      zoomLevel: this.model.zoomLevel
    };
  }



  private getCentrePoint(): Point {
    // console.log('PanZoomComponent: getCentrePoint()');
    return {
      x: this.frameElement.offsetWidth / 2,
      y: this.frameElement.offsetHeight / 2
    };
  }



  private getCssScale(zoomLevel: number): number {
    // console.log('PanZoomComponent: getCssScale()');
    return Math.pow(this.config.scalePerZoomLevel, zoomLevel - this.config.neutralZoomLevel);
  }



  private getZoomLevel(cssScale: number) {
    // console.log('PanZoomComponent: getZoomLevel()');
    return Math.log10(cssScale) / Math.log10(this.config.scalePerZoomLevel) + this.config.neutralZoomLevel;
  }



  private calcZoomToFit(rect: Rect): PanZoomModel {
    // console.log('PanZoomComponent: calcZoomToFit(): rect:', rect);
    // let (W, H) denote the size of the viewport
    // let (w, h) denote the size of the rectangle to zoom to
    // then we must CSS scale by the min of W/w and H/h in order to just fit the rectangle
    // returns the target left and top coordinates for the panElement and target zoomLevel
    const viewportWidth = this.frameElement.offsetWidth;
    const viewportHeight = this.frameElement.offsetHeight;

    const targetWidth = rect.width;
    const targetHeight = rect.height;

    const cssScaleExact = Math.min( viewportWidth / targetWidth, viewportHeight / targetHeight );
    const zoomLevelExact = this.getZoomLevel(cssScaleExact);
    const zoomLevel = zoomLevelExact * this.config.zoomToFitZoomLevelFactor;
    const cssScale = this.getCssScale(zoomLevel);
    return {
        zoomLevel: zoomLevel,
        pan: {
            x: -rect.x * cssScale + (viewportWidth - targetWidth * cssScale) / 2,
            y: -rect.y * cssScale + (viewportHeight - targetHeight * cssScale) / 2
        }
    };
  }



  private zoomToFitModel(target: PanZoomModel, duration: number = undefined) {
    // console.log('PanZoomComponent: zoomToFitModel(): target:', target);
    // target.pan.x is the panElement left style property
    // target.pan.y is the panElement top style property
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }



  private zoomToLevelAndPoint(level: number, clickPoint: Point) {
    // console.log('PanZoomComponent: zoomToLevelAndPoint(): level:', level);
    // console.log('PanZoomComponent: zoomToLevelAndPoint(): clickPoint:', clickPoint);
    this.changeZoomLevel( level, clickPoint );
  }



  private zoomIn(zoomType: ZoomType = 'lastPoint') {
    // console.log('PanZoomComponent: zoomIn()');
    if (zoomType === 'lastPoint') {
      this.changeZoomLevel( this.base.zoomLevel + this.config.zoomButtonIncrement, this.lastClickPoint );
    }
    else if (zoomType === 'viewCenter') {
      this.changeZoomLevel( this.base.zoomLevel + this.config.zoomButtonIncrement, this.getCentrePoint() );
    }
  }



  private zoomOut(zoomType: ZoomType = 'lastPoint') {
    // console.log('PanZoomComponent: zoomOut()');
    if (zoomType === 'lastPoint') {
      this.changeZoomLevel( this.base.zoomLevel - this.config.zoomButtonIncrement, this.lastClickPoint );
    }
    else if (zoomType === 'viewCenter') {
      this.changeZoomLevel( this.base.zoomLevel - this.config.zoomButtonIncrement, this.getCentrePoint() );
    }
  }



  private startAnimation() {
    this.lastTick = performance.now();
    this.zone.runOutsideAngular(
      () => this.animationId = animationFrameFunc(this.animationTick)
    );
  }



  private getFrameElementOffset(): Offset {
    return {
      top: this.frameBoundingRect.top + window.scrollY,
      left: this.frameBoundingRect.left + window.scrollX
    };
  }



  private onContentDimensionsChangeDetected(entries: ResizeObserverEntry[]) {
    // callback for ResizeObserver
    this.contentHeight = entries[0].contentRect.height;
    this.contentWidth = entries[0].contentRect.width;
  }



  ////////////////////////////////////////////////////
  /////////////////// API METHODS ////////////////////
  ////////////////////////////////////////////////////

  private getViewPosition(modelPosition: Point): Point {
    // console.log('PanZoomComponent: getViewPosition()');
    // p' = p * s + t
    // viewPosition = modelPosition * scale + basePan
    let scale: number
    let translation: Point;

    if (this.animationParams) {
      scale = this.getCssScale(this.base.zoomLevel + this.animationParams.deltaZoomLevel * this.animationParams.progress);
      const deltaTranslation = this.animationParams.panStepFunc(this.model.zoomLevel);
      translation = {
        x: this.base.pan.x + deltaTranslation.x,
        y: this.base.pan.y + deltaTranslation.y
      };
    }
    else {
      scale = this.getCssScale(this.base.zoomLevel);
      translation = this.base.pan;
    }

    return {
      x: modelPosition.x * scale + translation.x,
      y: modelPosition.y * scale + translation.y
    };
  }



  private getModelPosition(viewPosition: Point): Point {
    // console.log('PanZoomComponent: getModelPosition()');
    // p = (1/s)(p' - t)
    const pmark = viewPosition;
    const s = this.getCssScale(this.base.zoomLevel);
    const t = this.base.pan;

    return {
      x: (1 / s) * (pmark.x - t.x),
      y: (1 / s) * (pmark.y - t.y)
    };
  }



  private resetView() {
    // console.log('PanZoomComponent: resetView()');
    if (this.config.initialZoomToFit) {
      this.zoomToFit(this.config.initialZoomToFit);
    }
    else if (this.config.initialPanX !== undefined && this.config.initialPanY !== undefined && this.config.initialZoomLevel !== undefined) {
      this.zoomToFitModel(
        {
          zoomLevel: this.config.initialZoomLevel,
          pan: {
            x: this.config.initialPanX,
            y: this.config.initialPanY
          }
        }
      );
    }
    else {
      console.error('PanZoomComponent: resetView() could not reset view as some vars were not set.  The culprits are either config.initialZoomLevel, config.initialPanX, or config.initialPanY.  Or just set panzoomConfig.initialZoomToFit');
      console.log('config.initialZoomLevel: ' + this.config.initialZoomLevel);
      console.log('config.initialPanX: ' + this.config.initialPanX);
      console.log('config.initialPanY: ' + this.config.initialPanY);
    }
  }



  private zoomToFit(rectangle: Rect, duration?: number) {
    // console.log('PanZoomComponent: zoomToFit(): rectangle', rectangle);
    // when a user clicks a zoom to fit button
    // example rectangle: { "x": 0, "y": 100, "width": 100, "height": 100 }

    const target: PanZoomModel = this.calcZoomToFit(rectangle);
    // target.pan.x is the panElement left style property
    // target.pan.y is the panElement top style property
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }



  private zoomInToPoint(clickPoint: Point) {
    // console.log('PanZoomComponent: zoomIn(): clickPoint:', clickPoint);
    this.changeZoomLevel( this.base.zoomLevel + this.config.zoomButtonIncrement, clickPoint );
  }



  private zoomOutFromPoint(clickPoint: Point) {
    // console.log('PanZoomComponent: zoomOut()');
    this.changeZoomLevel( this.base.zoomLevel - this.config.zoomButtonIncrement, clickPoint );
  }



  private panToPoint(point: Point, duration?: number) {
    // console.log('PanZoomComponent: panToPoint(): point:', point);
    // API call to animate the view so that the centre point of the view is at the
    // point parameter coordinates, relative to the original, unzoomed
    // content width and height
    // example point: { "x": 0, "y": 0 } // makes the top-left corner of the content
    // the centre of the view

    const target: PanZoomModel = {
      pan: {
        x: (this.frameWidth / 2) - point.x * this.scale,
        y: (this.frameHeight / 2) - point.y * this.scale
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }




  private panToPointCurrentScale(point: Point, duration?: number) {
    // console.log('PanZoomComponent: panToPoint(): point:', point);
    // API call to animate the view so that the centre point of the view is at the
    // point parameter coordinates, relative to the original, unzoomed
    // content width and height
    // example point: { "x": 0, "y": 0 } // makes the top-left corner of the content
    // the centre of the view

    const target: PanZoomModel = {
      pan: {
        x: (this.frameWidth / 2) - point.x,
        y: (this.frameHeight / 2) - point.y
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }



  private panDelta(delta: Distance, duration?: number) {
    // console.log('PanZoomComponent: panDelta(): delta:', delta);
    /*
      Pan the view left, right, up, or down, based on a number of pixels of the original, unzoomed content.
      Positive is right and down
      Negative is left and up
      
      example point: { "x": 100, "y": -50 } // moves the view right 50px and up 50px
    */
    console.log({basePan: this.base.pan})
    const target: PanZoomModel = {
      pan: {
        // x: this.base.pan.x - this.scale * delta.x,
        // y: this.base.pan.y - this.scale * delta.y
        x: this.base.pan.x * this.scale - this.scale * delta.x,
        y: this.base.pan.y * this.scale - this.scale * delta.y
      },
      zoomLevel: this.base.zoomLevel
    };
    console.log({target})
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }



  private panDeltaAbsolute(delta: Point, duration?: number) {
    // console.log('PanZoomComponent: panDeltaAbsolute(): delta:', delta);
    // API call to pan the view left, right, up, or down, based on a number of pixels
    // This method doesn't adjust for scale.  I'm not sure why you'd want this
    // but have it here just in case someone needs it
    // Positive is right and down
    // Negative is left and up
    // example point: { "x": 100, "y": -50 } // moves the view right 50px and up 50px
    const target: PanZoomModel = {
      pan: {
        x: this.base.pan.x - delta.x,
        y: this.base.pan.y - delta.y
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }



  private panDeltaPercent(deltaPercent: Point, duration?: number) {
    // console.log('PanZoomComponent: panDeltaPercent(): deltaPercent:', deltaPercent);
    // API call to pan the view up, down, left, or right, based on a percentage
    // of the original, unzoomed content width and height
    // example point: { "x": 10, "y": -20 }

    const deltaX = deltaPercent.x !== 0
      ? this.contentWidth * ( deltaPercent.x / 100 ) * this.scale
      : 0;
    const deltaY = deltaPercent.y !== 0
      ? this.contentHeight * ( deltaPercent.y / 100 ) * this.scale
      : 0;

    const target: PanZoomModel = {
      pan: {
        x: this.base.pan.x - deltaX,
        y: this.base.pan.y - deltaY
      },
      zoomLevel: this.base.zoomLevel
    };
    // target.pan.x is the panElement left style property
    // target.pan.y is the panElement top style property
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }



  private centerContent(duration?: number) {
    this.panToPoint( {
      x: this.contentWidth / 2,
      y: this.contentHeight / 2
    },
    duration);
  }



  private centerX(duration?: number) {
    const target: PanZoomModel = {
      pan: {
        x: (this.frameWidth / 2) - (this.contentWidth / 2) * this.scale,
        y: this.base.pan.y
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }



  private centerY(duration?: number) {
    const target: PanZoomModel = {
      pan: {
        x: this.base.pan.x,
        y: (this.frameHeight / 2) - (this.contentHeight / 2) * this.scale
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }



  private centerTopLeftCorner(duration?: number) {
    this.panToPoint( {
      x: 0,
      y: 0
    },
    duration);
  }



  private centerBottomLeftCorner(duration?: number) {
    this.panToPoint( {
      x: 0,
      y: this.contentHeight
    },
    duration);
  }



  private centerTopRightCorner(duration?: number) {
    this.panToPoint( {
      x: this.contentWidth,
      y: 0
    },
    duration);
  }



  private centerBottomRightCorner(duration?: number) {
    this.panToPoint( {
      x: this.contentWidth,
      y: this.contentHeight
    },
    duration);
  }



  private updateContentDimensions(width?: number, height?: number) {
    if (height !== undefined) {
      this.contentHeight = height;
    }
    if (width !== undefined) {
      this.contentWidth = width;
    }
  }



  private detectContentDimensions() {
    const zoomFrameStyle  = getComputedStyle(this.zoomElement);
    this.contentHeight = parseInt( zoomFrameStyle.getPropertyValue('height').split('px')[0] );
    this.contentWidth = parseInt( zoomFrameStyle.getPropertyValue('width').split('px')[0] );
  }



  ////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////// ANIMATION BUILDERS ///////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////

  private animateToTarget(targetModel: PanZoomModel, durationSeconds = this.config.zoomStepDuration) {
    // console.log('PanZoomComponent: animateToTarget()');
    // what this function really does is take a target model, and then sets
    // this.animationParams with the parameters for the whole animation,
    // namely the delta zoomLevel
    // it is the responsibility of the caller to kick off the animation with a call to animationFrameFunc()

    if (this.animationParams) {
      // make the user wait for existing animation to finish before clicking
      return;
    }

    this.zoomLevelIsChanging = false;
    if (this.base.zoomLevel !== targetModel.zoomLevel) {
      this.zoomLevelIsChanging = true;
    }

    const deltaZoomLevel = targetModel.zoomLevel - this.base.zoomLevel; // deltaZoomLevel is the number of zoom levels we are changing here
    
    const oldBase: Point = {
      // the current base coordinates
      x: this.base.pan.x,
      y: this.base.pan.y
    };
    this.model.pan.x = this.base.pan.x;
    this.model.pan.y = this.base.pan.y;

    const panStepFunc = (): Point => {
      // this function gets called during every animation tick in updateDOM(), to calculate where to move the model pan coordinates to (i.e. the translation) for that tick, zoomLevel is ignored within animateToTarget()
      const targetPoint: Point = {
        // The target point to zoom to for the current animation frame.  It must stay the same as the untranslated point
        x: (oldBase.x - targetModel.pan.x) * this.animationParams.progress,
        y: (oldBase.y - targetModel.pan.y) * this.animationParams.progress
      };
      return {
        x: -targetPoint.x,
        y: -targetPoint.y
      };
    };

    // now set the parameters of our new animation
    const durationMS = durationSeconds * 1000;
    this.animationParams = {
      deltaZoomLevel, // how many zooom levels to zoom in or out
      panStepFunc, // a function which runs on every animation tick, which calcs how much to pan the view on every frame
      duration: durationMS, // how long the animation should take
      progress: 0.0
    };
    this.startAnimation();
  }



  private changeZoomLevel(newZoomLevel: number, clickPoint: Point) {
    // console.log('PanZoomComponent: changeZoomLevel()');
    if (this.animationParams) {
      // let's let any current animation just finish
      return;
    }

    this.zoomLevelIsChanging = true;

    // keep zoom level in bounds
    newZoomLevel = Math.max(this.minimumAllowedZoomLevel, newZoomLevel);
    newZoomLevel = Math.min(this.config.zoomLevels - 1, newZoomLevel);

    const deltaZoomLevel = newZoomLevel - this.base.zoomLevel; // deltaZoomLevel is the number of zoom levels we are changing here
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

    const currentPan: Point = {
      // t0 - the current base coordinates
      x: this.base.pan.x,
      y: this.base.pan.y
    };

    const currentScale = this.scale; // s0 - get the current CSS scale (scale0)
    const destPoint = clickPoint || this.getCentrePoint(); // pmark - the point we are aiming to zoom to (either the click point or the centre of the page)


    const panStepFunc = (zoomLevel: number) => {
      // this function gets called during every animation tick, to calculate where to move the model pan coordinates to (i.e. the translation) for that tick, where zoomLevel is calculated from the current zoomLevel + the target zoomLevel * the progress of the current animation

      const targetScale = this.getCssScale(zoomLevel); // s1 - the scale to translate to for the current animation tick
      const targetPoint: Point = {
        // t1 - The target point to pan to.  It must stay the same as the untranslated point
        x: destPoint.x - (targetScale / currentScale) * (destPoint.x - currentPan.x),
        y: destPoint.y - (targetScale / currentScale) * (destPoint.y - currentPan.y)
      };

      return {
        // now return the difference between our initial click point and our translated (zoomed) click point
        // these are not absolute coordinates - just how far to move them
        x: targetPoint.x - currentPan.x,
        y: targetPoint.y - currentPan.y
      };
    };

    // now set the parameters of our new animation
    this.animationParams = {
      deltaZoomLevel: deltaZoomLevel, // the destination zoom level for this zoom operation (when the animation is completed)
      panStepFunc,
      duration: this.config.zoomStepDuration * 1000, // how long the animation should take
      progress: 0.0
    };
    this.startAnimation();
  }
}
