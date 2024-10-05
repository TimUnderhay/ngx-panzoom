import { Point } from './types';

// from https://stackoverflow.com/questions/54801835/type-safe-predicate-functions-in-typescript
type Diff<T, U> = T extends U ? never : T;

type Predicate<I, O extends I> = (i: I) => i is O;

const not = <I, O extends I>(p: Predicate<I, O>) =>
    (i: I): i is (Diff<I, O>) => !p(i);

const nullableSet = new Set<unknown>([null, undefined]);

export function assertIsNonNullable<T>(value?: T, error?: Error): asserts value is NonNullable<T> {
  if (nullableSet.has(value as unknown as any)) {
    throw error ?? new Error('Value undefined or null');
  }
}

export const isNullable = <I>(i: I | null | undefined): i is null | undefined => nullableSet.has(i);

export const isUndefined = <I>(i: I | undefined): i is undefined => i === undefined;

export const isDefined = not(isUndefined);

export const isNonNullable = not(isNullable);

const mouseEvents = new Set([
  'mouse',
  'mousedown',
  'mousemove',
  'mouseup',
  'mousedown'
]);

export function getIsMouseEvent(event: MouseEvent | TouchEvent): event is MouseEvent {
  return mouseEvents.has(event.type);
}

const touchEvents = new Set([
  'touchmove',
  'touchend',
  'touchstart',
  'touch'
]);

export function getIsTouchEvent(event: MouseEvent | TouchEvent): event is TouchEvent {
  return touchEvents.has(event.type);
}

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator as any)?.msMaxTouchPoints > 0;
}

/**
   * Method will check if 'child' node element is a child of
   * parent node with class 'className'
   * @param className
   * @param child
   */
export function isParentElement(className: string, child: EventTarget) {
  if (child instanceof Element) {
    let parent = child.parentNode;
    while (parent !== null) {
      if (parent instanceof Element && parent.classList && parent.classList.contains(className)) {
        return true;
      }
      parent = parent.parentNode as Element;
    }
  }
  return false;
}

export function length(vector2d: Point) {
  return Math.sqrt(vector2d.x * vector2d.x + vector2d.y * vector2d.y);
}

export const preventDefault = (event: Event) => {
  event.preventDefault();
}
