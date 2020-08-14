import { Point } from './types/point';

export interface PanZoomModel {
  zoomLevel: number;
  isPanning?: boolean;
  pan: Point;
}
