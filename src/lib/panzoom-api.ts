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
}
