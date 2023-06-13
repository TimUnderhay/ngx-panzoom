# ngx-panzoom

An Angular component for panning and zooming an element or elements using the mouse and mousewheel.  Provides rudimentary support for touchscreens (read section on mobile support).  It was adapted from the angular-pan-zoom library for AngularJS, but it has been heavily modified.  Many thanks go out to Martin Vindahl Olsen for having written it, and for his blessing in this undertaking.

It is built using Angular CLI 13.x in partial Ivy compilation mode.  It is therefore no longer compatible with legacy Angular version which are still using the View Engine.  It is only tested with the corresponding version of Angular.

This library deliberately parts with certain received Angular wisdom of using only Angular-ish methods to accomplish things.  We use native event listeners.  We apply CSS transforms directly to the DOM.  But as this library doesn't fit the traditional Angular model, as its purpose is only to apply CSS transforms to a certain part of the DOM, without moving or changing anything else, it has no impact on an application's state (except if the app consumes `modelChanged` observables).  By using this approach, it is hoped that compatibility and performance will be maximised.

## This Module is on Life Support -- New Maintainer Needed!

Doubtless many will have noticed that there has been little by way of support for this library as of late.  Sadly, other life priorities just don't allow the time for it, and that doesn't seem likely to change in the near future.  If there is some brave soul out there would like to take over the maintenance of this module, please do contact me and I'll be happy to discuss it with you.

## Demo

