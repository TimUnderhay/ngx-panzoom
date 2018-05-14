# ng2-panzoom

An Angular directive for panning and zooming an element or elements using the mouse and mousewheel.  Code is in place to support touchscreens, but it is completely untested.  It was adapted from the angular-pan-zoom library for AngularJS, but it has been heavily modified.  Many thanks go out to Martin Vindahl Olsen for writing it.

It is built using Angular CLI 6 library support, so it may not work with Angular versions 2 through 5 (please excuse the 'ng2' moniker).

## Features
* Zoom using mouse wheel, double click, or API controls tied to your own UI
* Pan using click and drag. When releasing the mouse button whilst panning, the pan will come to a gradual stop.

### Differences From the Original

* The pan-zoom service has been eliminated.
* **Free zoom** - zooming is no longer limited to switching between two distinct zoom levels.  Zoom can now be smoothly and freely controlled using the mouse wheel.
* `zoomToFit()` animation - using the zoomToFit() function now will animate the view to the the desired rectangle.
* A convenience method `resetView()` has been provided to reset the view back to its original `initialZoomToFit` settings
* The `zoomIn()` and `zoomOut()` API functions now zoom to the last zoomed point rather than the centre point, unless no zoom point has been defined yet.
* The widget has not been migrated from the original project, though this probably shouldn't be hard to do.  Pull requests are welcome!
* Performance improvements

### Dependencies
* Angular
* jQuery - Used for calculating positions of DOM elements
* ng2-mousewheel - for mouse wheel support


## Installation

`npm install ng2-panzoom --save`

### angular.json:
```json
"projects": {
    "my-angular-app": {
      "architect": {
        "build": {
          "options": {
            "scripts": [
              "node_modules/jquery/dist/jquery.min.js",
              "node_modules/@kensingtontech/hamsterjs/hamster.js"
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
}
```

## Configuration
You must pass in a configuration object (of type *PanZoomConfig*) via the `config` input property.  This configuration object also contains RXJS Observables which can be used to work with the API and also observe changes to the panzoom view

The following attributes are defined:

Name                                | Type      | Default           | Description
----------------------------------- | --------- | ----------------- | -----------
api                                 | BehaviorSubject\<PanZoomAPI\>   | Not Applicable | Subscribe to this observable to obtain access to the API for controlling panzoom programattically.  See section below on getting at the API
zoomLevels                          | number    | 5                 | Number of discrete zoom levels, each one representing a scale
neutralZoomLevel                    | number    | 2                 | The zoom level at which the contents render at 1:1 scale
scalePerZoomLevel                   | number    | 2.0               | The difference in actual scale between two adjacent zoom levels
initialZoomLevel                    | number    | neutralZoomLevel  | The initially selected zoom level
initialPanX                         | number    | 0                 | The initial pan in the horizontal direction
initialPanY                         | number    | 0                 | The initial pan in the vertical direction
initialZoomToFit                    | rectangle | undefined         | When defined, will initially zoom to fit the given rectangle (see API for explanation of zoom to fit). This overrides the initialZoomLevel, initialPanX, and initialPanY values
zoomToFitZoomLevelFactor            | number    | 0.95              | A number to indicate how closely zoom to fit will work. 1.0 is a perfect fit.  Lowering the number will reveal a bit of the surrounding contents
zoomOnDoubleClick                   | boolean   | true              | Enable or disable zoom in on double click
zoomButtonIncrement                 | number    | 1.0               | The amount of zoom levels to zoom on double click
zoomStepDuration                    | number    | 0.2               | Amount of seconds to animate between two adjacent zoom levels
disableZoomAnimation                | boolean   | false             | Set to true to disable the animation while zooming. It will be more chunky but will consume less CPU resources
zoomOnMouseWheel                    | boolean   | true              | Enable or disable zoom in/out on mouse wheel
invertMouseWheel                    | boolean   | false             | Invert the behaviour of the mouse wheel (or two finger trackpad gesture)
freeMouseWheel                      | boolean   | false             | By default, moving the mouse wheel will result in a change of _zoomButtonIncrement_.  By setting this to true, the mouse wheel will freely zoom the view without respect to discreet zoom levels
freeMouseWheelFactor                | number    | 0.08              | How much to zoom the view with every tick of the wheel, if using freeMouseWheel
friction                            | number    | 10.0              | Constant which controls the friction when dragging and then letting go. The higher the number, the more quickly the animation will come to a stop
haltSpeed                           | number    | 100.0             | Constant which controls when the pan animation has slowed down enough to be terminated. The lower the number, the longer time it will run
panOnClickDrag                      | boolean   | true              | Enable or disable pan on clicking and dragging the mouse
modelChanged                        | Subject<PanZoomModel>   | Not Applicable         | An RXJS observable which can be subscribed to in order to observe changes to the panzoom view. The model will be passed to the function
useHardwareAcceleration             | boolean   | true              | Use translate3d for panning instead of using standard CSS styles 'left' and 'top'. This is intended to trigger hardware acceleration and may increase the speed greatly. In future versions, this may be set to true as default
chromeUseTransform                  | boolean   | true              | Cause Chrome to use CSS transform instead of CSS zoom. Enable if you use nested SVG and see performance problems in Chrome
keepInBounds                        | boolean   | false             | When true, it will not be possible to pan the contents off the screen -- it will snap back when trying to do so -- and it will not be possible to zoom further out than the neutral zoom level
keepInBoundsRestoreForce            | number    | 0.5               | Constant to control how quickly the contents snap back in place after attempting to pan off bounds
keepInBoundsDragPullback            | number    | 0.7               | Constant to control the perceived force preventing dragging the contents off limits

