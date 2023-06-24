import { BehaviorSubject } from 'rxjs';
import { PanZoomConfig } from './panzoom-config';

export interface Offset {
  top: number;
  left: number;
}

export interface PanZoomConfigOptions {
  zoomLevels?: number;
  neutralZoomLevel?: number;
  scalePerZoomLevel?: number;
  initialZoomLevel?: number;
  friction?: number;
  haltSpeed?: number;
  initialPanX?: number;
  initialPanY?: number;
  initialZoomToFit?: Rect;
  keepInBounds?: boolean;
  keepInBoundsDragPullback?: number;
  keepInBoundsRestoreForce?: number;
  panOnClickDrag?: boolean;
  dragMouseButton?: 'left' | 'middle' | 'right';
  zoomButtonIncrement?: number;
  zoomOnDoubleClick?: boolean;
  zoomOnMouseWheel?: boolean;
  invertMouseWheel?: boolean;
  zoomStepDuration?: number;
  zoomToFitZoomLevelFactor?: number;
  freeMouseWheel?: boolean;
  freeMouseWheelFactor?: number;
  noDragFromElementClass?: string;
  modelChanged?: BehaviorSubject<PanZoomModel>;
  api?: BehaviorSubject<PanZoomAPI>;
  acceleratePan?: boolean;
  dynamicContentDimensions?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export type Distance = Point;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomAnimation {
  deltaZoomLevel: number;
  panStepFunc: (zoomLevel: number) => Point;
  duration: number;
  progress: number;
}

export interface Position {
  x?: number;
  y?: number;
  length?: number;
}

export interface PanZoomModel {
  zoomLevel: number;
  isPanning?: boolean;
  pan: Point;
}

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
