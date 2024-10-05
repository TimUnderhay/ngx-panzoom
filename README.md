# ngx-panzoom

An Angular component for panning and zooming an element or elements using the mouse and mousewheel.  Provides rudimentary support for touchscreens (read section on mobile support).  It was adapted from the angular-pan-zoom library for AngularJS, but it has been heavily modified.  Many thanks go out to Martin Vindahl Olsen for having written it, and for his blessing.

It is built using Angular CLI.  It is only tested with the corresponding version of Angular.

This library deliberately parts with certain received Angular wisdom of using only Angular-ish methods to accomplish things.  We use native event listeners.  We apply CSS transforms directly to the DOM.  But as this library doesn't fit the traditional Angular model, as its purpose is only to apply CSS transforms to a certain part of the DOM, without moving or changing anything else, it has no impact on an application's state (except if the app consumes `modelChanged` observables).  By using this approach, it is hoped that performance will be maximised.

# End Of Life
There are no plans to support ngx-panzoom beyond version 19.  PR's may still be accepted, though.

## Version 19 Compatibility
Version 19 is compatible with Angular 18 and up.  Assuming Angular's API doesn't significantly change in future releases, this library should continue to function.

## Version 19 Breaking Changes

- The `PanZoomConfig` class has been removed.  Configuration options which were previously set using `PanZoomConfig` should now be bound directly to `ngx-panzoom` in the template.
- Version 19 adopts a more conventional API approach -- it removes the need to access the API via an observable (this interface has been fully removed).  One need only use `viewChild` or `@ViewChild` with a PanZoomComponent selector, or a `#Hash` selector in the template.
- The `modelChanged` RxJS BehaviorSubject of the `PanZoomConfig` class has been replaced with a standard `modelChange` Angular output.

See code example for more details.

## Demo

