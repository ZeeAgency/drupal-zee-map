define(function() {
  'use strict';

  /* @ngInject */
  function mapDirective() {
    return {
      scope: {
        mapOptions: '=zeeMapOptions',
        onMapReady: '=zeeMapOnReady',
        onMapBoundsChange: '=zeeMapOnBoundsChange'
      },
      controller: MapController
    };

    /* @ngInject */
    function MapController($scope, $element, $attrs, $q, $timeout, zeeMapLoader) {
      var self = this;
      var deferred = $q.defer();

      self.whenMapReady = deferred.promise;
      self.panToOffset = _panToOffset;
      self.setCenter = _setCenter;

      zeeMapLoader()
        .then(function() {
          $timeout(_onLoad, 50);
        });

      $scope.$watch('mapOptions', function(newValue, oldValue) {
        if (newValue && newValue !== oldValue) {
          // Center & Zoom is already
          var comparingValue = angular.extend({}, oldValue, {
            bounds: newValue.bounds,
            center: newValue.center,
            zoom: newValue.zoom,
          });
          if (!angular.equals(newValue, comparingValue)) {
            _setOptions(newValue);
          }
        }
      }, true);

      $scope.$watch('mapOptions.bounds', function(newValue, oldValue) {
        if (newValue !== oldValue) {
          _setBounds(newValue);
        }
      }, true);

      $scope.$watch('mapOptions.center', function(newValue, oldValue) {
        if (newValue !== oldValue) {
          _setCenter(newValue);
        }
      }, true);

      $scope.$watch('mapOptions.zoom', function(newValue, oldValue) {
        if (newValue !== oldValue) {
          _setZoom(newValue);
        }
      });

      function _onLoad() {
        var mapCanvas = _findMapCanvas($element);

        /**/
        if (!mapCanvas) {
          mapCanvas = document.createElement('div');
        }
        /**/

        if (mapCanvas) {
          self.map = new google.maps.Map(mapCanvas, angular.extend({}, _getDefaultOptions(), $scope.mapOptions));
          // window.map = self.map;
          deferred.resolve(self.map);

          if($scope.onMapReady) {
            $scope.onMapReady(self.map);
          }

          google.maps.event.addListener(self.map, 'bounds_changed', _debounce(function(e) {
            // $timeout(function() {
              var center = self.map.getCenter();
              var zoom = self.map.getZoom();

              if ($scope.mapOptions) {
                $scope.mapOptions.bounds = null;
                $scope.mapOptions.center.lat = center.lat();
                $scope.mapOptions.center.lng = center.lng();
                $scope.mapOptions.zoom = zoom;
              }

              if ($scope.onMapBoundsChange) {
                $scope.onMapBoundsChange(self.map, e);
              }
            // }, 200);
          }, 200));

          if ($scope.mapOptions) {
            _setBounds($scope.mapOptions.bounds);
          }
        }
      }

      function _setOptions(options) {
        options = options ||  {};
        self.whenMapReady.then(function(map) {
          options = angular.extend({}, _getDefaultOptions(), options);
          if(typeof options.mapTypeId === 'string') {
            options.mapTypeId = google.maps.MapTypeId[options.mapTypeId];
          }
          map.setOptions(options);
        });
      }

      function _setBounds(bounds) {
        if (bounds) {
          self.whenMapReady.then(function(map) {
            map.fitBounds(bounds);
          });
        }
      }

      function _setCenter(center) {
        if (center) {
          if ('lat' in center) {
            center.lat = center.lat * 1;
          }
          if ('lng' in center) {
            center.lng = center.lng * 1;
          }
          self.whenMapReady.then(function(map) {
            map.panTo(center);
          });
        }
      }

      function _setZoom(zoom) {
        self.whenMapReady.then(function(map) {
          map.setZoom(zoom);
        });
      }

      function _getDefaultOptions() {
        var defaultOptions = {
          zoom: 2,
          scrollwheel: false,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          center: {
            lat: 0,
            lng: 0
          },
          disableDefaultUI: false
          // styles: mapStyles
        };
        return defaultOptions;
      }

      function _findMapCanvas($mapElement) {
        var mapCanvas;
        angular.forEach($mapElement.children(), function(child) {
          if (child.getAttribute('zee-map-canvas') !== null) {
            mapCanvas = child;
          }
        });
        return mapCanvas;
      }

      function _panToOffset(offsetX, offsetY) {
        self.whenMapReady.then(function(map) {
          var zoom = map.getZoom();
          var projection = map.getProjection();
          var startPoint = projection.fromLatLngToPoint(map.getCenter());

          var endPointX = ((typeof(offsetX) == 'number' ? offsetX : 0) / Math.pow(2, zoom)) || 0;
          var endPointY = ((typeof(offsetY) == 'number' ? offsetY : 0) / Math.pow(2, zoom)) || 0;
          var endPoint = new google.maps.Point(endPointX, endPointY);

          var movePoint = new google.maps.Point(
            startPoint.x - endPoint.x,
            startPoint.y + endPoint.y
          );
          var moveLatLng = projection.fromPointToLatLng(movePoint);

          $scope.mapOptions.center.lat = moveLatLng.lat();
          $scope.mapOptions.center.lng = moveLatLng.lng();
        });
      }
    }
  }

  // Debounce from https://github.com/jashkenas/underscore/blob/master/underscore.js#L811
  function _debounce(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  }

  var _now = Date.now || function() {
    return new Date()
      .getTime();
  };

  return mapDirective;
});
