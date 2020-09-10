import { PanZoomConfig } from './panzoom-config';
import { Point, Position, PanZoomModel, ZoomAnimation, ViewRefs, Rect, Offset, ZoomType, ViewRefsDimensions } from './interfaces';
import { Injectable, NgZone } from '@angular/core';
import { ReplaySubject } from 'rxjs';

@Injectable()

export class PanZoomApi {

  public config: PanZoomConfig;

  public modelChanged = new ReplaySubject<PanZoomModel>(1);

  private viewRefs: ViewRefs;
  private viewRefsDimensions: ViewRefsDimensions;
  private base: PanZoomModel; // this is what the pan/zoom view is before a zoom animation begins and after it ends.  It also updates with every mouse drag or freeZoom, but the animation is mostly tied to the model.
  private animationFrameFunc: Function; // reference to the appropriate getAnimationFrame function for the client browser
  private animationId: number;
  private isMobile = false;
  private resizeObserver: any; // waiting for a Typescript definition for ResizeObserver
  private model: PanZoomModel; // this is used for incremental changes to the pan/zoom view during each animation frame.  Setting it will update the pan/zoom coordinates on the next call to updateDOM().  Not used during mouse drag.
  private frameHeight: number;
  private lastMouseEventTime: number;
  private previousPosition: Position;
  private isDragging = false;
  private panVelocity: Point;
  private animationParams: ZoomAnimation;
  private lastTick = 0;
  private isChrome = false;
  private willChangeNextFrame = true; // used for scaling in Chrome
  private scale: number;
  private isFirstSync = true;
  private lastClickPoint: Point;
  private zoomLevelIsChanging = false;
  private dragFinishing = false;
  private dragMouseButton: number;

  private maxScale: number; // the highest scale (furthest zoomed in) that we will allow in free zoom mode (calculated)
  private minScale: number; // the smallest scale (furthest zoomed out) that we will allow in free zoom mode (calculated)
  private minimumAllowedZoomLevel: number;

  constructor(private zone: NgZone) { }

  init(viewRefs: ViewRefs, viewRefsDimensions: ViewRefsDimensions) {

    this.viewRefs = viewRefs;
    this.viewRefsDimensions = viewRefsDimensions;

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
      isPanning: false, // Only true if panning is actually taking place, not just after mousedown
      pan: {
        x: this.base.pan.x,
        y: this.base.pan.y
      }
    };

    if (this.config.freeMouseWheel) {
      this.scale = this.getCssScale(this.config.initialZoomLevel);
      const maxZoomLevel = this.config.zoomLevels - 1;
      this.maxScale = this.getCssScale(maxZoomLevel);
      this.minScale = this.getCssScale(0);
    }

    this.minimumAllowedZoomLevel = 0;
    if (this.config.keepInBounds) {
      this.minimumAllowedZoomLevel = this.config.neutralZoomLevel;
      this.minScale = this.getCssScale(this.config.neutralZoomLevel);
    }

    this.viewRefs.zoom.nativeElement.style.willChange = 'transform';
    if (navigator.userAgent.search('Chrome') >= 0) {
      this.isChrome = true;
      this.viewRefs.zoom.nativeElement.style.transform = 'translateZ(0)';
    }

    if (this.config.acceleratePan) {
      this.viewRefs.pan.nativeElement.style.willChange = 'transform';
      if (navigator.userAgent.search('Chrome') >= 0) {
        this.isChrome = true;
        this.viewRefs.pan.nativeElement.style.transform = 'translateZ(0)';
      }
    }

    this.animationTick();
    this.scale = this.getCssScale(this.base.zoomLevel);
    this.isFirstSync = false;
    switch (this.config.dragMouseButton) {
      case 'left':
        this.dragMouseButton = 0;
        break;
      case 'middle':
        this.dragMouseButton = 1;
        this.zone.runOutsideAngular( () => this.viewRefs.frame.nativeElement.addEventListener('auxclick', this.preventDefault ) );
        break;
      case 'right':
        this.zone.runOutsideAngular( () => document.addEventListener('contextmenu', this.preventDefault ) );
        this.dragMouseButton = 2;
        break;
      default:
        this.dragMouseButton = 0; // left
    }

    this.zone.runOutsideAngular( () => this.animationFrameFunc = window.requestAnimationFrame );