## API
The panzoom library provides an API for interacting with, observing, and controlling it.  The following methods and objects are available from the PanZoomAPI:

  * `model: PanZoomModel`  - The current panzoom model - see the _PanZoomModel_ Interface below

  * `config: PanZoomConfig` - The current panzooom configuration

  * `changeZoomLevel(newZoomLevel: number, clickPoint: Point)` - This method will reset the view to _newZoomLevel_, with _clickPoint_ as its centre point

  * `zoomIn()` - This will zoom the view in to the last zoomed point by one zoom level

  * `zoomOut()` - This will zoom the view out from the last zoomed point by one zoom level

  * `zoomToFit(rectangle: Rect, [duration: number])` - Animates the view to focus on a rectangle of the underlying canvas.  **duration** is how long the animation should take (in seconds), and is optional.  **rectangle** is two coordinates on the canvas which the panZoom view is pan/zooming.  See the below section on PanZoom Interfaces for its definition.
 
  * `resetView()` - A shortcut method to reset the pan and zoom to the initial view defined by **PanZoomConfig.initialZoomToFit**
  
  * `getViewPosition(modelPosition: Point)` - By passing in x,y coordinates of the original, untransformed content canvas, it will return the current pixel position of this point
  
  * `getModelPosition(viewPosition: Point)` - The reverse operation of getViewPosition()


### PanZoom API Interfaces:
```typescript
interface PanZoomModel {
  zoomLevel: number;
  isPanning?: boolean;
  pan: Point; // the current centre point of the pan/zoom view
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
The panzoom API is exposed as an RXJS observable through the PanZoomConfig class named `api`, to which you simply subscribe to obtain access.  The subject will be triggered immediately upon subscribing, assuming that ng2-panzoom is already initialised.  Because it's a BehaviorSubject, you will always get the API when you subscribe, during or after panzoom's initialisation.

```typescript
import { PanZoomConfig, PanZoomAPI, PanZoomModel } from 'ng2-panzoom';
import { Subscription } from 'rxjs';

export class MyComponent implements OnInit, OnDestroy {
 
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

export class MyComponent implements OnInit, OnDestroy {
 
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

## Reference

[ng2-mousewheel project](https://github.com/KensingtonTech/ng2-mousewheel)

[The original angular-pan-zoom project on GitHub](https://github.com/mvindahl/angular-pan-zoom)