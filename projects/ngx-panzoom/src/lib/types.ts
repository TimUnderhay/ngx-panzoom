import { InputSignal } from '@angular/core';

export interface Offset {
  top: number;
  left: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanZoomConfigOptions {
  zoomLevels: number;
  neutralZoomLevel: number;
  scalePerZoomLevel: number;
  initialZoomLevel: number;
  friction: number;
  haltSpeed: number;
  initialPanX: number;
  initialPanY: number;
  initialZoomToFit?: Rect;
  keepInBounds: boolean;
  keepInBoundsDragPullback: number;
  keepInBoundsRestoreForce: number;
  panOnClickDrag: boolean;
  dragMouseButton: 'left' | 'middle' | 'right';
  zoomButtonIncrement: number;
  zoomOnDoubleClick: boolean;
  zoomOnMouseWheel: boolean;
  invertMouseWheel: boolean;
  zoomStepDuration: number;
  zoomToFitZoomLevelFactor: number;
  freeMouseWheel: boolean;
  freeMouseWheelFactor: number;
  noDragFromElementClass?: string;
  acceleratePan: boolean;
  dynamicContentDimensions: boolean;
}

export type PanZoomConfigSignalOptions = {
  [k in keyof PanZoomConfigOptions]: InputSignal<PanZoomConfigOptions[k]>
}

export interface ZoomAnimation {
  deltaZoomLevel: number;
  panStepFunc: Function;
  duration: number;
  progress: number;
}

export interface Position {
  x?: number;
  y?: number;
  length?: number;
}

export type EventListenerExtOptions = EventListenerOptions & {
  passive?: boolean;
}

export interface PanZoomModel {
  zoomLevel: number;
  isPanning?: boolean;
  pan: Point;
}

export type ZoomType = 'lastPoint' | 'viewCenter';
