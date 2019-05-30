# ng2-panzoom

An Angular directive for panning and zooming an element or elements using the mouse and mousewheel.  Provides basic support for touchscreens, though it can still do with improvement.  It was adapted from the angular-pan-zoom library for AngularJS, but it has been heavily modified.  Many thanks go out to Martin Vindahl Olsen for having written it, and for his blessing in this undertaking.

It is built with Angular CLI 8 library support, so please excuse the 'ng2' moniker.  This version has been confirmed to work with Angular versions 6.1 and 8, and should also be compatible with earlier Angular versions.  As such, the peer depencies permit installation all the way back to Angular 2.  Reports on compatibility with other Angular versions are welcome.

This library deliberately parts with certain received Angular wisdom of using only Angular-ish methods to accomplish things.  We use native event listeners.  We apply CSS transforms directly to the DOM.  We even use a dash of jQuery.  But as this library doesn't fit the traditional Angular model as its purpose is only to alter a certain part of the DOM using CSS transforms, without adding, moving or changing anything else, it has no impact on an application's state (except if the app consumes `modelChanged` observables).  By using this approach, I hope to maximise compatibility and performance.

## Demo
Click [here](https://kensingtontech.github.io/ng2-panzoom-demo) for a demo of the module.  The demo source can be found [here](https://github.com/KensingtonTech/ng2-panzoom-demo).

## Features
* Zoom using mouse wheel, touch surface, double click, or API controls tied to your own UI.
* Pan using click/touch and drag, or API calls. When releasing the mouse button or touch surface whilst panning, the pan will come to a gradual stop.

## Version 2.2.0 Changes

Version 2.2.0 contains two changes:

* The library has been updated for Angular 8.
* Addition of configuration parameter `noDragFromElementClass`.
* Permit all Angular versions in peer dependencies.  This is not a guarantee they will all work, though.

## Version 2.1.0 Changes

Version 2.1.0 is a minor release with a couple of small changes:

* Configuration options can now be passed to the PanZoomConfig constructor, rather than only being settable after initialisation.
* Pan mouse button is now configurable via config parameter `dragMouseButton`, with values `left`, `middle`, and `right`.

## Version 2.0 Changes

Version 2.0 brings enhanced performance, makes adjustments for modern hardware and browsers, cleans up a lot of underlying code, and _may_ also bring backwards-compatibility for Angular 2 (no promises, though).

* Version 2.0 has seen a fair number of under-the-bonnet (or hood) changes which should hopefully result in better panning and zooming performance.
* Free wheel zooming is now the default experience and as such, `freeMouseWheel` now defaults to true.
* The mouse wheel default direction has been inverted, so your `invertMouseWheel` setting may need to be flipped.
* Several config options have been removed: `useHardwareAcceleration`, `chromeUseTransform`, and `disableZoomAnimation`.
* The dependency on ng2-mousewheel has been removed.
* Touch / mobile support - The library will now work with touch devices, though pinch-to-zoom still needs considerable work to make the experience what one would expect.  It wasn't worth delaying release to perfect this, though.  Future releases may see improvements.
* It no longer requires Renderer2, so it may, at least _in theory_, work with Angular 2.  Please send reports either way.
* It's 2019, so the library now assumes that all browsers and hardware have hardware acceleration.
* Older browser-specifc CSS transforms have been removed in favour of newer standards-based transforms (i.e. '-webkit' and '-moz' prefixes and the like have been removed), which may cause breakage with older browsers.  If that's a problem, you should stick with version 1.x.



### Differences From the Original

* The pan-zoom service has been eliminated.
* **Free zoom** - zooming is no longer limited to switching between two distinct zoom levels.  Zoom can now be smoothly and freely controlled using the mouse wheel or trackpad.
* `zoomToFit()` animation - using the zoomToFit() function now will animate the view to the a desired rectangle.
* A convenience method `resetView()` has been provided to animate the view back to its initial settings.
* The `zoomIn()` and `zoomOut()` API functions now zoom to the last zoomed point rather than the centre point, unless no zoom point has been defined yet.
* New API methods `panToPoint()`, `panDelta()`, `panDeltaPercent()`, and `panDeltaAbsolute()` have been added for panning the view.
* Completely removed Renderer2 dependency in favour of native event listeners, so this _may_ work with Angular 2.  This was actually done to preserve passive event listener functionality from ng2-mousewheel, which Angular isn't able to do natively at the time of writing, at least with ease.
* Many performance improvements.
* The widget has not been migrated from the original project, though this probably shouldn't be hard to do.  Pull requests are welcome!
* Touchscreen support works, but it is not great.  Work on this will continue.

### Dependencies
* Angular
* jQuery - Used for calculating positions of DOM elements (way easier than using Angular or JS methods).


## Installation

```
npm install ng2-panzoom --save
```

### angular.json:
```json
"projects": {
    "my-angular-app": {
      "architect": {
        "build": {
          "options": {
            "scripts": [
              "node_modules/jquery/dist/jquery.min.js",
            ]
            ...
```

### app.module.ts:
```typescript
import { Ng2PanZoomModule } from 'ng2-panzoom';

@NgModule({
  imports: [  ...,
              Ng2PanZoomModule
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
import { PanZoomConfig, PanZoomAPI, PanZoomModel } from 'ng2-panzoom';

@Component({
  selector: 'my-component'
  template: `
    <div style="position: absolute; top: 100px; bottom: 0; left: 0; right: 0;">
      <pan-zoom [config]="panzoomConfig">
        <div style="position: relative;">
          <img src="/myimage1.jpg">
        </div>
      </pan-zoom>
    </div>
  `
})


export class MyComponent {
  ...
  private panZoomConfig: PanZoomConfig = new PanZoomConfig;
  ...
}
```

## Configuration
You must first create and then pass in a configuration object (of type *PanZoomConfig*) via the `config` input property.  This configuration object also contains RXJS Observables which can be used to work with the API and also observe changes to the panzoom view.

```typescript
private panZoomConfig: PanZoomConfig = new PanZoomConfig;
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

## API
The panzoom library provides an API for interacting with, observing, and controlling it.  The following methods and objects are available from the PanZoomAPI:

  * `model: PanZoomModel`  - The current panzoom model - see the _PanZoomModel_ Interface below.

  * `config: PanZoomConfig` - The current panzooom configuration.

  * `changeZoomLevel(newZoomLevel: number, clickPoint: Point)` - This method will reset the view to _newZoomLevel_, with _clickPoint_ as its centre point.

  * `zoomIn()` - This will zoom the view in to the last zoomed point by one zoom level.

  * `zoomOut()` - This will zoom the view out from the last zoomed point by one zoom level.

  * `zoomToFit(rectangle: Rect, [duration: number])` - Animates the view to focus on a rectangle of the underlying canvas.  **duration** is how long the animation should take (in seconds), and is optional.  **rectangle** is two coordinates on the canvas which the panZoom view is pan/zooming.  See the below section on PanZoom Interfaces for its definition.
 
  * `resetView()` - A shortcut method to reset the pan and zoom back to the initial view.
  
  * `getViewPosition(modelPosition: Point)` - By passing in x,y coordinates of the original, untransformed content canvas, it will return the current pixel position of this point.
  
  * `getModelPosition(viewPosition: Point)` - The reverse operation of getViewPosition().

  * `panToPoint(point: Point, [duration: number])` - Will animate the view so that the centre point of the view is at the *point* parameter coordinates, relative to the original, unzoomed content width and height.

  * `panDelta(delta: Point, [duration: number])` - Will pan the view left, right, up, or down, based on a number of pixels relative to the original, unzoomed content.

  * `panDeltaPercent(deltaPercent: Point, [duration: number])` - Will pan the view up, down, left, or right, based on a percentage of the original, unzoomed content width and height.
  
  * `panDeltaAbsolute(delta: Point, [duration: number])` - Will pan the view left, right, up, or down, based on a number of pixels.  This method doesn't adjust for scale.  I'm not sure why you'd want this, but it's provided just in case.


### PanZoom API Interfaces:
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

### Getting at the API
The panzoom API is exposed through an RXJS observable as a property of the `PanZoomConfig` class, named `api`, to which you simply subscribe to obtain the API object.  The subscription callback method will be passed the API as its only parameter, of type `PanZoomAPI`.  Because it uses a BehaviorSubject, the callback will immediately trigger when subscribed to, assuming panzoom has already been initialised.  If panzoom hasn't yet been initialised, the subscription callback will fire as soon as initialisation occurs.

```typescript
import { PanZoomConfig, PanZoomAPI, PanZoomModel } from 'ng2-panzoom';
import { Subscription } from 'rxjs';

@Component({ ... })

export class MyComponent implements OnInit, OnDestroy {
 
  private panZoomConfig: PanZoomConfig = new PanZoomConfig;
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
import { PanZoomConfig, PanZoomAPI, PanZoomModel } from 'ng2-panzoom';

@Component({ ... })

export class MyComponent implements OnInit, OnDestroy {
 
  private panZoomConfig: PanZoomConfig = new PanZoomConfig;
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

# Contributing
Pull requests are welcome.

## Reference

[The original angular-pan-zoom project on GitHub](https://github.com/mvindahl/angular-pan-zoom)