import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  viewChild,
  NgZone,
  model,
  effect,
  input,
  output
} from '@angular/core';
import {
  getIsMouseEvent,
  getIsTouchEvent,
  assertIsNonNullable,
  isTouchDevice,
  isParentElement,
  length,
  preventDefault
} from './utils';
import {
  Rect,
  Point,
  Offset,
  ZoomAnimation,
  Position,
  EventListenerExtOptions,
  PanZoomModel,
  PanZoomConfigSignalOptions,
  ZoomType
} from './types';

@Component({
    selector: 'pan-zoom, ngx-pan-zoom, ngx-panzoom',
    // we don't want to kill change detection for all elements beneath this, so we don't set OnPush.  Child views can implement OnPush if the developer wants to.  We can get away with this because the 'wheel' event handler runs outside of Angular, therefore it doesnt trigger change detection.
    templateUrl: './panzoom.component.html',
    styleUrls: ['./panzoom.component.css'],
    standalone: true
})
export class PanZoomComponent implements OnInit, AfterViewInit, OnDestroy, PanZoomConfigSignalOptions {
  constructor (private zone: NgZone) {}
  
  private readonly frameElementRef = viewChild.required<ElementRef>('frameElement');
  private readonly panElementRef = viewChild.required<ElementRef>('panElement');
  private readonly zoomElementRef = viewChild.required<ElementRef>('zoomElement');
  private readonly panzoomOverlayRef = viewChild.required<ElementRef>('panzoomOverlay');

  readonly zoomLevels = input(5);
  readonly neutralZoomLevel = input(2);
  readonly scalePerZoomLevel = input(2.0);
  readonly initialZoomLevel = input(this.neutralZoomLevel());
  readonly friction = input(10.0);
  readonly haltSpeed = input(100.0);
  readonly initialPanX = input(0);
  readonly initialPanY = input(0);
  readonly initialZoomToFit = input<Rect>();
  readonly keepInBounds = input(false);
  readonly keepInBoundsDragPullback = input(0.7);
  readonly keepInBoundsRestoreForce = input(0.5);
  readonly panOnClickDrag = input(true);
  readonly dragMouseButton = input<'left' | 'middle' | 'right'>('left'); // left, middle, right
  readonly zoomButtonIncrement = input(1.0);
  readonly zoomOnDoubleClick = input(true);
  readonly zoomOnMouseWheel = input(true);
  readonly invertMouseWheel = input(false);
  readonly zoomStepDuration = input(0.2);
  readonly zoomToFitZoomLevelFactor = input(0.95);
  readonly freeMouseWheel = input(true);
  readonly freeMouseWheelFactor = input(0.08);
  readonly noDragFromElementClass = input<string | undefined>();
  readonly acceleratePan = input(true);
  readonly dynamicContentDimensions = input(false);
  readonly model = model<PanZoomModel>(undefined!); // this is used for incremental changes to the pan/zoom view during each animation frame.  Setting it will update the pan/zoom coordinates on the next call to updateDOM().  Not used during mouse drag.

  private base: PanZoomModel; // this is what the pan/zoom view is before a zoom animation begins and after it ends.  It also updates with every mouse drag or freeZoom, but the animation is mostly tied to the model.
  private contentHeight: number;
  private contentWidth: number;
  private frameHeight: number;
  private frameWidth: number;
  private lastMouseEventTime: number;
  private previousPosition: Position;
  private isDragging = false;
  private panVelocity?: Point;
  private animationParams?: ZoomAnimation;
  private animationFrameFunc = window.requestAnimationFrame; // reference to the appropriate getAnimationFrame function for the client browser
  private lastTick = 0;
  private isChrome = false;
  private willChangeNextFrame = true; // used for scaling in Chrome
  private animationId: number;
  private isMobile = isTouchDevice();
  private scale: number;
  private isFirstSync = true;
  private lastClickPoint: Point;
  private zoomLevelIsChanging = false;
  private dragFinishing = false;
  private dragMouseButtonNum: number;
  private maxScale: number; // the highest scale (furthest zoomed in) that we will allow in free zoom mode (calculated)
  private minScale: number; // the smallest scale (furthest zoomed out) that we will allow in free zoom mode (calculated)
  private minimumAllowedZoomLevel: number;
  private resizeObserver: ResizeObserver;

  keepInBoundsWarningDestroy = effect(
    () => {
      const keepInBounds = this.keepInBounds();
      const neutralZoomLevel = this.neutralZoomLevel();
      if (keepInBounds && neutralZoomLevel) {
        console.warn(`You have set keepInBounds to true and neutralZoomLevel to ${neutralZoomLevel}. Be aware that the zoom level cannot go below ${neutralZoomLevel}`);
      }
    }
  );


