import { PanZoomApi } from './panzoom.api';
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input, NgZone, Output, EventEmitter } from '@angular/core';
import { PanZoomConfig } from './panzoom-config';
import {  Point, Rect, Offset, ViewRefs, ViewRefsDimensions } from './interfaces';
// import { PanZoomAPI, ZoomType } from './panzoom-api';
// import { Point } from './types/point';
// import { Rect } from './types/rect';
// import { Offset } from './types/offset';






@Component({
  selector: 'pan-zoom',
  // we don't want to kill change detection for all elements beneath this, so we don't set OnPush.  Child views can implement OnPush if the developer wants to.  We can get away with this because the 'wheel' event handler runs outside of Angular, therefore it doesnt trigger change detection.
  templateUrl: './panzoom.component.html',
  styleUrls: ['./panzoom.component.css']
})

export class PanZoomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('frameElement', { static: true }) private frameElementRef: ElementRef<HTMLDivElement>;
  @ViewChild('panElement', { static: true }) private panElementRef: ElementRef<HTMLDivElement>;
  @ViewChild('zoomElement', { static: true }) private zoomElementRef: ElementRef<HTMLDivElement>;
  @ViewChild('overlayElement', { static: true }) private overlayElementRef: ElementRef<HTMLDivElement>;

  @Input() set config (config: PanZoomConfig) {
    this.panZoomApi.config = config;
  };

  @Output() panChanged = new EventEmitter<Point>();

  constructor (
    private panZoomApi: PanZoomApi,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    // console.log('PanZoomComponent: ngOnInit(): initializing PanZoomComponent');



    // this.config.modelChanged.next(this.model);

    // create public API
    // this.api = {
    //   model: this.model,
    //   config: this.config,
    //   changeZoomLevel: this.zoomToLevelAndPoint.bind(this),
    //   zoomIn: this.zoomIn.bind(this),
    //   zoomOut: this.zoomOut.bind(this),
    //   zoomToFit: this.zoomToFit.bind(this),
    //   resetView: this.resetView.bind(this),
    //   getViewPosition: this.getViewPosition.bind(this),
    //   getModelPosition: this.getModelPosition.bind(this),
    //   panToPoint: this.panToPoint.bind(this),
    //   panDelta: this.panDelta.bind(this),
    //   panDeltaPercent: this.panDeltaPercent.bind(this),
    //   panDeltaAbsolute: this.panDeltaAbsolute.bind(this),
    //   centerContent: this.centerContent.bind(this),
    //   centerX: this.centerX.bind(this),
    //   centerY: this.centerY.bind(this),
    //   centerTopLeft: this.centerTopLeftCorner.bind(this),
    //   centerBottomLeft: this.centerBottomLeftCorner.bind(this),
    //   centerTopRight: this.centerTopRightCorner.bind(this),
    //   centerBottomRight: this.centerBottomRightCorner.bind(this),
    //   updateContentDimensions: this.updateContentDimensions.bind(this),
    //   detectContentDimensions: this.detectContentDimensions.bind(this)
    // };

    // this.config.api.next(this.api);




  }



  ngAfterViewInit(): void {

    const viewRefs: ViewRefs = {
      frame: this.frameElementRef,
      pan: this.panElementRef,
      zoom: this.zoomElementRef,
      overlay: this.overlayElementRef,
    };

    const viewRefsDimensions: ViewRefsDimensions = {
      frame: this.getDimensions(viewRefs.frame.nativeElement),
      zoom: this.getDimensions(viewRefs.frame.nativeElement)
    };

    this.panZoomApi.init(viewRefs, viewRefsDimensions);
  }

  ngOnDestroy(): void {
    this.panZoomApi.cleanup();
  }

  private getDimensions(element: HTMLElement) {

    const rect = element.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height
    }
  }
}
