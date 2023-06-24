import { Point } from './types';

export const isMobileDevice = (): boolean => {
  return (typeof window.orientation !== 'undefined') || (navigator.userAgent.indexOf('IEMobile') !== -1);
};

export const length = (vector2d: Point): number => {
  // console.log('PanZoomComponent: length()');
  return Math.sqrt(vector2d.x * vector2d.x + vector2d.y * vector2d.y);
}

const mouseEvents = new Set(['mousedown', 'mouseup', 'auxclick', 'click', 'contextmenu', 'dblclick', 'mouseenter', 'mouseleave', 'mousemove', 'mouseout', 'mouseover'])

export const isMouseEvent = (e: MouseEvent | TouchEvent): e is MouseEvent => {
  return mouseEvents.has(e.type); // || e.type === 'click'...
}

export const isMouseDownEvent = (e: MouseEvent | TouchEvent): e is MouseEvent => {
  return e.type === 'mousedown';
}

export const isMouseUpEvent = (e: MouseEvent | TouchEvent): e is MouseEvent => {
  return e.type === 'mouseup';
}

export const isMouseMoveEvent = (e: MouseEvent | TouchEvent): e is MouseEvent => {
  return e.type === 'mousemove';
}

export const isTouchStartEvent = (e: MouseEvent | TouchEvent): e is TouchEvent => {
    return e.type === 'touchstart';
}

export const isTouchEndEvent = (e: MouseEvent | TouchEvent): e is TouchEvent => {
    return e.type === 'touchend';
}

export const isTouchMoveEvent = (e: MouseEvent | TouchEvent): e is TouchEvent => {
    return e.type === 'touchmove';
}

export const animationFrameFunc = window.requestAnimationFrame;

/**
 * Method will check if 'child' node element is a child of
 * parent node with class 'className'
 * @param className
 * @param child
 */
export const isParentElement = (className: string, child: Element) => {
  let node = child.parentElement;
  while (node !== null) {
    if (node.classList && node.classList.contains(className)) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export const isChrome = navigator.userAgent.search('Chrome') >= 0;

const hasPositionChanged = ({ pos, prevPos }): boolean => pos !== prevPos;

const valueInRange = ({ minScale, maxScale, scale }): boolean => scale <= maxScale && scale >= minScale;

export const getTranslate = ({ minScale, maxScale, scale }: { minScale: number, maxScale: number, scale: number}) => ({ pos, prevPos, translate }: { pos: number, prevPos: number, translate: number }) =>
    valueInRange({ minScale, maxScale, scale }) && hasPositionChanged({ pos, prevPos })
        ? translate + (pos - prevPos * scale) * (1 - 1 / scale)
        : translate;

export const getScale = ({ scale, minScale, maxScale, scaleSensitivity, deltaScale }) => {
    let newScale = scale + (deltaScale / (scaleSensitivity / scale));
    newScale = Math.max(minScale, Math.min(newScale, maxScale));
    return [scale, newScale];
};

export const getMatrix = ({ scale, translateX, translateY }) => `matrix(${scale}, 0, 0, ${scale}, ${translateX}, ${translateY})`;
