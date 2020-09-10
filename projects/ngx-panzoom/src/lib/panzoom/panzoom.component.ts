import { AfterViewInit, Component, OnDestroy, ElementRef, ViewChild, Input, Output, EventEmitter } from '@angular/core';

import { PanZoomConfig } from '../panzoom-config';
import { PanZoomApi } from '../panzoom.api';

import {
  PanZoomModel,
  ViewRefs,
  ViewRefsDimensions
} from '../interfaces';
import { Subscription } from 'rxjs';

@Component({
  selector: 'lib-pan-zoom',
  // we don't want to kill change detection for all elements beneath this, so we don't set OnPush.  Child views can implement OnPush if the developer wants to.  We can get away with this because the 'wheel' event handler runs outside of Angular, therefore it doesnt trigger change detection.
  templateUrl: './panzoom.component.html',
  styleUrls: ['./panzoom.component.css']
})

export class PanZoomComponent implements AfterViewInit, OnDestroy {
  @ViewChild('frameElement', { static: true }) private frameElementRef: ElementRef<HTMLDivElement>;
  @ViewChild('panElement', { static: true }) private panElementRef: ElementRef<HTMLDivElement>;
  @ViewChild('zoomElement', { static: true }) private zoomElementRef: ElementRef<HTMLDivElement>;
  @ViewChild('overlayElement', { static: true }) private overlayElementRef: ElementRef<HTMLDivElement>;

  @Input() set config (config: PanZoomConfig) {
    this.panZoomApi.config = config;
  };

  @Output() modelChanged = new EventEmitter<PanZoomModel>();

  private modelChangedSubscription: Subscription;

  constructor (private panZoomApi: PanZoomApi) {

    this.modelChangedSubscription = this.panZoomApi.modelChanged.subscribe((model) => {
      this.modelChanged.emit(model);
    });
  }

  ngAfterViewInit() {

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

  ngOnDestroy() {
    this.panZoomApi.cleanup();
    this.modelChangedSubscription.unsubscribe();
  }

  private getDimensions(element: HTMLElement) {

    const rect = element.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height
    }
  }
}
