import { PanZoomModel } from './panzoom-model';
import { PanZoomConfig } from './panzoom-config';
import { Point } from './types/point';
import { Rect } from './types/rect';

export type ZoomType = 'lastPoint' | 'viewCenter';

export interface PanZoomAPI {
  model: PanZoomModel; // the current model
  config: PanZoomConfig; // the current panzooom configuration
  changeZoomLevel(level: number, clickPoint: Point): void;
  zoomIn(zoomType?: ZoomType): void;
  zoomOut(zoomType?: ZoomType): void;
  zoomToFit(rectangle: Rect, duration?: number): void;
  getViewPosition(modelPosition: Point): Point;
  getModelPosition(viewPosition: Point): Point;
  resetView(): void;
  panToPoint(point: Point, duration?: number): void;
  panDelta(delta: Point, duration?: number): void;
  panDeltaPercent(deltaPercent: Point, duration?: number): void;
  panDeltaAbsolute(delta: Point, duration?: number): void;
  centerContent(duration?: number): void;
  centerX(duration?: number): void;
  centerY(duration?: number): void;
  centerTopLeft(duration?: number): void;
  centerBottomLeft(duration?: number): void;
  centerTopRight(duration?: number): void;
  centerBottomRight(duration?: number): void;
  updateContentDimensions(width?: number, height?: number): void;
  detectContentDimensions(): void;
}