  ngOnInit(): void {
    const {
      keepInBounds,
      acceleratePan,
      freeMouseWheel,
      zoomLevels,
      initialZoomLevel,
      neutralZoomLevel,
      dragMouseButton,
      initialZoomToFit,
      initialPanX,
      initialPanY
    } = this;
    this.base = initialZoomToFit()
      ? this.calcZoomToFit(initialZoomToFit()!)
      : {
        zoomLevel: initialZoomLevel(),
        pan: {
          x: initialPanX(),
          y: initialPanY()
        }
      };
    this.updateModel({
      zoomLevel: this.base.zoomLevel,
      isPanning: false, // Only true if panning is actually taking place, not just after mousedown
      pan: {
        x: this.base.pan.x,
        y: this.base.pan.y
      }
    });
    if (freeMouseWheel()) {
      this.scale = this.getCssScale(initialZoomLevel());
      const maxZoomLevel = zoomLevels() - 1;
      this.maxScale = this.getCssScale(maxZoomLevel);
      this.minScale = this.getCssScale(0);
    }
    this.minimumAllowedZoomLevel = 0;
    if (keepInBounds()) {
      this.minimumAllowedZoomLevel = neutralZoomLevel();
      this.minScale = this.getCssScale(neutralZoomLevel());
    }
    this.zoomElementRef().nativeElement.style.willChange = 'transform';
    if (navigator.userAgent.search('Chrome') >= 0) {
      this.isChrome = true;
      this.zoomElementRef().nativeElement.style.transform = 'translateZ(0)';
    }
    if (acceleratePan()) {
      this.panElementRef().nativeElement.style.willChange = 'transform';
      if (navigator.userAgent.search('Chrome') >= 0) {
        this.isChrome = true;
        this.panElementRef().nativeElement.style.transform = 'translateZ(0)';
      }
    }
    this.animationTick();
    this.scale = this.getCssScale(this.base.zoomLevel);
    this.isFirstSync = false;
    switch (dragMouseButton()) {
      case 'left':
        this.dragMouseButtonNum = 0;
        break;
      case 'middle':
        this.dragMouseButtonNum = 1;
        this.zone.runOutsideAngular(
          () => {
            this.frameElementRef().nativeElement.addEventListener('auxclick', preventDefault);
          }
        );
        break;
      case 'right':
        this.zone.runOutsideAngular(
          () => {
            document.addEventListener('contextmenu', preventDefault);
          }
        );
        this.dragMouseButtonNum = 2;
        break;
      default:
        this.dragMouseButtonNum = 0; // left
    }
  }


  ngAfterViewInit(): void {
    this.detectContentDimensions();
    const frameStyle = getComputedStyle(this.frameElementRef().nativeElement);
    this.frameHeight = parseInt(
      frameStyle.getPropertyValue('height').split('px')[0]
    );
    this.frameWidth = parseInt(
      frameStyle.getPropertyValue('width').split('px')[0]
    );
    if (this.dynamicContentDimensions()) {
      if (window.ResizeObserver) {
        this.resizeObserver = new window.ResizeObserver(
          (entries) => this.onContentDimensionsChangeDetected(entries)
        );
        this.zone.runOutsideAngular(
          () => this.resizeObserver.observe(this.zoomElementRef().nativeElement)
        );
      }
      else {
        console.error('ResizeObserver API is not supported by this browser.  See https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver for info on browser compatibility.');
      }
    }
    this.zone.runOutsideAngular(
      () => {
        if (this.isMobile) {
          this.frameElementRef().nativeElement.addEventListener('touchstart', this.onTouchStart);
        }
        this.frameElementRef().nativeElement.addEventListener('mousedown', this.onMouseDown);
        this.frameElementRef().nativeElement.addEventListener('dblclick', this.onDblClick );
        this.frameElementRef().nativeElement.addEventListener(
          'wheel',
          (event: WheelEvent) => this.animationFrameFunc(
            () => this.onMouseWheel(event)
          ),
          { passive: true }
        );

      }
    );
  }