Click [here](https://kensingtontech.github.io/ngx-panzoom-demo) for a demo of the module.  The demo source can be found [here](https://github.com/KensingtonTech/ngx-panzoom-demo).

## Features

- Zoom using mouse wheel, touch surface, double click, or API controls tied to your own UI.
- Pan using click/touch and drag, or API calls. When releasing the mouse button or touch surface whilst panning, the pan will come to a gradual stop.

# Version 16.x Changes

- Updated for Angular 16.x.

# Version 15.x Changes

- Updated for Angular 15.x.

# Version 14.x Changes

- Updated for Angular 14.x.

# Version 13.x Changes

- Updated for Angular 13.x.

# Version 12.x Changes

- Updated for Angular 12.x.

## Version 12 Potentially Breaking Changes

- Compiled in Ivy partial compilation mode. 
- No longer supports previous Angular major versions. 


# Version 11.x Changes

- Updated for Angular 11.x.
- Improved single-touch pan handling (thanks to @dexterbt1).
- Fix for config input being marked as private.

# Version 10.x Changes

Version 10.x is compiled using Angular 10.x.  Per the Angular guidance at the time of writing (`https://angular.io/guide/creating-libraries`), Ivy is not used for the NPM repo build.  The following changes have been made:

- The jQuery dependency has finally been removed!
- Updated for and compiled with Angular 10.x.
- New API helper methods `centerContent()`, `centerTopLeft()`, `centerBottomLeft()`, `centerTopRight()`, `centerBottomRight()`, `centerX()`, and `centerY()`
- Config option `dynamicContentDimensions`, and new API methods `detectContentDimensions()` and `updateContentDimensions()` for when the content size isn't predictable.
- Added options `lastPoint` (default for backwards-compatibility) and `viewCenter` to `zoomIn()` and `zoomOut()` API methods.  Defines which point to zoom to/from: either the centre of the screen or the last point zoomed to/from.
- Added proper TypeScript definitions for API methods.
- Several bug fixes.

## Version 10 Potentially Breaking Changes

- Renamed Ng2PanZoomModule to NgxPanZoomModule.
- Renamed class panElement to pan-element.
- Renamed class zoomElement to zoom-element.
- Renamed class panzoomOverlay to pan-zoom-overlay.

# Differences From the Original

- The pan-zoom service has been eliminated.
- **Free zoom** - zooming is no longer limited to switching between two distinct zoom levels.  Zoom can now be smoothly and freely controlled using the mouse wheel or trackpad.
- `zoomToFit()` animation - using the zoomToFit() function now will animate the view to the a desired rectangle.
- A convenience method `resetView()` has been provided to animate the view back to its initial settings.
- The `zoomIn()` and `zoomOut()` API functions can zoom to either the last zoomed point rather or to the view's centre point, depending on the value of `zoomType` (`lastPoint` or `viewCenter`).
- New API methods `panToPoint()`, `panDelta()`, `panDeltaPercent()`,  `panDeltaAbsolute()`, and many others have been added.
- Many performance improvements.
- The widget has not been migrated from the original project, though this probably shouldn't be hard to do.  Pull requests are welcome!
- Touchscreen support works, but it is not great.  Work on this will continue.

## Dependencies
- Angular

## Mobile Support -- Actively Soliciting PR's

I am actively soliciting pull requests for mobile support.  Read on.

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

This library exposes a component called 'pan-zoom', under which you may place any standard Angular template code.  Though the events which trigger panning and zooming are run outside of Angular and thus themselves will not trigger change detection, it should not break change detection for any sub-components.

A configuration object is required, which gets passed in using `[config]="myConfig"`.

It also exposes an API which can be used to interact with the pan/zoom view.  The API is obtained through the configuration object (more below).

### Top Tip

Be sure to place your pan-zoom component underneath an element with a definite height/width, like an absolute-positioned div.  You may not see anything if you don't do this.

```typescript
import { PanZoomConfig, PanZoomAPI, PanZoomModel, PanZoomConfigOptions } from 'ngx-panzoom';

@Component({
  selector: 'my-component'
  template: `

    <div style="position: absolute; top: 100px; bottom: 0; left: 0; right: 0;">

      <pan-zoom [config]="panZoomConfig">

        <div style="position: relative;">

          <img src="/myimage1.jpg">

        </div>

      </pan-zoom>

    </div>
  `
})


export class MyComponent {
  ...
  panZoomConfig: PanZoomConfig = new PanZoomConfig();
  ...
}
```

## Configuration

You must first create and then pass in a configuration object (of type *PanZoomConfig*) via the `config` input property.  This configuration object also contains RXJS Observables which can be used to work with the API and also observe changes to the panzoom view.  The parameters can either be passed in as a PanZoomConfigOptions object, or set after the creation of the PanZoomConfig instance.

```typescript
panZoomConfig: PanZoomConfig = new PanZoomConfig(options?: PanZoomConfigOptions);
```

The following attributes are defined:

Name                                | Type      | Default           | Description
----------------------------------- | --------- | ----------------- | -----------
api                                 | BehaviorSubject\<PanZoomAPI\>   | Not Applicable | Subscribe to this observable to obtain access to the API for controlling panzoom programattically.  See section below on getting at the API.
zoomLevels                          | number    | 5                 | Number of discrete zoom levels, each one representing a scale.  The higher the number, the more zoomed in it is.
neutralZoomLevel                    | number    | 2                 | The zoom level at which the contents render at 1:1 scale.
scalePerZoomLevel                   | number    | 2.0               | The difference in actual scale between two adjacent zoom levels.
initialZoomLevel                    | number    | neutralZoomLevel  | The initially selected zoom level.
initialPanX                         | number    | 0                 | The initial pan in the horizontal direction.
initialPanY                         | number    | 0                 | The initial pan in the vertical direction.
initialZoomToFit                    | rectangle | null              | When defined, will initially zoom to fit the given rectangle (see API for explanation of zoom to fit). This overrides the initialZoomLevel, initialPanX, and initialPanY values.
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
modelChanged                        | BehaviorSubject&lt;PanZoomModel>      | Not Applicable         | An RXJS observable which can be subscribed to in order to observe changes to the panzoom view. The model will be passed to the callback function.
keepInBounds                        | boolean   | false             | When true, it will not be possible to pan the contents off the screen -- it will snap back when trying to do so.  It will not be possible to zoom further out than the neutral zoom level.  *REMEMBER* that the initial zoom level must either be less than or equal to the neutral zoom level, or weird things will happen.
keepInBoundsRestoreForce            | number    | 0.5               | Constant to control how quickly the contents snap back into place after attempting to pan out of bounds.
keepInBoundsDragPullback            | number    | 0.7               | Constant to control the perceived force preventing dragging the contents out of bounds.
dragMouseButton                     | string    | 'left'            | Controls which mouse button drags the view.  Valid options are `left`, `middle`, and `right`.  *NOTE:* Using `middle` and `right` will disable the default 'auxclick' and 'contextmenu' handlers, respectively.  *ALSO NOTE:* Chrome seems to have a bug that doesn't the permit the 'mousemove' event to fire after middle-click drag until it receives a normal left 'click' event.  If anyone can shed any light on this, I'd be happy to hear from you.  It's such an edge case, though, that I won't be opening a bug report, but feel free to do so if this affects you. 
noDragFromElementClass              | string    | null              | If set, this will prevent click-drag on elements who have a parent element containing a specific class name.
acceleratePan                       | boolean   | true              | Controls whether the pan frame will be hardware accelerated.
dynamicContentDimensions                       | boolean   | false              | If true, a ResizeObserver will be used to detect changes in the content dimensions.  Useful if the content dimensions can't be predicted.  Alternatively, the API methods `detectContentDimensions()` or `contentDimensionsChanged()` can also be used.  ResizeObservers may not work in some older or mobile web browsers.  See https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver for info on browser compatibility.

## API

The panzoom library provides an API for interacting with, observing, and controlling it.  The following methods and objects are available from the PanZoomAPI:

  - `model: PanZoomModel`  - The current panzoom model - see the _PanZoomModel_ Interface below.

  - `config: PanZoomConfig` - The current panzooom configuration.

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


## PanZoom API Interfaces:

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

## Getting at the API

The panzoom API is exposed through an RxJS observable as a property of the `PanZoomConfig` class, named `api`, to which you simply subscribe to obtain the API object.  The subscription callback method will be passed the API as its only parameter, of type `PanZoomAPI`.  Because it uses a BehaviorSubject, the callback will immediately trigger when subscribed to, assuming panzoom has already been initialised.  If panzoom hasn't yet been initialised, the subscription callback will fire as soon as initialisation occurs.

```typescript
import { PanZoomConfig, PanZoomAPI, PanZoomModel } from 'ngx-panzoom';
import { Subscription } from 'rxjs';

@Component({ ... })

export class MyComponent implements OnInit, OnDestroy {
 
  panZoomConfig: PanZoomConfig = new PanZoomConfig();
  private panZoomAPI: PanZoomAPI;
  private apiSubscription: Subscription;

  ngOnInit(): void {
    this.apiSubscription = this.panzoomConfig.api.subscribe( (api: PanZoomAPI) => this.panZoomAPI = api );
  }

  ngOnDestroy(): void {
    this.apiSubscription.unsubscribe();  // don't forget to unsubscribe.  you don't want a memory leak!
  }

}
```

Now that we have our API stored in `this.panZoomAPI`, we can access it thusly:

```typescript
this.panZoomAPI.zoomIn();
this.panZoomAPI.zoomOut();
```


## 'Events'

The PanZoomConfig class has an RXJS observable (`modelChanged`) which can be used to monitor the pan/zoom state from another component.  The observable emits type `PanZoomModel` (see above section on API Interfaces).  For instance, when the zoom level reaches a certain level, you may want to display a custom control or content on your page.  Another use may be to do something when the panzoom centre point is over a certain part of the view.

### Example modelChanged Subscription

```typescript
import { PanZoomConfig, PanZoomAPI, PanZoomModel } from 'ngx-panzoom';

@Component({ ... })

export class MyComponent implements OnInit, OnDestroy {
 
  panZoomConfig: PanZoomConfig = new PanZoomConfig();
  private modelChangedSubscription: Subscription;

  ngOnInit(): void {
    this.modelChangedSubscription = this.panzoomConfig.modelChanged.subscribe( (model: PanZoomModel) => this.onModelChanged(model) );
  }

  ngOnDestroy(): void {
    this.modelChangedSubscription.unsubscribe();  // don't forget to unsubscribe.  you don't want a memory leak!
  }

  onModelChanged(model: PanZoomModel): void {
    // do something after receiving your model update here
  }

}
```

## Contributing

Pull requests are welcome.

## Reference

[Martin Vindahl Olsen's original angular-pan-zoom project on GitHub](https://github.com/mvindahl/angular-pan-zoom)