    if (this.config.dynamicContentDimensions) {
      if ((window as any).ResizeObserver) {
        this.resizeObserver = new (window as any).ResizeObserver( entries => this.onContentDimensionsChangeDetected(entries) );
        this.zone.runOutsideAngular( () => this.resizeObserver.observe(this.viewRefs.zoom.nativeElement) );
      }
      else {
        console.error('ResizeObserver API is not supported by this browser.  See https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver for info on browser compatibility.');
      }
    }

    if (this.isMobileDevice()) {
      this.isMobile = true;
      this.zone.runOutsideAngular( () => this.viewRefs.frame.nativeElement.addEventListener('touchstart', this.onTouchStart ) );
    }
    else {
      this.zone.runOutsideAngular( () => {
        this.viewRefs.frame.nativeElement.addEventListener('mousedown', this.onMousedown);
        this.viewRefs.frame.nativeElement.addEventListener('dblclick', this.onDblClick );
        this.viewRefs.frame.nativeElement.addEventListener('wheel', (event) => this.animationFrameFunc( () => this.onMouseWheel(event) ), { passive: true } );
      } );
    }
  }

  cleanup() {

    if (this.isMobile) {
      this.viewRefs.frame.nativeElement.removeEventListener('touchstart', this.onTouchStart);
    }
    else {
      this.viewRefs.frame.nativeElement.removeEventListener('mousedown', this.onMousedown);
      this.viewRefs.frame.nativeElement.removeEventListener('wheel', (event) => this.animationFrameFunc( () => this.onMouseWheel(event) ), { passive: true } );
      this.viewRefs.frame.nativeElement.removeEventListener('dblclick', this.onDblClick);
    }
    if (this.animationFrameFunc && this.animationId) {
      window.cancelAnimationFrame(this.animationId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    switch (this.config.dragMouseButton) {
      case 'middle':
        this.dragMouseButton = 1;
        this.zone.runOutsideAngular( () => this.viewRefs.frame.nativeElement.removeEventListener('auxclick', this.preventDefault ) );
        break;
      case 'right':
        this.zone.runOutsideAngular( () => document.removeEventListener('contextmenu', this.preventDefault ) );
        this.dragMouseButton = 2;
        break;
    }
  }

  onMouseWheel = (event: WheelEvent) => {

    if (!(event && event.pageX && event.pageY)) {
      return;
    }

    let deltaY = event.deltaY;

    if (this.config.zoomOnMouseWheel) {

      if (this.animationParams) {
        return; // already zooming
      }

      if (!this.config.invertMouseWheel) {
        deltaY = -deltaY;
      }

      const frameElementOffset = this.getFrameElementOffset();
      const clickPoint: Point = {
        x: event.pageX - frameElementOffset.left,
        y: event.pageY - frameElementOffset.top
      };

      this.lastClickPoint = clickPoint;

      if (this.config.freeMouseWheel) {
        // free wheel scroll
        this.freeZoom(clickPoint, deltaY);
      }
      else {
        if (deltaY < 0) {
          this.zoomInToPoint(clickPoint);
        }
        else if (deltaY > 0) {
          this.zoomOutFromPoint(clickPoint);
        }
      }
    }
  }

  /**
   * Method will check if 'child' node element is a child of
   * parent node with class 'className'
   * @param className
   * @param child
   */
  public isParentElement(className, child) {
    let node = child.parentNode;
    while (node !== null) {
      if (node.classList && node.classList.contains(className)) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  public onMousedown = (event: any) => {

    /* Check if clicked location is inside element from which
       dragging is prevented. */
    if (this.config.noDragFromElementClass
        && this.isParentElement(this.config.noDragFromElementClass, event.srcElement)) {
      return;
    }

    if (event.button === this.dragMouseButton || event.type === 'touchstart') {
      event.preventDefault();

      this.dragFinishing = false;
      this.panVelocity = undefined;

      if (this.config.panOnClickDrag) {
        this.previousPosition = {
          x: event.pageX,
          y: event.pageY
        };
        this.lastMouseEventTime = event.timeStamp;
        this.isDragging = true;
        this.model.isPanning = false;

        if (this.isMobile) {
          this.zone.runOutsideAngular( () => document.addEventListener('touchend', this.onTouchEnd, false ) ); // leave this on document
          this.zone.runOutsideAngular( () => document.addEventListener('touchmove', this.onTouchMove, { passive: true, capture: false } ) ); // leave this on document
        }
        else {
          this.zone.runOutsideAngular( () => document.addEventListener('mousemove', this.onMouseMove, { passive: true, capture: false } ) ); // leave this on document
          this.zone.runOutsideAngular( () => document.addEventListener('mouseup', this.onMouseUp ) ); // leave this on document
        }
      }

      return false;
    }
  }

  public onTouchStart = (event: TouchEvent) => {

    event.preventDefault();

    if (event.touches.length !== 1) {
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
    }
    this.onMousedown(event);
  }

  public onMouseMove = (event: any) => {

    // console.log('PanZoomComponent: onMouseMove()', event);
    // console.log(`PanZoomComponent: onMouseMove(): event.timeStamp:`, event.timeStamp);
    // timestamp - 10587.879999999132 - milliseconds
    // Called when moving the mouse with the left button down

    if (!(event && event.pageX && event.pageY)) {
      return;
    }

    const now = event.timeStamp;
    const timeSinceLastMouseEvent = (now - this.lastMouseEventTime) / 1000;
    this.lastMouseEventTime = now;
    const dragDelta = {
      // a representation of how far each coordinate has moved since the last time it was moved
      x: event.pageX - this.previousPosition.x,
      y: event.pageY - this.previousPosition.y
    };

    if (this.config.keepInBounds) {

      const topLeftCornerView = this.getViewPosition( { x: 0, y: 0 } );
      const bottomRightCornerView = this.getViewPosition( { x: this.viewRefsDimensions.zoom.width, y: this.viewRefsDimensions.zoom.height } );

      if (topLeftCornerView.x > 0 && dragDelta.x > 0) {
        dragDelta.x *= Math.min(1, Math.pow(topLeftCornerView.x, -this.config.keepInBoundsDragPullback));
      }

      if (topLeftCornerView.y > 0 && dragDelta.y > 0) {
        dragDelta.y *= Math.min(1, Math.pow(topLeftCornerView.y, -this.config.keepInBoundsDragPullback));
      }

      if (bottomRightCornerView.x < this.viewRefsDimensions.zoom.width && dragDelta.x < 0) {
        dragDelta.x *= Math.min(1, Math.pow(this.viewRefsDimensions.zoom.width - bottomRightCornerView.x, -this.config.keepInBoundsDragPullback));
      }

      if (bottomRightCornerView.y < this.viewRefsDimensions.zoom.height && dragDelta.y < 0) {
        dragDelta.y *= Math.min(1, Math.pow(this.viewRefsDimensions.zoom.height - bottomRightCornerView.y, -this.config.keepInBoundsDragPullback));
      }
    }

    // now pan the view
    const delta: Point = {
      x: dragDelta.x || 0,
      y: dragDelta.y || 0
    };
    this.model.pan.x += delta.x;
    this.model.pan.y += delta.y;
    this.syncBaseToModel();
    this.animationTick();

    if (!this.model.isPanning) {
      // This will improve the performance,
      // because the browser stops evaluating hits against the elements displayed inside the pan zoom view.
      // Besides this, mouse events will not be sent to any other elements,
      // this prevents issues like selecting elements while dragging.
      this.viewRefs.overlay.nativeElement.style.display = 'block';
    }
    this.model.isPanning = true;

    // set these for the animation slow down once drag stops
    // panVelocity is a measurement of speed for x and y coordinates, in pixels per mouse move event.  It is a measure of how fast the mouse is moving
    const panVelocityX = dragDelta.x / timeSinceLastMouseEvent;
    const panVelocityY = dragDelta.y / timeSinceLastMouseEvent;
    this.panVelocity = {
      x: !Number.isFinite(panVelocityX) ? 0 : panVelocityX,
      y: !Number.isFinite(panVelocityY) ? 0 : panVelocityY
    };
    // console.log(`PanZoomComponent: onMouseMove(): panVelocity:`, this.panVelocity);

    this.previousPosition = {
      x: event.pageX,
      y: event.pageY
    };

  }

  public onTouchMove = (event: any) => {
    // console.log('PanZoomComponent: onTouchMove()');
    // console.log('PanZoomComponent: onTouchMove(): event:', event);

    if (event.touches.length === 1) {
      // single touch, emulate mouse move
      this.onMouseMove(event);
    }
    else {
      // multiple touches, zoom in/out
      // console.log('pinch zooming');

      // Calculate x and y distance between touch events
      const x = event.touches[0].pageX - event.touches[1].pageX;
      const y = event.touches[0].pageY - event.touches[1].pageY;
      // Calculate length between touch points with pythagoras
      // There is no reason to use Math.pow and Math.sqrt as we
      // only want a relative length and not the exact one.
      const length = x * x + y * y;

      // Calculate delta between current position and last position
      const delta = length - this.previousPosition.length;

      // Naive hysteresis
      if (Math.abs(delta) < 100) {
        return;
      }

      // Calculate center between touch points
      const centerX = event.touches[1].pageX + x / 2;
      const centerY = event.touches[1].pageY + y / 2;

      // Calculate zoom center
      const frameElementOffset = this.getFrameElementOffset();
      const clickPoint = {
        x: centerX - frameElementOffset.left,
        y: centerY - frameElementOffset.top
      };
      this.lastClickPoint = clickPoint;

      this.changeZoomLevel( this.base.zoomLevel + delta * 0.0001, clickPoint );

      // Update length for next move event
      this.previousPosition = {
        length: length
      };
    }
  }

  public onMouseUp = (event) => {
    // console.log('PanZoomComponent: onMouseup()', event);

    if (event.button !== this.dragMouseButton) {
      return;
    }

    event.preventDefault();

    const now = event.timeStamp;
    const timeSinceLastMouseEvent = (now - this.lastMouseEventTime) / 1000;

    if (this.panVelocity && (this.panVelocity.x !== 0 || this.panVelocity.y !== 0) ) {
      // apply strong initial dampening if the mouse up occured much later than the last mouse move, indicating that the mouse hasn't moved recently
      // TBD - experiment with this formula
      const initialMultiplier = Math.max(
        0,
        -0.2 + Math.pow(timeSinceLastMouseEvent + 1, -4)
        );

      this.panVelocity.x *= initialMultiplier;
      this.panVelocity.y *= initialMultiplier;
      this.dragFinishing = true;
      this.zone.runOutsideAngular( () => this.animationId = this.animationFrameFunc(this.animationTick) );
    }
    else {
      this.panVelocity = undefined;
      this.dragFinishing = false;
      this.model.isPanning = false;
      this.modelChanged.next(this.model);
      this.syncBaseToModel();
    }

    this.isDragging = false;

    if (this.isMobile) {
      this.zone.runOutsideAngular( () => document.removeEventListener('touchend', this.onTouchEnd) );
      this.zone.runOutsideAngular( () => document.removeEventListener('touchmove', this.onTouchMove, <any>{ passive: true, capture: false } ) );
    }
    else {
      this.zone.runOutsideAngular( () => document.removeEventListener('mousemove', this.onMouseMove, <any>{ passive: true, capture: false } ));
      this.zone.runOutsideAngular( () => document.removeEventListener('mouseup', this.onMouseUp, <any>{ passive: true } ));
    }

    // Set the overlay to non-blocking again:
    this.viewRefs.overlay.nativeElement.style.display = 'none';
  }

  public onTouchEnd = (event: any) => {
    // console.log('PanZoomComponent: onTouchEnd()');
    this.onMouseUp(event);
  }

  public onDblClick = (event: any) => {
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

  public preventDefault = (event: any) => {
    event.preventDefault();
  }

  // Apply animations
  public animationTick = (timestamp = performance.now()) => {
    // console.log('PanZoomComponent: animationTick()');
    // timestamp looks like 76916.963.  The unit is milliseconds and should be accurate to 5 µs (microseconds)

    let deltaTime = 0;
    if (this.lastTick !== 0) {
      deltaTime = (timestamp - this.lastTick); // orig - milliseconds since the last animationTick
    }
    this.lastTick = timestamp;

    if (this.animationParams) {
      // when we're running an animation (but not waiting for a released drag to halt)
      // console.log('PanZoomComponent: animationTick(): model is zooming');

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

        const speed = this.length(this.panVelocity);

        if (speed <= this.config.haltSpeed) {
          this.panVelocity = undefined;
          this.dragFinishing = false;
          break;
        }

      }
    }

    if (this.config.keepInBounds || this.dragFinishing) {
      // Checks that keepInBounds is set and that the mouse button isn't pressed, and if so, it stops the contents from going out of view
      // console.log('PanZoomComponent: animationTick(): keepInBounds');
      const topLeftCornerView = this.getViewPosition({ x: 0, y: 0 });
      const bottomRightCornerView = this.getViewPosition({ x: this.viewRefsDimensions.zoom.width, y: this.viewRefsDimensions.zoom.height });
      if (topLeftCornerView.x > 0) {
        this.base.pan.x -= this.config.keepInBoundsRestoreForce * topLeftCornerView.x;
      }

      if (topLeftCornerView.y > 0) {
        this.base.pan.y -= this.config.keepInBoundsRestoreForce * topLeftCornerView.y;
      }

      if (bottomRightCornerView.x < this.viewRefsDimensions.zoom.width) {
        this.base.pan.x -= this.config.keepInBoundsRestoreForce * (bottomRightCornerView.x - this.viewRefsDimensions.zoom.width);
      }

      if (bottomRightCornerView.y < this.viewRefsDimensions.zoom.height) {
        this.base.pan.y -= this.config.keepInBoundsRestoreForce * (bottomRightCornerView.y - this.viewRefsDimensions.zoom.height);
      }
    }

    this.updateDOM();
    this.modelChanged.next(this.model);

    if ( this.animationParams || (this.panVelocity && this.dragFinishing) ) {
      // Is an animation active?  If so, run the next frame

      if (this.isChrome && this.zoomLevelIsChanging) {
        // run will-change toggle hack on Chrome to trigger re-rasterization
        // see https://developers.google.com/web/updates/2016/09/re-rastering-composite
        if (this.willChangeNextFrame) {
          this.viewRefs.zoom.nativeElement.style.willChange = 'auto';
        }
        else {
          this.viewRefs.zoom.nativeElement.style.willChange = 'transform';
        }
        this.willChangeNextFrame = !this.willChangeNextFrame;
      }
      this.animationFrameFunc(this.animationTick); // Call the next animation frame
    }

    else if (this.panVelocity && !this.dragFinishing) {
      // we're just mouse-panning the frame.  We don't need another tick
      return;
    }

    else {
      // Animation has ended
      if (this.model.isPanning) {
        this.model.isPanning = false;
        // this.panEnded.next(this.model.pan);
      }
      this.syncBaseToModel();
      this.modelChanged.next(this.model);
      this.scale = this.getCssScale(this.base.zoomLevel);
      this.willChangeNextFrame = true;
      this.viewRefs.zoom.nativeElement.style.willChange = 'transform';
      this.zoomLevelIsChanging = false;
      this.lastTick = 0;
    }
  }

  public updateDOM() {

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
        const bottomRightCornerView = this.getViewPosition({ x: this.viewRefsDimensions.zoom.width, y: this.viewRefsDimensions.zoom.height });

        if (topLeftCornerView.x > 0) {
          this.model.pan.x = 0;
        }

        if (topLeftCornerView.y > 0) {
          this.model.pan.y = 0;
        }

        if (bottomRightCornerView.x < this.viewRefsDimensions.zoom.width) {
          this.model.pan.x -= (bottomRightCornerView.x - this.viewRefsDimensions.zoom.width);
        }

        if (bottomRightCornerView.y < this.viewRefsDimensions.zoom.height) {
          this.model.pan.y -= (bottomRightCornerView.y - this.viewRefsDimensions.zoom.height);
        }
      }
    }

    // Apply scaling
    if (this.animationParams || this.isFirstSync) {
      const scale = this.getCssScale(this.model.zoomLevel);
      const scaleString = `scale(${scale})`;
      const zoomStyle = `transform-origin: 0 0; transform: ${scaleString};`;
      this.viewRefs.zoom.nativeElement.setAttribute('style', zoomStyle);
    }

    // Apply pan animation
    const translate3d = `translate3d(${this.model.pan.x}px, ${this.model.pan.y}px, 0)`;
    this.viewRefs.pan.nativeElement.style.transform = translate3d;
  }

  public freeZoom(clickPoint: Point, wheelDelta: number): void {
    // console.log('PanZoomComponent: freeZoom(): this.base:', this.base);

    if (this.isDragging) {
      // don't allow zooming if the mouse is down
      return;
    }

    // now handle interruption of an in-progress animation
    if (this.animationParams) {
      this.animationParams = undefined; // cancel an existing animation
    }

    if (this.panVelocity) {
      this.dragFinishing = false;
      this.panVelocity = undefined;
    }

    const currentPan: Point = {
      // the current model coordinates
      x: this.model.pan.x,
      y: this.model.pan.y
    };
    const currentScale = this.scale; // get the current CSS scale (scale0)

    let newScale = this.scale + (wheelDelta * this.config.freeMouseWheelFactor * this.scale);

    // takes either the minimum scale (furthest allowable zoomed out) or the calculated current scale, whichever is greater, unless calculated current scale exceeds maxScale (furthest allowable zoomed in), in which case maxScale is used
    newScale = Math.max(this.minScale, Math.min( this.maxScale, newScale ));
    this.scale = newScale;

    const targetPoint: Point = {
      // The target point to zoom to.  It must stay the same as the untranslated point
      x: clickPoint.x - (newScale / currentScale) * (clickPoint.x - currentPan.x),
      y: clickPoint.y - (newScale / currentScale) * (clickPoint.y - currentPan.y)
    };

    // Apply Pan & Scale
    const translate3d = `translate3d(${targetPoint.x}px, ${targetPoint.y}px, 0)`;
    this.viewRefs.pan.nativeElement.style.transform = translate3d;

    const scaleString = `scale(${this.scale})`;
    let zoomStyle = `transform-origin: 0 0; transform: ${scaleString};`;
    if (this.isChrome) {
      if (this.willChangeNextFrame) {
        zoomStyle += ` will-change: auto;`;
      }
      else {
        zoomStyle += ` will-change: transform;`;
      }
      this.willChangeNextFrame = !this.willChangeNextFrame;
    }

    // apply zoom css
    this.viewRefs.zoom.nativeElement.setAttribute('style', zoomStyle);

    this.model.pan.x = targetPoint.x;
    this.model.pan.y = targetPoint.y;
    this.model.zoomLevel = this.getZoomLevel(this.scale);
    this.modelChanged.next(this.model);
    this.syncBaseToModel();
  }

  public isMobileDevice(): boolean {
    return (typeof window.orientation !== 'undefined') || (navigator.userAgent.indexOf('IEMobile') !== -1);
  }

  public syncBaseToModel() {
    this.base.pan.x = this.model.pan.x;
    this.base.pan.y = this.model.pan.y;
    this.base.zoomLevel = this.model.zoomLevel;
  }

  public length(vector2d: any) {
    // console.log('PanZoomComponent: length()');
    return Math.sqrt(vector2d.x * vector2d.x + vector2d.y * vector2d.y);
  }

  public getCentrePoint(): Point {
    // console.log('PanZoomComponent: getCentrePoint()');
    return {
      x: this.viewRefs.frame.nativeElement.offsetWidth / 2,
      y: this.viewRefs.frame.nativeElement.offsetHeight / 2
    };
  }

  public getCssScale(zoomLevel: any): number {
    // console.log('PanZoomComponent: getCssScale()');
    return Math.pow(this.config.scalePerZoomLevel, zoomLevel - this.config.neutralZoomLevel);
  }

  public getZoomLevel(cssScale: any) {
    // console.log('PanZoomComponent: getZoomLevel()');
    return Math.log10(cssScale) / Math.log10(this.config.scalePerZoomLevel) + this.config.neutralZoomLevel;
  }

  public calcZoomToFit(rect: Rect): PanZoomModel {
    // console.log('PanZoomComponent: calcZoomToFit(): rect:', rect);
    // let (W, H) denote the size of the viewport
    // let (w, h) denote the size of the rectangle to zoom to
    // then we must CSS scale by the min of W/w and H/h in order to just fit the rectangle
    // returns the target left and top coordinates for the panElement and target zoomLevel

    const viewportWidth = this.viewRefs.frame.nativeElement.offsetWidth;
    const viewportHeight = this.viewRefs.frame.nativeElement.offsetHeight;

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

  public zoomToFitModel(target: PanZoomModel, duration: number = undefined) {
    // console.log('PanZoomComponent: zoomToFitModel(): target:', target);

    // target.pan.x is the panElement left style property
    // target.pan.y is the panElement top style property
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }

  public zoomToLevelAndPoint(level: number, clickPoint: Point) {
    // console.log('PanZoomComponent: zoomToLevelAndPoint(): level:', level);
    // console.log('PanZoomComponent: zoomToLevelAndPoint(): clickPoint:', clickPoint);
    this.changeZoomLevel( level, clickPoint );
  }

  public zoomIn(zoomType: ZoomType = 'lastPoint') {
    // console.log('PanZoomComponent: zoomIn()');
    if (zoomType === 'lastPoint') {
      this.changeZoomLevel( this.base.zoomLevel + this.config.zoomButtonIncrement, this.lastClickPoint );
    }
    else if (zoomType === 'viewCenter') {
      this.changeZoomLevel( this.base.zoomLevel + this.config.zoomButtonIncrement, this.getCentrePoint() );
    }

  }

  public zoomOut(zoomType: ZoomType = 'lastPoint') {
    // console.log('PanZoomComponent: zoomOut()');
    if (zoomType === 'lastPoint') {
      this.changeZoomLevel( this.base.zoomLevel - this.config.zoomButtonIncrement, this.lastClickPoint );
    }
    else if (zoomType === 'viewCenter') {
      this.changeZoomLevel( this.base.zoomLevel - this.config.zoomButtonIncrement, this.getCentrePoint() );
    }
  }

  public startAnimation() {
    this.lastTick = performance.now();
    this.zone.runOutsideAngular( () => this.animationId = this.animationFrameFunc(this.animationTick) );
  }

  public getFrameElementOffset(): Offset {
    const rect = this.viewRefs.frame.nativeElement.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX
    };
  }

  // callback for ResizeObserver
  public onContentDimensionsChangeDetected(entries: any[]) {
    this.viewRefsDimensions.zoom.height = entries[0].contentRect.height;
    this.viewRefsDimensions.zoom.width = entries[0].contentRect.width;
  }

  public getViewPosition(modelPosition: Point): Point {
    // console.log('PanZoomComponent: getViewPosition()');
    // p' = p * s + t
    // viewPosition = modelPosition * scale + basePan

    let scale, translation;

    if (this.animationParams) {
      scale = this.getCssScale(this.base.zoomLevel + this.animationParams.deltaZoomLevel * this.animationParams.progress);
      let deltaTranslation = this.animationParams.panStepFunc(this.model.zoomLevel);
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

  public getModelPosition(viewPosition: Point): Point {
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

  public resetView() {
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
      // console.log('config.initialZoomLevel: ' + this.config.initialZoomLevel);
      // console.log('config.initialPanX: ' + this.config.initialPanX);
      // console.log('config.initialPanY: ' + this.config.initialPanY);
    }
  }

  public zoomToFit(rectangle: Rect, duration?: number) {
    // console.log('PanZoomComponent: zoomToFit(): rectangle', rectangle);

    // when a user clicks a zoom to fit button
    // example rectangle: { "x": 0, "y": 100, "width": 100, "height": 100 }

    const target: PanZoomModel = this.calcZoomToFit(rectangle);
    // target.pan.x is the panElement left style property
    // target.pan.y is the panElement top style property
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }

  public zoomInToPoint(clickPoint: Point) {
    // console.log('PanZoomComponent: zoomIn(): clickPoint:', clickPoint);
    this.changeZoomLevel( this.base.zoomLevel + this.config.zoomButtonIncrement, clickPoint );
  }

  public zoomOutFromPoint(clickPoint: Point) {
    // console.log('PanZoomComponent: zoomOut()');
    this.changeZoomLevel( this.base.zoomLevel - this.config.zoomButtonIncrement, clickPoint );
  }

  public panToPoint(point: Point, duration?: number) {
    // console.log('PanZoomComponent: panToPoint(): point:', point);

    // API call to animate the view so that the centre point of the view is at the
    // point parameter coordinates, relative to the original, unzoomed
    // content width and height
    // example point: { "x": 0, "y": 0 } // makes the top-left corner of the content
    // the centre of the view

    const target: PanZoomModel = {
      pan: {
        x: (this.viewRefsDimensions.frame.width / 2) - point.x * this.scale,
        y: (this.viewRefsDimensions.frame.height / 2) - point.y * this.scale
      },
      zoomLevel: this.base.zoomLevel
    };

    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }

  public panToPointCurrentScale(point: Point, duration?: number) {
    // console.log('PanZoomComponent: panToPoint(): point:', point);

    // API call to animate the view so that the centre point of the view is at the
    // point parameter coordinates, relative to the original, unzoomed
    // content width and height
    // example point: { "x": 0, "y": 0 } // makes the top-left corner of the content
    // the centre of the view

    const target: PanZoomModel = {
      pan: {
        x: (this.viewRefsDimensions.frame.width / 2) - point.x,
        y: (this.viewRefsDimensions.frame.height / 2) - point.y
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }

  public panDelta(delta: Point, duration?: number) {
    // console.log('PanZoomComponent: panDelta(): delta:', delta);

    // API call to pan the view left, right, up, or down, based on a number of pixels
    // of the original, unzoomed content.
    // Positive is right and down
    // Negative is left and up
    // example point: { "x": 100, "y": -50 } // moves the view right 50px and up 50px

    const target: PanZoomModel = {
      pan: {
        x: this.base.pan.x - this.scale * delta.x,
        y: this.base.pan.y - this.scale * delta.y
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }

  public panDeltaAbsolute(delta: Point, duration?: number) {
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

  public panDeltaPercent(deltaPercent: Point, duration?: number) {
    // console.log('PanZoomComponent: panDeltaPercent(): deltaPercent:', deltaPercent);

    // API call to pan the view up, down, left, or right, based on a percentage
    // of the original, unzoomed content width and height
    // example point: { "x": 10, "y": -20 }

    let deltaX = 0;
    let deltaY = 0;
    if (deltaPercent.x !== 0) {
      deltaX = this.viewRefsDimensions.zoom.width * ( deltaPercent.x / 100 ) * this.scale;
    }
    if (deltaPercent.y !== 0) {
      deltaY = this.viewRefsDimensions.zoom.height * ( deltaPercent.y / 100 ) * this.scale;
    }

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

  public centerContent(duration?: number) {
    this.panToPoint( {
      x: this.viewRefsDimensions.zoom.width / 2,
      y: this.viewRefsDimensions.zoom.height / 2
    },
    duration);
  }

  public centerX(duration?: number) {
    const target: PanZoomModel = {
      pan: {
        x: (this.viewRefsDimensions.frame.width / 2) - (this.viewRefsDimensions.zoom.width / 2) * this.scale,
        y: this.base.pan.y
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }

  public centerY(duration?: number) {
    const target: PanZoomModel = {
      pan: {
        x: this.base.pan.x,
        y: (this.frameHeight / 2) - (this.viewRefsDimensions.zoom.height / 2) * this.scale
      },
      zoomLevel: this.base.zoomLevel
    };
    this.model.isPanning = true;
    this.animateToTarget(target, duration);
  }

  public centerTopLeftCorner(duration?: number) {
    this.panToPoint( {
      x: 0,
      y: 0
    },
    duration);
  }

  public centerBottomLeftCorner(duration?: number) {
    this.panToPoint( {
      x: 0,
      y: this.viewRefsDimensions.zoom.height
    },
    duration);
  }

  public centerTopRightCorner(duration?: number) {
    this.panToPoint( {
      x: this.viewRefsDimensions.zoom.width,
      y: 0
    },
    duration);
  }

  public centerBottomRightCorner(duration?: number) {
    this.panToPoint( {
      x: this.viewRefsDimensions.zoom.width,
      y: this.viewRefsDimensions.zoom.height
    },
    duration);
  }

  public updateContentDimensions(width?: number, height?: number) {
    if (height !== undefined) {
      this.viewRefsDimensions.zoom.height = height;
    }
    if (width !== undefined) {
      this.viewRefsDimensions.zoom.width = width;
    }
  }

  // Animation builders
  public animateToTarget(targetModel: PanZoomModel, duration = undefined) {
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

    this.model.pan.x = this.base.pan.x || 0;
    this.model.pan.y = this.base.pan.y || 0;

    const panStepFunc = (zoomLevel: number) => {
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
    duration = duration ? duration * 1000 : this.config.zoomStepDuration * 1000;
    this.animationParams = {
      deltaZoomLevel: deltaZoomLevel, // how many zooom levels to zoom in or out
      panStepFunc: panStepFunc, // a function which runs on every animation tick, which calcs how much to pan the view on every frame
      duration, // how long the animation should take
      progress: 0.0
    };

    this.startAnimation();
  }

  public changeZoomLevel(newZoomLevel: number, clickPoint: Point) {
    // console.log('PanZoomComponent: changeZoomLevel()');

    if (this.animationParams) {
      // let's let any current animation just finish
      return;
    }

    this.zoomLevelIsChanging = true;

    // keep zoom level in bounds
    newZoomLevel = Math.max(this.minimumAllowedZoomLevel, newZoomLevel);
    newZoomLevel = Math.min(this.config.zoomLevels - 1, newZoomLevel);
    // console.log('newZoomLevel:', newZoomLevel);

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
      panStepFunc: panStepFunc,
      duration: this.config.zoomStepDuration * 1000, // how long the animation should take
      progress: 0.0
    };
    this.startAnimation();
  }
}