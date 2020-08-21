import { Rect } from './rect';
import { BehaviorSubject } from 'rxjs';
import { PanZoomModel } from '../panzoom-model';
import { PanZoomAPI } from '../panzoom-api';

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