  ngOnDestroy(): void {
    if (this.isMobile) {
      this.frameElementRef().nativeElement.removeEventListener('touchstart', this.onTouchStart);
    }
    this.frameElementRef().nativeElement.removeEventListener('mousedown', this.onMouseDown);
    this.frameElementRef().nativeElement.removeEventListener(
      'wheel',
      (event: WheelEvent) => this.animationFrameFunc(
        () => this.onMouseWheel(event)
      ),
      { passive: true }
    );
    this.frameElementRef().nativeElement.removeEventListener('dblclick', this.onDblClick);
    if (this.animationId) {
      window.cancelAnimationFrame(this.animationId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    switch (this.dragMouseButton()) {
      case 'middle':
        this.dragMouseButtonNum = 1;
        this.zone.runOutsideAngular(
          () => {
            this.frameElementRef().nativeElement.removeEventListener('auxclick', preventDefault);
          }
        );
        break;
      case 'right':
        this.zone.runOutsideAngular(
          () => {
            document.removeEventListener('contextmenu', preventDefault);
          }
        );
        this.dragMouseButtonNum = 2;
        break;
    }
  }


  // Event Handlers
  private onMouseWheel = (event: WheelEvent) => {
    if (!(event && event.pageX && event.pageY)) {
      return;
    }
    let deltaY = event.deltaY;
    if (this.zoomOnMouseWheel()) {
      if (this.animationParams) {
        return; // already zooming
      }
      if (!this.invertMouseWheel()) {
        deltaY = -deltaY;
      }
      const frameElementOffset = this.getFrameElementOffset();
      const clickPoint: Point = {
        x: event.pageX - frameElementOffset.left,
        y: event.pageY - frameElementOffset.top
      };
      this.lastClickPoint = clickPoint;
      if (this.freeMouseWheel()) {
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


  private onMouseDown = (event: MouseEvent | TouchEvent) => {
    /* Check if clicked location is inside element from which
       dragging is prevented. */
    const noDrag = this.noDragFromElementClass() && event.target && isParentElement(this.noDragFromElementClass()!, event.target);
    if (noDrag) {
      return;
    }
    const isMouseEvent = getIsMouseEvent(event);
    const isTouchEvent = getIsTouchEvent(event);
    if ((isMouseEvent && event.button === this.dragMouseButtonNum) || isTouchEvent) {
      if (isMouseEvent) {
        event.preventDefault();
      }
      this.dragFinishing = false;
      this.panVelocity = undefined;
      if (this.panOnClickDrag()) {
        if (isMouseEvent) {
          this.previousPosition = {
            x: event?.pageX,
            y: event.pageY
          };
        }
        else if (isTouchEvent) {
          this.previousPosition = {
            x: event.changedTouches[0].pageX,
            y: event.changedTouches[0].pageY
          };
        }
        this.lastMouseEventTime = event.timeStamp;
        this.isDragging = true;
        this.updateModelProp('isPanning', false);
        this.zone.runOutsideAngular(
          () => {
            if (this.isMobile) {
              document.addEventListener('touchend', this.onTouchEnd, false);
              document.addEventListener('touchmove', this.onTouchMove, { passive: true, capture: false })
            }
            document.addEventListener('mousemove', this.onMouseMove, { passive: true, capture: false });
            document.addEventListener('mouseup', this.onMouseUp);
          }
        ); // leave this on document
      }
      return false;
    }
  }


  private onTouchStart = (event: TouchEvent) => {
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
    this.onMouseDown(event);
  }


  private onMouseMove = (event: MouseEvent | TouchEvent) => {
    // timestamp - 10587.879999999132 - milliseconds
    // Called when moving the mouse with the left button down
    const isMouseEvent = getIsMouseEvent(event);
    const isTouchEvent = getIsTouchEvent(event);
    let evWrap: { pageX: number, pageY: number };
    if (isMouseEvent && event.pageX && event.pageY) {
      evWrap = event;
    }
    else if (isTouchEvent && event.touches[0].pageX && event.touches[0].pageY) {
      evWrap = { 
        pageX: event.touches[0].pageX,
        pageY: event.touches[0].pageY
      }
    }
    else {
      return;
    }
    const now = event.timeStamp;
    const timeSinceLastMouseEvent = (now - this.lastMouseEventTime) / 1000;
    this.lastMouseEventTime = now;
    const dragDelta = {
      // a representation of how far each coordinate has moved since the last time it was moved
      x: evWrap.pageX - this.previousPosition.x!,
      y: evWrap.pageY - this.previousPosition.y!
    };
    if (this.keepInBounds()) {
      const topLeftCornerView = this.getViewPosition( { x: 0, y: 0 } );
      const bottomRightCornerView = this.getViewPosition( { x: this.contentWidth, y: this.contentHeight } );
      if (topLeftCornerView.x > 0 && dragDelta.x > 0) {
        dragDelta.x *= Math.min(
          1,
          Math.pow(topLeftCornerView.x, -this.keepInBoundsDragPullback())
        );
      }
      if (topLeftCornerView.y > 0 && dragDelta.y > 0) {
        dragDelta.y *= Math.min(
          1,
          Math.pow(topLeftCornerView.y, -this.keepInBoundsDragPullback())
        );
      }
      if (bottomRightCornerView.x < this.contentWidth && dragDelta.x < 0) {
        dragDelta.x *= Math.min(
          1,
          Math.pow(this.contentWidth - bottomRightCornerView.x, -this.keepInBoundsDragPullback())
        );
      }
      if (bottomRightCornerView.y < this.contentHeight && dragDelta.y < 0) {
        dragDelta.y *= Math.min(
          1,
          Math.pow(this.contentHeight - bottomRightCornerView.y, -this.keepInBoundsDragPullback())
        );
      }
    }
    // now pan the view
    const delta: Point = {
      x: dragDelta.x ?? 0,
      y: dragDelta.y ?? 0
    };
    const panX = this.model().pan.x + delta.x;
    const panY = this.model().pan.y + delta.y
    this.updateModelPan({
      x: panX,
      y: panY
    });
    this.syncBaseFromModel();
    this.animationTick();
    if (!this.model().isPanning) {
      // This will improve the performance,
      // because the browser stops evaluating hits against the elements displayed inside the pan zoom view.
      // Besides this, mouse events will not be sent to any other elements,
      // this prevents issues like selecting elements while dragging.
      this.panzoomOverlayRef().nativeElement.style.display = 'block';
    }
    this.updateModelProp('isPanning', true);
    // set these for the animation slow down once drag stops
    // panVelocity is a measurement of speed for x and y coordinates, in pixels per mouse move event.  It is a measure of how fast the mouse is moving
    const panVelocityX = dragDelta.x / timeSinceLastMouseEvent;
    const panVelocityY = dragDelta.y / timeSinceLastMouseEvent;
    this.panVelocity = {
      x: Number.isFinite(panVelocityX)
        ? panVelocityX
        : 0,
      y: Number.isFinite(panVelocityY)
        ? panVelocityY
        : 0
    };
    this.previousPosition = {
      x: evWrap.pageX,
      y: evWrap.pageY
    };
  }


  private onTouchMove = (event: TouchEvent) => {
    const { touches } = event;
    if (touches.length === 1) {
      // single touch, emulate mouse move
      this.onMouseMove(event);
      return;
    }
    // multiple touches, zoom in/out
    // Calculate x and y distance between touch events
    const x = touches[0].pageX - touches[1].pageX;
    const y = touches[0].pageY - touches[1].pageY;
    // Calculate length between touch points with pythagoras
    // There is no reason to use Math.pow and Math.sqrt as we
    // only want a relative length and not the exact one.
    const length = x * x + y * y;
    // Calculate delta between current position and last position
    const delta = length - (this.previousPosition.length ?? 0);
    // Naive hysteresis
    if (Math.abs(delta) < 100) {
      return;
    }
    // Calculate center between touch points
    const centerX = touches[1].pageX + x / 2;
    const centerY = touches[1].pageY + y / 2;
    // Calculate zoom center
    const frameElementOffset = this.getFrameElementOffset();
    const clickPoint = {
      x: centerX - frameElementOffset.left,
      y: centerY - frameElementOffset.top
    };
    this.lastClickPoint = clickPoint;
    this.animateChangeZoomLevel(
      this.base.zoomLevel + delta * 0.0001,
      clickPoint
    );
    // Update length for next move event
    this.previousPosition = {
      length: length
    };
  }


  private onMouseUp = (event: MouseEvent | TouchEvent) => {
    const isMouseEvent = getIsMouseEvent(event);
    if (isMouseEvent && event.button !== this.dragMouseButtonNum) {
      return;
    }
    if (isMouseEvent) {
      event.preventDefault();
    }
    const now = event.timeStamp;
    const timeSinceLastMouseEvent = (now - this.lastMouseEventTime) / 1000;
    const applyDampening = this.panVelocity && (this.panVelocity.x !== 0 || this.panVelocity.y !== 0);
    if (applyDampening) {
      // apply strong initial dampening if the mouse up occured much later than the last mouse move, indicating that the mouse hasn't moved recently
      // TBD - experiment with this formula
      const initialMultiplier = Math.max(
        0,
        -0.2 + Math.pow(timeSinceLastMouseEvent + 1, -4)
      );
      assertIsNonNullable(this.panVelocity);
      this.panVelocity.x *= initialMultiplier;
      this.panVelocity.y *= initialMultiplier;
      this.dragFinishing = true;
      this.zone.runOutsideAngular(
        () => {
          this.animationId = this.animationFrameFunc(this.animationTick)
        }
      );
    }
    else {
      this.panVelocity = undefined;
      this.dragFinishing = false;
      this.updateModelProp('isPanning', false);
      this.syncBaseFromModel();
    }
    this.isDragging = false;
    this.zone.runOutsideAngular(
      () => {
        if (this.isMobile) {
          document.removeEventListener('touchend', this.onTouchEnd);
          document.removeEventListener(
            'touchmove',
            this.onTouchMove,
            { passive: true, capture: false } as EventListenerExtOptions
          );
        }
        document.removeEventListener(
          'mousemove',
          this.onMouseMove,
          { passive: true, capture: false } as EventListenerExtOptions
        );
        document.removeEventListener(
          'mouseup',
          this.onMouseUp,
          { passive: true } as EventListenerExtOptions
        );
      }
    );
    // Set the overlay to non-blocking again:
    this.panzoomOverlayRef().nativeElement.style.display = 'none';
  }


  private onTouchEnd = (event: TouchEvent) => {
    this.onMouseUp(event);
  }


  private onDblClick = (event: MouseEvent) => {
    event.preventDefault();
    if (!this.zoomOnDoubleClick()) {
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


  // Apply Animations
  private animationTick = (timestamp = performance.now()) => {
    // timestamp looks like 76916.963.  The unit is milliseconds and should be accurate to 5 µs (microseconds)
    let deltaTime = 0;
    if (this.lastTick !== 0) {
      deltaTime = (timestamp - this.lastTick); // orig - milliseconds since the last animationTick
    }
    this.lastTick = timestamp;
    if (this.animationParams) {
      // when we're running an animation (but not waiting for a released drag to halt)
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
        const panX = this.model().pan.x + this.panVelocity.x * dTime;
        const panY = this.model().pan.y + this.panVelocity.y * dTime;
        this.updateModelPan({
          x: panX,
          y: panY
        });
        this.panVelocity.x = this.panVelocity.x * (1 - this.friction() * dTime);
        this.panVelocity.y = this.panVelocity.y * (1 - this.friction() * dTime);
        const speed = length(this.panVelocity);
        if (speed <= this.haltSpeed()) {
          this.panVelocity = undefined;
          this.dragFinishing = false;
          break;
        }
      }
    }
    if (this.keepInBounds() || this.dragFinishing) {
      // Checks that keepInBounds is set and that the mouse button isn't pressed, and if so, it stops the contents from going out of view
      const topLeftCornerView = this.getViewPosition({ x: 0, y: 0 });
      const bottomRightCornerView = this.getViewPosition({ x: this.contentWidth, y: this.contentHeight });
      if (topLeftCornerView.x > 0) {
        this.base.pan.x -= this.keepInBoundsRestoreForce() * topLeftCornerView.x;
      }
      if (topLeftCornerView.y > 0) {
        this.base.pan.y -= this.keepInBoundsRestoreForce() * topLeftCornerView.y;
      }
      if (bottomRightCornerView.x < this.contentWidth) {
        this.base.pan.x -= this.keepInBoundsRestoreForce() * (bottomRightCornerView.x - this.contentWidth);
      }
      if (bottomRightCornerView.y < this.contentHeight) {
        this.base.pan.y -= this.keepInBoundsRestoreForce() * (bottomRightCornerView.y - this.contentHeight);
      }
    }
    this.updateDOM();
    const animationActive = this.animationParams || (this.panVelocity && this.dragFinishing);
    if (animationActive) {
      // Run the next frame
      const toggleWillChange = this.isChrome && this.zoomLevelIsChanging;
      if (toggleWillChange) {
        // run will-change toggle hack on Chrome to trigger re-rasterization
        // see https://developers.google.com/web/updates/2016/09/re-rastering-composite
        this.zoomElementRef().nativeElement.style.willChange = this.willChangeNextFrame
          ? 'auto'
          : 'transform';
        this.willChangeNextFrame = !this.willChangeNextFrame;
      }
      this.animationFrameFunc(this.animationTick); // Call the next animation frame
      return;
    }
    else if (this.panVelocity && !this.dragFinishing) {
      // we're just mouse-panning the frame.  We don't need another tick
      return;
    }
    // Animation has ended
    if (this.model().isPanning) {
      this.updateModelProp('isPanning', false);
    } 
    this.syncBaseFromModel();
    this.scale = this.getCssScale(this.base.zoomLevel);
    this.willChangeNextFrame = true;
    this.zoomElementRef().nativeElement.style.willChange = 'transform';
    this.zoomLevelIsChanging = false;
    this.lastTick = 0;
  }


  private updateDOM() {
    // Called by ngAfterViewInit() and animationTick()
    // This function does not get called by freeZoom(), which operates independently of animationTick() and updateDOM().
    if (this.animationParams) {
      // we're running an animation sequence (but not freeZooming or panning with onMouseMove() )
      this.updateModelProp(
        'zoomLevel',
        this.base.zoomLevel + this.animationParams.deltaZoomLevel * this.animationParams.progress // calculate how far we need to zoom in or out for the current animationTick
      );
      const deltaTranslation = this.animationParams.panStepFunc(this.model().zoomLevel); // calculate how far to pan the view to based on our translated coordinates
      // sync the model pan coordinates to our translated pan coordinates
      // we do this by adding how far we want to move in each direction to our our existing base pan coordinates (where we started)
      let panX = this.base.pan.x + deltaTranslation.x;
      let panY = this.base.pan.y + deltaTranslation.y;
      if (this.keepInBounds()) {
        const topLeftCornerView = this.getViewPosition({ x: 0, y: 0 });
        const bottomRightCornerView = this.getViewPosition({ x: this.contentWidth, y: this.contentHeight });
        if (topLeftCornerView.x > 0) {
          panX = 0;
        }
        if (topLeftCornerView.y > 0) {
          panY = 0;
        }
        if (bottomRightCornerView.x < this.contentWidth) {
          panX -= (bottomRightCornerView.x - this.contentWidth);
        }
        if (bottomRightCornerView.y < this.contentHeight) {
          panY -= (bottomRightCornerView.y - this.contentHeight);
        }
      }
      this.updateModelPan({
        x: panX,
        y: panY
      });
    }
    if (this.animationParams || this.isFirstSync) {
      // Apply scaling
      const scale = this.getCssScale(this.model().zoomLevel);
      const scaleString = `scale(${scale})`;
      const zoomStyle = `transform-origin: 0 0; transform: ${scaleString};`;
      this.zoomElementRef().nativeElement.setAttribute('style', zoomStyle);
    }
    // Apply pan animation
    const translate3d = `translate3d(${this.model().pan.x}px, ${this.model().pan.y}px, 0)`;
    this.panElementRef().nativeElement.style.transform = translate3d;
  }


  private freeZoom(clickPoint: Point, wheelDelta: number): void {
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
      x: this.model().pan.x,
      y: this.model().pan.y
    };
    const currentScale = this.scale; // get the current CSS scale (scale0)
    let newScale = this.scale + (wheelDelta * this.freeMouseWheelFactor() * this.scale);
    // takes either the minimum scale (furthest allowable zoomed out) or the calculated current scale, whichever is greater, unless calculated current scale exceeds maxScale (furthest allowable zoomed in), in which case maxScale is used
    newScale = Math.max(
      this.minScale,
      Math.min(
        this.maxScale,
        newScale
      )
    );
    this.scale = newScale;
    const targetPoint: Point = {
      // The target point to zoom to.  It must stay the same as the untranslated point
      x: clickPoint.x - (newScale / currentScale) * (clickPoint.x - currentPan.x),
      y: clickPoint.y - (newScale / currentScale) * (clickPoint.y - currentPan.y)
    };
    // Apply Pan & Scale
    const translate3d = `translate3d(${targetPoint.x}px, ${targetPoint.y}px, 0)`;
    this.panElementRef().nativeElement.style.transform = translate3d;
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
    this.zoomElementRef().nativeElement.setAttribute('style', zoomStyle);
    this.updateModelProp('zoomLevel', this.getZoomLevel(this.scale));
    this.updateModelPan({
      x: targetPoint.x,
      y: targetPoint.y
    });
    this.syncBaseFromModel();
  }


  // Helper methods
  private updateModel(model: PanZoomModel) {
    this.zone.run(
      () => {
        this.model.update(
          () => ({...model})
        );
      }
    );
  }
  
  
  private updateModelProp(key: keyof PanZoomModel, value: PanZoomModel[typeof key]) {
    this.zone.run(
      () => {
        this.model.update(
          (model) => ({
            ...model,
            [key]: value
          })
        );
      }
    );
  }
  
  
  private updateModelPan({ x, y }: { x?: number, y?: number }) {
    this.zone.run(
      () => {
        this.model.update(
          (model) => ({
            ...model,
            pan: {
              x: x ?? model.pan.x,
              y: y ?? model.pan.y,
            }
          })
        );
      }
    );
  }


  private syncBaseFromModel() {
    this.base = {
      ...this.base,
      pan: {
        ...this.base.pan,
        x: this.model().pan.x,
        y: this.model().pan.y,
      },
      zoomLevel: this.model().zoomLevel
    };
  }


  private getCentrePoint(): Point {
    return {
      x: this.frameElementRef().nativeElement.offsetWidth / 2,
      y: this.frameElementRef().nativeElement.offsetHeight / 2
    };
  }


  private getCssScale(zoomLevel: number): number {
    return Math.pow(this.scalePerZoomLevel(), zoomLevel - this.neutralZoomLevel());
  }


  private getZoomLevel(cssScale: number) {
    return Math.log10(cssScale) / Math.log10(this.scalePerZoomLevel()) + this.neutralZoomLevel();
  }


  private calcZoomToFit(rect: Rect): PanZoomModel {
    // let (W, H) denote the size of the viewport
    // let (w, h) denote the size of the rectangle to zoom to
    // then we must CSS scale by the min of W/w and H/h in order to just fit the rectangle
    // returns the target left and top coordinates for the panElement and target zoomLevel
    const viewportWidth = this.frameElementRef().nativeElement.offsetWidth;
    const viewportHeight = this.frameElementRef().nativeElement.offsetHeight;
    const targetWidth = rect.width;
    const targetHeight = rect.height;
    const cssScaleExact = Math.min( viewportWidth / targetWidth, viewportHeight / targetHeight );
    const zoomLevelExact = this.getZoomLevel(cssScaleExact);
    const zoomLevel = zoomLevelExact * this.zoomToFitZoomLevelFactor();
    const cssScale = this.getCssScale(zoomLevel);
    return {
        zoomLevel,
        pan: {
            x: -rect.x * cssScale + (viewportWidth - targetWidth * cssScale) / 2,
            y: -rect.y * cssScale + (viewportHeight - targetHeight * cssScale) / 2
        }
    };
  }


  private zoomToFitModel(target: PanZoomModel, duration?: number) {
    // target.pan.x is the panElement left style property
    // target.pan.y is the panElement top style property
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  zoomIn(zoomType: ZoomType = 'lastPoint') {
    if (zoomType === 'lastPoint') {
      this.animateChangeZoomLevel(
        this.base.zoomLevel + this.zoomButtonIncrement(),
        this.lastClickPoint
      );
    }
    else if (zoomType === 'viewCenter') {
      this.animateChangeZoomLevel(
        this.base.zoomLevel + this.zoomButtonIncrement(),
        this.getCentrePoint()
      );
    }
  }


  zoomOut(zoomType: ZoomType = 'lastPoint') {
    if (zoomType === 'lastPoint') {
      this.animateChangeZoomLevel(
        this.base.zoomLevel - this.zoomButtonIncrement(),
        this.lastClickPoint
      );
    }
    else if (zoomType === 'viewCenter') {
      this.animateChangeZoomLevel(
        this.base.zoomLevel - this.zoomButtonIncrement(),
        this.getCentrePoint()
      );
    }
  }


  private startAnimation() {
    this.lastTick = performance.now();
    this.zone.runOutsideAngular(
      () => {
        this.animationId = this.animationFrameFunc(this.animationTick);
      }
    );
  }


  private getFrameElementOffset(): Offset {
    const rect = this.frameElementRef().nativeElement.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX
    };
  }


  private onContentDimensionsChangeDetected(entries: ResizeObserverEntry[]) {
    // callback for ResizeObserver
    this.contentHeight = entries[0].contentRect.height;
    this.contentWidth = entries[0].contentRect.width;
  }


  // Public API
  changeZoomLevel(level: number, clickPoint: Point) {
    this.animateChangeZoomLevel(level, clickPoint);
  }


  getViewPosition(modelPosition: Point): Point {
    // p' = p * s + t
    // viewPosition = modelPosition * scale + basePan
    let scale: number, translation: Point;
    if (this.animationParams) {
      scale = this.getCssScale(this.base.zoomLevel + this.animationParams.deltaZoomLevel * this.animationParams.progress);
      let deltaTranslation = this.animationParams.panStepFunc(this.model().zoomLevel);
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


  getModelPosition(viewPosition: Point): Point {
    // p = (1/s)(p' - t)
    const pmark = viewPosition;
    const s = this.getCssScale(this.base.zoomLevel);
    const t = this.base.pan;
    return {
      x: (1 / s) * (pmark.x - t.x),
      y: (1 / s) * (pmark.y - t.y)
    };
  }


  resetView() {
    if (this.initialZoomToFit()) {
      this.zoomToFit(this.initialZoomToFit()!);
    }
    else if (this.initialPanX() !== undefined && this.initialPanY() !== undefined && this.initialZoomLevel() !== undefined) {
      this.zoomToFitModel({
        zoomLevel: this.initialZoomLevel(),
        pan: {
          x: this.initialPanX(),
          y: this.initialPanY()
        }
      });
    }
    else {
      console.error('PanZoomComponent: resetView() could not reset view as some vars were not set.  The culprits are either config.initialZoomLevel, config.initialPanX, or config.initialPanY.  Or just set panzoomConfig.initialZoomToFit', { initialZoomLevel: this.initialZoomLevel(), initialPanX: this.initialPanX(), initialPanY: this.initialPanY()});
    }
  }


  zoomToFit(rectangle: Rect, duration?: number) {
    // when a user clicks a zoom to fit button
    // example rectangle: { "x": 0, "y": 100, "width": 100, "height": 100 }
    const target: PanZoomModel = this.calcZoomToFit(rectangle);
    // target.pan.x is the panElement left style property
    // target.pan.y is the panElement top style property
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  private zoomInToPoint(clickPoint: Point) {
    this.animateChangeZoomLevel(
      this.base.zoomLevel + this.zoomButtonIncrement(), clickPoint
    );
  }


  private zoomOutFromPoint(clickPoint: Point) {
    this.animateChangeZoomLevel(
      this.base.zoomLevel - this.zoomButtonIncrement(), clickPoint
    );
  }


  panToPoint(point: Point, duration?: number) {
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
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  panToPointCurrentScale(point: Point, duration?: number) {
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
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  panDelta(delta: Point, duration?: number) {
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
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  panDeltaAbsolute(delta: Point, duration?: number) {
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
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  panDeltaPercent(deltaPercent: Point, duration?: number) {
    // API call to pan the view up, down, left, or right, based on a percentage
    // of the original, unzoomed content width and height
    // example point: { "x": 10, "y": -20 }
    let deltaX = 0;
    let deltaY = 0;
    if (deltaPercent.x !== 0) {
      deltaX = this.contentWidth * ( deltaPercent.x / 100 ) * this.scale;
    }
    if (deltaPercent.y !== 0) {
      deltaY = this.contentHeight * ( deltaPercent.y / 100 ) * this.scale;
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
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  centerContent(duration?: number) {
    this.panToPoint( {
      x: this.contentWidth / 2,
      y: this.contentHeight / 2
    },
    duration);
  }


  centerX(duration?: number) {
    const target: PanZoomModel = {
      pan: {
        x: (this.frameWidth / 2) - (this.contentWidth / 2) * this.scale,
        y: this.base.pan.y
      },
      zoomLevel: this.base.zoomLevel
    };
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  centerY(duration?: number) {
    const target: PanZoomModel = {
      pan: {
        x: this.base.pan.x,
        y: (this.frameHeight / 2) - (this.contentHeight / 2) * this.scale
      },
      zoomLevel: this.base.zoomLevel
    };
    this.updateModelProp('isPanning', true);
    this.animateToTarget(target, duration);
  }


  centerTopLeft(duration?: number) {
    this.panToPoint(
      {
        x: 0,
        y: 0
      },
      duration
    );
  }


  centerBottomLeft(duration?: number) {
    this.panToPoint(
      {
        x: 0,
        y: this.contentHeight
      },
      duration
    );
  }


  centerTopRight(duration?: number) {
    this.panToPoint(
      {
        x: this.contentWidth,
        y: 0
      },
      duration
    );
  }


  centerBottomRight(duration?: number) {
    this.panToPoint(
      {
        x: this.contentWidth,
        y: this.contentHeight
      },
      duration
    );
  }


  updateContentDimensions(width?: number, height?: number) {
    if (height !== undefined) {
      this.contentHeight = height;
    }
    if (width !== undefined) {
      this.contentWidth = width;
    }
  }


  detectContentDimensions() {
    const zoomFrameStyle  = getComputedStyle(this.zoomElementRef().nativeElement);
    this.contentHeight = parseInt(
      zoomFrameStyle.getPropertyValue('height').split('px')[0]
    );
    this.contentWidth = parseInt(
      zoomFrameStyle.getPropertyValue('width').split('px')[0]
    );
  }


  // Animation builders
  private animateToTarget(targetModel: PanZoomModel, duration?: number) {
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
    this.updateModelPan({
      x: this.base.pan.x,
      y: this.base.pan.y
    });
    const panStepFunc = (_: number) => {
      // this function gets called during every animation tick in updateDOM(), to calculate where to move the model pan coordinates to (i.e. the translation) for that tick, zoomLevel is ignored within animateToTarget()
      const targetPoint: Point = {
        // The target point to zoom to for the current animation frame.  It must stay the same as the untranslated point
        x: (oldBase.x - targetModel.pan.x) * this.animationParams!.progress,
        y: (oldBase.y - targetModel.pan.y) * this.animationParams!.progress
      };
      return {
        x: -targetPoint.x,
        y: -targetPoint.y
      };
    };
    // now set the parameters of our new animation
    duration = (duration ?? this.zoomStepDuration()) * 1000;
    this.animationParams = {
      deltaZoomLevel, // how many zooom levels to zoom in or out
      panStepFunc, // a function which runs on every animation tick, which calcs how much to pan the view on every frame
      duration, // how long the animation should take
      progress: 0.0
    };
    this.startAnimation();
  }


  animateChangeZoomLevel(newZoomLevel: number, clickPoint: Point) {
    if (this.animationParams) {
      // let running animation finish
      return;
    }
    this.zoomLevelIsChanging = true;
    // keep zoom level in bounds
    newZoomLevel = Math.max(
      this.minimumAllowedZoomLevel,
      newZoomLevel
    );
    newZoomLevel = Math.min(
      this.zoomLevels() - 1,
      newZoomLevel
    );
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
    const duration = this.zoomStepDuration() * 1000;
    this.animationParams = {
      deltaZoomLevel, // the destination zoom level for this zoom operation (when the animation is completed)
      panStepFunc,
      duration, // how long the animation should take
      progress: 0.0
    };
    this.startAnimation();
  }
}
