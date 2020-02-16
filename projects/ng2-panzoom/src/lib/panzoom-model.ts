import { Point } from './panzoom-point';

export interface PanZoomModel {
  zoomLevel: number;
  isPanning?: boolean;
  pan: Point;
}
