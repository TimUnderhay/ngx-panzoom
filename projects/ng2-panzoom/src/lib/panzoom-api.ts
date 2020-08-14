import { PanZoomModel } from './panzoom-model';
import { PanZoomConfig } from './panzoom-config';

export interface PanZoomAPI {
  model: PanZoomModel; // the current model
  config: PanZoomConfig; // the current panzooom configuration
  changeZoomLevel: Function;
  zoomIn: Function;
  zoomOut: Function;
  zoomToFit: Function;
  getViewPosition: Function;
  getModelPosition: Function;
  resetView: Function;
  panToPoint: Function;
  panDelta: Function;
  panDeltaPercent: Function;
  panDeltaAbsolute: Function;
  centerContent: Function;
  centerX: Function;
  centerY: Function;
  centerTopLeft: Function;
  centerBottomLeft: Function;
  centerTopRight: Function;
  centerBottomRight: Function;
}
