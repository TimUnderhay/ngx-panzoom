import { Rect } from "ngx-panzoom";

export const isMobileDevice = (): boolean => {
  return (typeof window.orientation !== 'undefined') || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

export function calcInitialZoomToFit(frameWidth: number, frameHeight: number, canvasWidth: number): Rect {
  const width = frameWidth;
  const height = canvasWidth * frameHeight / width;
  return {
    x: 0,
    y: 0,
    width: canvasWidth,
    height
  };
}
