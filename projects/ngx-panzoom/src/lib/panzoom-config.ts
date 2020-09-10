import { PanZoomConfigOptions, Rect } from './interfaces';

export class PanZoomConfig {
  zoomLevels = 5;
  neutralZoomLevel = 2;
  scalePerZoomLevel = 2.0;
  initialZoomLevel = this.neutralZoomLevel;
  friction = 10.0;
  haltSpeed = 100.0;
  initialPanX = 0;
  initialPanY = 0;
  initialZoomToFit: Rect;
  keepInBounds = false;
  keepInBoundsDragPullback = 0.7;
  keepInBoundsRestoreForce = 0.5;
  panOnClickDrag = true;
  dragMouseButton = 'left'; // left, middle, right
  zoomButtonIncrement = 1.0;
  zoomOnDoubleClick = true;
  zoomOnMouseWheel = true;
  invertMouseWheel = false;
  zoomStepDuration = 0.2;
  zoomToFitZoomLevelFactor = 0.95;
  freeMouseWheel = true;
  freeMouseWheelFactor = 0.08;
  noDragFromElementClass: string;
  acceleratePan = true;
  dynamicContentDimensions = false;

  constructor(options?: PanZoomConfigOptions) {
    if (options === undefined) {
      return;
    }
    if ('zoomLevels' in options) {
      this.zoomLevels = options.zoomLevels;
    }
    if ('neutralZoomLevel' in options) {
      this.neutralZoomLevel = options.neutralZoomLevel;
    }
    if ('scalePerZoomLevel' in options) {
      this.scalePerZoomLevel = options.scalePerZoomLevel;
    }
    if ('initialZoomLevel' in options) {
      this.initialZoomLevel = options.initialZoomLevel;
    }
    if ('friction' in options) {
      this.friction = options.friction;
    }
    if ('haltSpeed' in options) {
      this.haltSpeed = options.haltSpeed;
    }
    if ('initialPanX' in options) {
      this.initialPanX = options.initialPanX;
    }
    if ('initialPanY' in options) {
      this.initialPanY = options.initialPanY;
    }
    if ('initialZoomToFit' in options) {
      this.initialZoomToFit = options.initialZoomToFit;
    }
    if ('keepInBounds' in options) {
      this.keepInBounds = options.keepInBounds;
    }
    if ('keepInBoundsDragPullback' in options) {
      this.keepInBoundsDragPullback = options.keepInBoundsDragPullback;
    }
    if ('keepInBoundsRestoreForce' in options) {
      this.keepInBoundsRestoreForce = options.keepInBoundsRestoreForce;
    }
    if ('panOnClickDrag' in options) {
      this.panOnClickDrag = options.panOnClickDrag;
    }
    if ('dragMouseButton' in options) {
      this.dragMouseButton = options.dragMouseButton;
    }
    if ('zoomButtonIncrement' in options) {
      this.zoomButtonIncrement = options.zoomButtonIncrement;
    }
    if ('zoomOnDoubleClick' in options) {
      this.zoomOnDoubleClick = options.zoomOnDoubleClick;
    }
    if ('zoomOnMouseWheel' in options) {
      this.zoomOnMouseWheel = options.zoomOnMouseWheel;
    }
    if ('invertMouseWheel' in options) {
      this.invertMouseWheel = options.invertMouseWheel;
    }
    if ('zoomStepDuration' in options) {
      this.zoomStepDuration = options.zoomStepDuration;
    }
    if ('zoomToFitZoomLevelFactor' in options) {
      this.zoomToFitZoomLevelFactor = options.zoomToFitZoomLevelFactor;
    }
    if ('freeMouseWheel' in options) {
      this.freeMouseWheel = options.freeMouseWheel;
    }
    if ('freeMouseWheelFactor' in options) {
      this.freeMouseWheelFactor = options.freeMouseWheelFactor;
    }
    if (this.keepInBounds && this.neutralZoomLevel !== 0) {
      console.warn('You have set keepInBounds to true and neutralZoomLevel to ' + this.neutralZoomLevel + '. Be aware that the zoom level cannot go below ' + this.neutralZoomLevel);
    }
    if ('noDragFromElementClass' in options) {
      this.noDragFromElementClass = options.noDragFromElementClass;
    }
    if ('acceleratePan' in options) {
      this.acceleratePan = options.acceleratePan;
    }
    if ('dynamicContentDimensions' in options) {
      this.dynamicContentDimensions = options.dynamicContentDimensions;
    }
  }
}
