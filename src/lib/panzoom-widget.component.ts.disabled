angular.module('panzoomwidget', [])
.directive('panzoomwidget', ['$document', 'PanZoomService',
function ($document, PanZoomService) {
  var panzoomId;

  return {
    restrict: 'E',
    transclude: true,
    compile: function compile(/*tElement, tAttrs, transclude*/) {
      return {
        pre: function preLink(/*scope, iElement, iAttrs, controller*/) { },
        post: function postLink(scope, iElement, iAttrs /*, controller*/) {
          // we pick the value ourselves at this point, before the controller is instantiated,
          // instead of passing it as a scope variable. This is to not force people to type quotes
          // around the string.
          // Note: we need to use iAttrs and not directly get the attribute on the element to
          // be sure to get the interpolated value ({{foo}})
          panzoomId = iAttrs.panzoomId;

          if (!panzoomId) {
            throw 'Error in setup. You must define attribute panzoom-id on the <panzoomwidget> element in order to link it to the ' +
            'id of the <panzoom> element. Ref: ';
          }
          PanZoomService.getAPI(panzoomId).then(function (api) {
            scope.model = api.model;
            scope.config = api.config;

            var zoomSliderWidget = iElement.find('.zoom-slider-widget');
            var isDragging = false;

            var sliderWidgetTopFromZoomLevel = function (zoomLevel) {
              return ((scope.config.zoomLevels - zoomLevel - 1) * scope.widgetConfig.zoomLevelHeight);
            };

            var zoomLevelFromSliderWidgetTop = function (sliderWidgetTop) {
              return scope.config.zoomLevels - 1 - sliderWidgetTop / scope.widgetConfig.zoomLevelHeight;
            };

            var getZoomLevelForMousePoint = function ($event) {
              var sliderWidgetTop = $event.pageY - iElement.find('.zoom-slider').offset().top - scope.widgetConfig.zoomLevelHeight / 2;
              return zoomLevelFromSliderWidgetTop(sliderWidgetTop);
            };

            scope.getZoomLevels = function () {
              var zoomLevels = [];
              for (var i = scope.config.zoomLevels - 1; i >= 0; i--) {
                zoomLevels.push(i);
              }
              return zoomLevels;
            };

            scope.widgetConfig = {
              zoomLevelHeight: 10
            };

            scope.zoomIn = function () {
              api.zoomIn();
            };

            scope.zoomOut = function () {
              api.zoomOut();
            };

            scope.onClick = function ($event) {
              var zoomLevel = getZoomLevelForMousePoint($event);
              api.changeZoomLevel(zoomLevel);
            };

            scope.onMousedown = function () {
              isDragging = true;

              $document.on('mousemove', scope.onMousemove);
              $document.on('mouseup', scope.onMouseup);
            };

            scope.onMousemove = function ($event) {
              $event.preventDefault();
              var zoomLevel = getZoomLevelForMousePoint($event);
              api.changeZoomLevel(zoomLevel);
            };

            scope.onMouseup = function () {
              isDragging = false;

              $document.off('mousemove', scope.onMousemove);
              $document.off('mouseup', scope.onMouseup);
            };

            scope.onMouseleave = function () {
              isDragging = false;
            };

            // $watch is not fast enough so we set up our own polling
            setInterval(function () {
              zoomSliderWidget.css('top', sliderWidgetTopFromZoomLevel(scope.model.zoomLevel) + 'px');
            }, 25);
          });
        }
      };
    },
    template: '<div class="panzoomwidget">' +
    '<div ng-click="zoomIn()" ng-mouseenter="zoomToLevelIfDragging(config.zoomLevels - 1)" class="zoom-button zoom-button-in">+</div>' +
    '<div class="zoom-slider" ng-mousedown="onMousedown()" ' +
    'ng-click="onClick($event)">' +
    '<div class="zoom-slider-widget" ng-style="{\'height\': widgetConfig.zoomLevelHeight - 2 +\'px\'}"></div>' +
    '<div ng-repeat="zoomLevel in getZoomLevels()" ' +
    ' class="zoom-level zoom-level-{{zoomLevel}}" ng-style="{\'height\': widgetConfig.zoomLevelHeight +\'px\'}"></div>' +
    '</div>' +
    '<div ng-click="zoomOut()" ng-mouseenter="zoomToLevelIfDragging(0)" class="zoom-button zoom-button-out">-</div>' +
    '<div ng-transclude></div>' +
    '</div>',
    replace: true
  };
}]);