As of version 19, the demo app is part of this repository, under `projects/demo-app`.  Click [here](https://TimUnderhay.github.io/ngx-panzoom)


## Features

- Zoom using mouse wheel, touch surface, double click, or API controls tied to your own UI.
- Pan using click/touch and drag, or API calls. When releasing the mouse button or touch surface whilst panning, the pan will come to a gradual stop.

# Differences From the Original AngularJS Version

- The pan-zoom service has been eliminated.
- **Free zoom** - zooming is no longer limited to switching between two distinct zoom levels.  Zoom can now be smoothly and freely controlled using the mouse wheel or trackpad.
- `zoomToFit()` animation - using the zoomToFit() function now will animate the view to the a desired rectangle.
- A convenience method `resetView()` has been provided to animate the view back to its initial settings.
- The `zoomIn()` and `zoomOut()` API functions can zoom to either the last zoomed point or to the view's centre point, depending on the value of `zoomType` (`lastPoint` or `viewCenter`).
- New API methods `panToPoint()`, `panDelta()`, `panDeltaPercent()`,  `panDeltaAbsolute()`, and many others have been added.
- Performance improvements.
- The widget has not been migrated from the original project.
- Touchscreen support "works", but not well.

## Dependencies
- >= Angular 18

## Mobile Support -- Actively Soliciting PR's

The library implements some basic support that may work with some mobile devices, though pinch-to-zoom still needs considerable work.  As the application that this library was developed for was never intended for use with mobile devices, there are no plans to implement full mobile support.  As long as this remains the case, I respecfully ask for no more issues concerning mobile support, please.  I realise that this will limit adoption, but for an enterprising developer out there, I can't imagine that adding mobile support would be nearly as big of a challenge as it was to port the library to Angular from AngularJS!


## Installation

```
npm install ngx-panzoom --save
```


### app.module.ts:

```typescript
import { NgxPanZoomModule } from 'ngx-panzoom';

@NgModule({
  imports: [  ...,
    NgxPanZoomModule
  ],
  ...
})

export class MyAppModule { }
```

## Usage

This library exposes a component called `ngx-panzoom`, under which you may place any standard Angular template code.  Though the events which trigger panning and zooming are run outside of Angular and thus themselves will not trigger change detection, it should not break change detection for any sub-components.

Configuration parameters are set as properties of the `ngx-panzoom` template element.

The API can be accessed directly on the `PanZoomComponent` class, which can be obtained either as a template reference (i.e. `#PanZoom`) or using `viewChild` or `@ViewChild`.  See below example code.

### Top Tip

Be sure to place your pan-zoom component underneath an element with a definite height/width, like an absolute-positioned div.  You may not see anything if you don't do this.

## Example

```typescript
import { viewChild, signal } from '@angular/core';
import { PanZoomComponent, PanZoomModel } from 'ngx-panzoom';

@Component({
  selector: 'my-component'
  template: `
    <div style="position: absolute; top: 100px; bottom: 0; left: 0; right: 0;">
      <ngx-panzoom
        #PanZoom
        [zoomLevels]="10"
        [scalePerZoomLevel]="scalePerZoomLevel()"
        [zoomStepDuration]="0.2"
        [freeMouseWheelFactor]="0.01"
        [zoomToFitZoomLevelFactor]="0.9"
        [neutralZoomLevel]="neutralZoomLevel()"
        (modelChange)="panzoomModel.set($event)"
      >
        <div style="position: relative;">
          <img src="/myimage1.jpg">
        </div>
      </ngx-panzoom>
    </div>
    
    <!-- API by template reference -->
    <button (click)="PanZoom.zoomOut('lastPoint')"></button>`
})

export class MyComponent {
  ...
  readonly panZoom = viewChild(PanZoomComponent);
  readonly panzoomModel = signal<PanZoomModel>(undefined!);
  
  myMethod(): void {
    // API by viewChild
    this.panZoom().zoomIn('lastPoint');
  }
}
```

## Configuration

Configuration is set via property bindings on the `ngx-panzoom` element.

The following attributes are defined:

Name                                | Type      | Default           | Description
----------------------------------- | --------- | ----------------- | -----------
zoomLevels                          | number    | 5                 | Number of discrete zoom levels, each one representing a scale.  The higher the number, the more zoomed in it is.
neutralZoomLevel                    | number    | 2                 | The zoom level at which the contents render at 1:1 scale.
scalePerZoomLevel                   | number    | 2.0               | The difference in actual scale between two adjacent zoom levels.
initialZoomLevel                    | number    | neutralZoomLevel  | The initially selected zoom level.
initialPanX                         | number    | 0                 | The initial pan in the horizontal direction.
initialPanY                         | number    | 0                 | The initial pan in the vertical direction.
initialZoomToFit                    | Rect | null              | When defined, will initially zoom to fit the given rectangle (see API for explanation of zoom to fit). This overrides the initialZoomLevel, initialPanX, and initialPanY values.
zoomToFitZoomLevelFactor            | number    | 0.95              | A number to indicate how closely zoom to fit will work. 1.0 is a perfect fit.  Lowering the number will reveal a bit of the surrounding contents.
zoomOnDoubleClick                   | boolean   | true              | Enable or disable zooming in on double click.
zoomButtonIncrement                 | number    | 1.0               | The number of zoom levels to zoom on double click.
zoomStepDuration                    | number    | 0.2               | Number of seconds to animate between two adjacent zoom levels.
zoomOnMouseWheel                    | boolean   | true              | Enable or disable zoom in/out on mouse wheel.
invertMouseWheel                    | boolean   | false             | Invert the behaviour of the mouse wheel (or two finger trackpad gesture).
freeMouseWheel                      | boolean   | true              | By setting this to true, the mouse wheel will freely zoom the view without respect to discreet zoom levels.  With false, moving the mouse wheel will zoom the view by _zoomButtonIncrement_.
freeMouseWheelFactor                | number    | 0.08              | How much to zoom the view with every tick of the wheel, if using freeMouseWheel.
friction                            | number    | 10.0              | Constant which controls the friction when dragging and then letting go. The higher the number, the more quickly the animation will come to a stop.
haltSpeed                           | number    | 100.0             | Constant which controls when the pan animation has slowed down enough to be terminated. The lower the number, the longer it will take to come to a stop.
panOnClickDrag                      | boolean   | true              | Enable or disable pan on clicking and dragging the mouse.
keepInBounds                        | boolean   | false             | When true, it will not be possible to pan the contents off the screen -- it will snap back when trying to do so.  It will not be possible to zoom further out than the neutral zoom level.  *REMEMBER* that the initial zoom level must either be less than or equal to the neutral zoom level, or weird things will happen.
keepInBoundsRestoreForce            | number    | 0.5               | Constant to control how quickly the contents snap back into place after attempting to pan out of bounds.
keepInBoundsDragPullback            | number    | 0.7               | Constant to control the perceived force preventing dragging the contents out of bounds.
dragMouseButton                     | string    | 'left'            | Controls which mouse button drags the view.  Valid options are `left`, `middle`, and `right`.  *NOTE:* Using `middle` and `right` will disable the default 'auxclick' and 'contextmenu' handlers, respectively.  *ALSO NOTE:* Chrome seems to have a bug that doesn't the permit the 'mousemove' event to fire after middle-click drag until it receives a normal left 'click' event.  If anyone can shed any light on this, I'd be happy to hear from you.  It's such an edge case, though, that I won't be opening a bug report, but feel free to do so if this affects you. 
noDragFromElementClass              | string    | null              | If set, this will prevent click-drag on elements who have a parent element containing a specific class name.
acceleratePan                       | boolean   | true              | Controls whether the pan frame will be hardware accelerated.
dynamicContentDimensions                       | boolean   | false              | If true, a ResizeObserver will be used to detect changes in the content dimensions.  Useful if the content dimensions can't be predicted.  Alternatively, the API methods `detectContentDimensions()` or `contentDimensionsChanged()` can also be used.  ResizeObservers may not work in some older or mobile web browsers.  See https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver for info on browser compatibility.


## Events

Name | Type | Description
----------------------------------- | --------- | -----------
modelChange | PanZoomModel | Emits changes to the panZoom model.


## API

The panzoom library provides an API for interacting with, observing, and controlling it.  The following methods and objects are available from the PanZoomAPI:

  - `changeZoomLevel(newZoomLevel: number, clickPoint: Point)` - This method will reset the view to _newZoomLevel_, with _clickPoint_ as its centre point.

  - `zoomIn(zoomType: 'lastPoint' | 'viewCenter' = 'lastPoint')` - This will zoom the view in to either the last zoomed point (if _lastPoint_), or to the centre point of the view (_viewCenter_), by one zoom level.  The default zoomType is `lastPoint`.

   - `zoomOut(zoomType: 'lastPoint' | 'viewCenter' = 'lastPoint')` - This will zoom the view out from either the last zoomed point (if _lastPoint_), or from the centre point of the view (_viewCenter_), by one zoom level.  The default zoomType is `lastPoint`.

  - `zoomToFit(rectangle: Rect, [duration: number])` - Animates the view to focus on a rectangle of the underlying canvas.  **duration** is how long the animation should take (in seconds), and is optional.  **rectangle** is two coordinates on the canvas which the panZoom view is pan/zooming.  See the below section on PanZoom Interfaces for its definition.
 
  - `resetView()` - A shortcut method to reset the pan and zoom back to the initial view.
  
  - `getViewPosition(modelPosition: Point)` - By passing in x,y coordinates of the original, untransformed content canvas, it will return the current pixel position of this point.
  
  - `getModelPosition(viewPosition: Point)` - The reverse operation of getViewPosition().

  - `panToPoint(point: Point, [duration: number])` - Will animate the view so that the centre point of the view is at the *point* parameter coordinates, relative to the original, unzoomed content width and height.

  - `panDelta(delta: Point, [duration: number])` - Will pan the view left, right, up, or down, based on a number of pixels relative to the original, unzoomed content.

  - `panDeltaPercent(deltaPercent: Point, [duration: number])` - Will pan the view up, down, left, or right, based on a percentage of the original, unzoomed content width and height.
  
  - `panDeltaAbsolute(delta: Point, [duration: number])` - Will pan the view left, right, up, or down, based on a number of pixels.  This method doesn't adjust for scale.  I'm not sure why you'd want this, but it's provided just in case.

  - `centerContent([duration: number])` - Will centre the the content vertically and horizontally at the current scale.

  - `centerTopLeft([duration: number])` - Will centre the top-left corner of the content at the current scale.

  - `centerBottomLeft([duration: number])` - Will centre the bottom-left corner of the content at the current scale.

  - `centerTopRight([duration: number])` - Will centre the top-right corner of the content at the current scale.

  - `centerBottomRight([duration: number])` - Will centre the bottom-right corner of the content at the current scale.

  - `centerX([duration: number])` - Will centre the view on its X axis.

  - `centerY([duration: number])` - Will centre the view on its Y axis.

  - `detectContentDimensions()` - Will trigger a one-time detection of the content dimensions.

  - `updateContentDimensions([width: number], [height: number])` - Will update the content dimensions with the width and height values passed in.  Either parameter is optional.


## Interfaces

```typescript
interface PanZoomModel {
  zoomLevel: number;
  isPanning?: boolean;
  pan: Point; // how far the view has been moved on the x and y axes.  It is not adjusted for scale
}

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number; // the x0 (top left) coordinate
  y: number; // the y0 (top left) coordinate
  width: number; // the x1 (bottom right) coordinate
  height: number; // the y1 (bottom right) coordinate
}
```

## Contributing

Pull requests are welcome.

## Reference

[Martin Vindahl Olsen's original angular-pan-zoom project on GitHub](https://github.com/mvindahl/angular-pan-zoom)
