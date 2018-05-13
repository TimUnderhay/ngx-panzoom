import { Subject, BehaviorSubject } from 'rxjs';
import { Rect } from './panzoom-rect';
import { PanZoomModel } from './panzoom-model';
import { PanZoomAPI } from './panzoom-api';
// declare var log;

export class PanZoomConfig {

  zoomLevels = 5;
  neutralZoomLevel = 2;
  scalePerZoomLevel = 2.0;
  initialZoomLevel = this.neutralZoomLevel;
  disableZoomAnimation = false;
  friction = 10.0;
  haltSpeed = 100.0;
  initialPanX = 0;
  initialPanY = 0;
  initialZoomToFit: Rect;
  keepInBounds = false;
  keepInBoundsDragPullback = 0.7;
  keepInBoundsRestoreForce = 0.5;
  panOnClickDrag = true;
  zoomButtonIncrement = 1.0;
  zoomOnDoubleClick = true;
  zoomOnMouseWheel = true;
  invertMouseWheel = false;
  zoomStepDuration = 0.2;
  zoomToFitZoomLevelFactor = 0.95;
  modelChanged: Subject<PanZoomModel> = new Subject<PanZoomModel>();
  api: BehaviorSubject<PanZoomAPI> = new BehaviorSubject<PanZoomAPI>({
    model: null,
    config: null,
    changeZoomLevel: null,
    zoomIn: null,
    zoomOut: null,
    zoomToFit: null,
    getViewPosition: null,
    getModelPosition: null,
    resetView: null
  });
  freeMouseWheel = false;
  freeMouseWheelFactor = 0.08;
  useHardwareAcceleration = true;
  chromeUseTransform = true;

  constructor() {
    if (this.keepInBounds && this.neutralZoomLevel !== 0) {
      console.warn('You have set keepInBounds to true and neutralZoomLevel to ' + this.neutralZoomLevel + '. Be aware that the zoom level cannot go below ' + this.neutralZoomLevel);
    }
  }
}
