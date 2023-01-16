# Change Log

# 14.0.0
- Updated for Angular 14.x.x.

# 13.0.0
- Updated for Angular 13.x.x.

# 12.0.0
- Updated for Angular 12.x.x.

### Changed
- Compiled with partial Ivy compilation mode.

# 11.x
- Updated for Angular 11.x.x.

### Fixed
- Fix for config input being marked as private.
- Improved single-touch pan handling (thanks to @dexterbt1).

# 10.3.0

### Added
- Added options `lastPoint` (default for backwards-compatibility) and `viewCenter` to `zoomIn()` and `zoomOut()` API methods.  Defines which point to zoom to/from: either the centre of the screen or the last point zoomed to/from.
- Proper TypeScript definitions for API methods.
- Interface 'ZoomType'.

### Fixed
- Fixes for `model.isPanning` remaining true after pan end.
- `model.isPanning` was not being set for panning API calls.
- Fix for jump when freeZoom occurs during slowToHalt animation.

### Changed
- Batch apply zoom transforms for (possibly) better zoom performance / fewer reflows.
- Set minimum Angular peer dependency version to 2.0.0.  Note that this doesn't mean it's being tested with 2.0 or anything other than the most current Angular release.


# 10.2.1

### Fixed
- `dynamicContentDimensions` config option was marked as mandatory


# 10.2.0

### Added
- Config option `dynamicContentDimensions`
- API method `detectContentDimensions()`
- API method `updateContentDimensions()`


# 10.1.0

### Changed
- Renamed the module to `ngx-panzoom`.
- `Ng2PanZoomModule` is now `NgxPanZoomModule`.

### Added
- New interface `PanZoomConfigOptions` (thanks @dugnychon!).

### Fixed
- Fixes for sample code in readme (again, thanks @dugnychon).

# 10.0.0

### Changed
- Updated for Angular 10.x.
- Renamed class `panElement` to `pan-element`.
- Renamed class `zoomElement` to `zoom-element`.
- Renamed class `panzoomOverlay` to `pan-zoom-overlay`.

### Added
- New API helper method `centerContent()`
- New API helper method `centerTopLeft()`
- New API helper method `centerBottomLeft()`
- New API helper method `centerTopRight()`
- New API helper method `centerBottomRight()`
- New API helper method `centerX()`
- New API helper method `centerY()`

### Removed
- jQuery is no longer a dependency.

# 9.0.1

### Changed
- Updated to Angular 9.1.12.
- Misc. code updates.

### Fixed
- Drag-to-pan stops working (resolves https://github.com/KensingtonTech/ng2-panzoom/issues/30).


# 9.0.0

### Changed
- Updated to Angular 9.0.0.


# 8.0.0

### Changed
- Version 8.0.0 introduces a new versioning scheme to match Angular releases.  Version 8 of the library is compiled for version 8.x of Angular.  9.0.0 will be for 9.x, and so on.
- Updated to Angular 8.0.0.
- Hardware acceleration is now enabled on the pan frame, in addition to the zoom frame.  This could potentially have unintended consequences for some users, so it is configurable with the `acceleratePan` option.
- Added config option `acceleratePan` to control pan acceleration (defaults to true).
- jQuery is now a peer dependency rather than a dependency -- be sure it's installed in your project with `npm install --save jquery`.
- You can probably also remove jQuery from 'scripts' in your project's angular.json, as long as it's installed in package.json, and if you're importing it properly in your project (that is if you use jQuery at all).  This is because a typescript import is now used, as opposed to accessing the global '$' object.

# 2.2.0

### Changed
- The library has been updated for Angular 8.
- Addition of configuration parameter `noDragFromElementClass`.
- Permit all Angular versions in peer dependencies.  This is not a guarantee they will all work, though.

# 2.1.0

### Changed
- Configuration options can now be passed to the PanZoomConfig constructor, rather than only being settable after initialisation.
- Pan mouse button is now configurable via config parameter `dragMouseButton`, with values `left`, `middle`, and `right`.

# 2.0

Version 2.0 brings enhanced performance, makes adjustments for modern hardware and browsers, cleans up a lot of underlying code, and _may_ also bring backwards-compatibility for Angular 2 (no promises, though).

### Changed
- Version 2.0 has seen a fair number of under-the-bonnet (or hood) changes which should hopefully result in better panning and zooming performance.
- Free wheel zooming is now the default experience and as such, `freeMouseWheel` now defaults to true.
- The mouse wheel default direction has been inverted, so your `invertMouseWheel` setting may need to be flipped.
- Several config options have been removed: `useHardwareAcceleration`, `chromeUseTransform`, and `disableZoomAnimation`.
- The dependency on ng2-mousewheel has been removed.
- It no longer requires Renderer2, so it may, at least _in theory_, work with Angular 2.  Please send reports either way.
- It's 2019, so the library now assumes that all browsers and hardware have hardware acceleration.
- Older browser-specifc CSS transforms have been removed in favour of newer standards-based transforms (i.e. '-webkit' and '-moz' prefixes and the like have been removed), which may cause breakage with older browsers.  If that's a problem, you should stick with version 1.x.
