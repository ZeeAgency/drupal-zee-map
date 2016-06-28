(function($){define('map-loader.provider',[],function() {
  'use strict';

  var resolved = false;
  var started = false;

  /* @ngInject */
  function mapLoaderProvider() {

    this.options = {
      v: '3.exp',
      key: '',
      libraries: '',
      language: 'fr'
    };

    this.configure = function(options) {
      angular.extend(this.options, options);
    };

    this.$get = ['$q', '$timeout',
      function($q, $timeout) {
        var deferred = $q.defer(),
          iteration = 0;

        function checkVars() {
          if (window.google && window.google.maps && window.google.maps.LatLng) {
            resolved = true;
            deferred.resolve();
          } else if (++iteration < 100) {
            $timeout(checkVars, 200);
          } else {
            console.warn('100 iterations and no maps');
          }
        }

        window._loadGoogleMapsService = function() {
          checkVars();
        };

        if (resolved) {
          deferred.resolve();
        } else if (!started) {
          started = true;
          var url = '//maps.googleapis.com/maps/api/js?' +
            'v=' + this.options.v +
            '&key=' + this.options.key +
            (this.options.libraries ? '&libraries=' + this.options.libraries : '') +
            '&callback=_loadGoogleMapsService';
          // console.log('url: ', url);
          _loadJS(url);
        }

        return function() {
          return deferred.promise;
        };
      }
    ];
  }

  return mapLoaderProvider;

  /*! loadJS: load a JS file asynchronously. [c]2014 @scottjehl, Filament Group, Inc. (Based on http://goo.gl/REQGQ by Paul Irish). Licensed MIT */
  function _loadJS(src, cb) {
    var ref = window.document.getElementsByTagName('script')[0];
    var script = window.document.createElement('script');
    script.src = src;
    script.async = true;
    ref.parentNode.insertBefore(script, ref);
    if (cb && typeof(cb) === 'function') {
      script.onload = cb;
    }
    return script;
  }
});

define('map.directive',[],function() {
  'use strict';

  /* @ngInject */
  function mapDirective() {
    MapController.$inject = ['$scope', '$element', '$attrs', '$q', '$timeout', 'zeeMapLoader'];
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

define('map-cluster.directive',[
  'require'
], function(require) {
  'use strict';

  /* @ngInject */
  function mapClusterDirective() {
    ClusterController.$inject = ['$scope', '$element', '$attrs', '$q'];
    return {
      require: '^zeeMap',
      scope: {
        clusterOptions: '=zeeMapClusterOptions'
      },
      compile: function() {
        return {
          post: angular.noop,
          pre: function($scope, $element, $attrs, mapController) {

            mapController.whenMapReady.then(function(map) {
              require(['./plugins/marker-clusterer'], function() {
                /* global MarkerClusterer */
                var clusterStyles = [{
                  url: '/img/map/cluster-1.png',
                  width: 53,
                  height: 72,
                  anchor: [20, 0],
                  textColor: '#ffffff',
                  textSize: 10
                }, {
                  url: '/img/map/cluster-2.png',
                  width: 56,
                  height: 77,
                  anchor: [22, 0],
                  textColor: '#ff0000',
                  textSize: 11
                }, {
                  url: '/img/map/cluster-3.png',
                  width: 66,
                  height: 91,
                  anchor: [26, 0],
                  textColor: '#ffffff',
                  textSize: 12
                }];

                clusterStyles = [{
                  url: '/img/map/cluster.png',
                  width: 68,
                  height: 68 + 18,
                  anchor: [18, 0],
                  textColor: '#75a84c',
                  textSize: 24
                }];

                var clusterOptions = angular.extend({
                  gridSize: 60,
                  maxZoom: 20,
                  styles: clusterStyles
                }, $scope.clusterOptions);

                $scope.cluster = new MarkerClusterer(map, [], clusterOptions);

                google.maps.event.addListener($scope.cluster, 'clusterclick', function(cluster) {
                  // alert('cluster click');
                  // console.log('cluster click', arguments, cluster.getMap().getZoom());
                });

                if (!$scope.$$phase) {
                  $scope.$apply();
                }
              });
            });
          }
        };
      },
      controller: ClusterController
    };

    /* @ngInject */
    function ClusterController($scope, $element, $attrs, $q) {
      var self = this;
      var deferred = $q.defer();
      var whenClusterReady = deferred.promise;

      self.addMarker = _addMarker;
      self.refreshCluster = _refreshCluster;
      self.removeMarker = _removeMarker;

      $scope.$watch('cluster', function(newValue, oldValue) {
        if(newValue) {
          self.cluster = newValue;
          deferred.resolve(self.cluster);
        }
      });

      function _addMarker(marker) {
        whenClusterReady.then(function(cluster) {
          cluster.addMarker(marker);

          google.maps.event.addListener(marker, 'position_changed', _refreshCluster);
        });
      }

      function _removeMarker(marker) {
        whenClusterReady.then(function(cluster) {
          cluster.removeMarker(marker);
          _refreshCluster();
        });
      }

      function _refreshCluster() {
        whenClusterReady.then(function(cluster) {
          var markers = cluster.getMarkers();
          cluster.clearMarkers();
          cluster.addMarkers(markers);
        });
      }
    }
  }

  return mapClusterDirective;
});

define('map-marker.directive',[],function() {
  'use strict';

  /* @ngInject */
  function mapMarkerDirective() {
    MarkerController.$inject = ['$scope', '$element', '$attrs', '$q'];
    return {
      require: [
          '^zeeMap',
          '?^zeeMapCluster'
        ],
      scope: {
        markerOptions: '=zeeMapMarkerOptions',
        markerPosition: '=?zeeMapMarkerPosition',
        markerClass: '=?zeeMapMarkerClass',
        onClick: '&zeeMapMarkerOnClick'
      },
      link: function($scope, $element, $attrs, controllers) {
        var mapController = controllers[0];
        var clusterController = controllers[1];

        function _parseIcon(icon) {
          if(!icon || typeof icon === 'string') {
            return icon;
          }

          if(icon.url2x) {
            // TODO
            // icon.url = icon.url2x;
          }

          if('size' in icon) {
            icon.size = new google.maps.Size(icon.size.width, icon.size.height);
          }
          if('scaledSize' in icon) {
            icon.scaledSize = new google.maps.Size(icon.scaledSize.width, icon.scaledSize.height);
          }
          if('origin' in icon) {
            icon.origin = new google.maps.Point(icon.origin.x, icon.origin.y);
          }
          if('anchor' in icon) {
            icon.anchor = new google.maps.Point(icon.anchor.x, icon.anchor.y);
          }

          return icon;
        }

        $scope.$watch('markerOptions', function(newValue) {
          if(!$scope.marker && newValue) {
            mapController.whenMapReady.then(function(map) {

              $scope.markerOptions.icon = _parseIcon($scope.markerOptions.icon);

              if(!$scope.markerClass) {
                $scope.markerClass = google.maps.Marker;
              }

              $scope.marker = new $scope.markerClass($scope.markerOptions);

              if (clusterController) {
                clusterController.addMarker($scope.marker);
              } else {
                $scope.marker.setMap(map);
              }

              if ($scope.onClick) {
                google.maps.event.addListener($scope.marker, 'click', function(e) {
                  $scope.onClick();
                  if (!$scope.$$phase) {
                    $scope.$apply();
                  }
                });
              }
            });
          }
        }, true);


        $scope.$watch('markerOptions.position', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            _setPosition(newValue);
          }
        }, true);

        $scope.$watch('markerOptions.icon.url', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            _setIcon(newValue);
          }
        });

        $scope.$watch('markerPosition', function(newValue, oldValue) {
          if (newValue) {
            _setPosition(newValue);
          }
        }, true);

        $scope.$on('$destroy', function() {
          mapController.whenMapReady.then(function(map) {
            if ($scope.marker) {
              $scope.marker.setMap(null);

              if (clusterController) {
                clusterController.removeMarker($scope.marker);
              }
            }
          });
        });

        function _setIcon() {
          mapController.whenMapReady.then(function(map) {
            if ($scope.marker) {
              $scope.markerOptions.icon = _parseIcon($scope.markerOptions.icon);
              $scope.marker.setOptions({
                icon: $scope.markerOptions.icon
              });
            }
          });
        }

        function _setPosition(position) {
          if ('lat' in position) {
            position.lat = position.lat * 1;
          }
          if ('lng' in position) {
            position.lng = position.lng * 1;
          }
          mapController.whenMapReady.then(function(map) {
            if ($scope.marker) {
              $scope.marker.setPosition(position);
            }
          });
        }
      },
      controller: MarkerController
    };

    /* @ngInject */
    function MarkerController($scope, $element, $attrs, $q) {
      var self = this;
      var deferred = $q.defer();

      self.whenMarkerReady = deferred.promise;
      self.marker = null;

      $scope.$watch('marker', function(newValue, oldValue) {
        if (newValue && !self.marker) {
          self.marker = newValue;
          deferred.resolve(self.marker);
        }
      });
    }
  }

  return mapMarkerDirective;
});

define('map-infobox.directive',[
  'require'
], function(require) {
  'use strict';

  /* @ngInject */
  mapInfoboxDirective.$inject = ['$compile'];
  function mapInfoboxDirective($compile) {
    var infoboxes = [];

    return {
      require: [
        '^zeeMap',
        '^zeeMapMarker',
      ],
      scope: {
        infoboxOptions: '=zeeMapInfoboxOptions',
        onClose: '&zeeMapInfoboxOnClose'
      },
      link: function($scope, $element, $attrs, controllers) {
        var mapController = controllers[0];
        var markerController = controllers[1];

        $scope.infobox = null;
        $scope.infoboxes = infoboxes;

        // TEMP RESPONSIVE CRADO
        var isDesktop = $(window).width() >= 960;

        markerController.whenMarkerReady.then(function(marker) {

          // Centrage sur le marker...
          mapController.setCenter({
            lat: marker.position.lat(),
            lng: marker.position.lng()
          });

          // Centrage pour le filtre à gauche sur desktop et le mobile
          if(isDesktop) {
            mapController.panToOffset(320 / 2, 0);
          } else {
            mapController.panToOffset(0, -160);
          }


          require(['./plugins/infobox'], function() {
            /* global InfoBox */

            var width = 300;

            if(isDesktop) {
              width = 460;
            }

            $scope.infobox = new InfoBox({
              alignBottom: true,
              content: $element.html(),
              disableAutoPan: false,
              maxWidth: width,
              pixelOffset: new google.maps.Size(-width / 2, -32),
              zIndex: null,
              boxStyle: {
                width: width + 'px'
              }
            });

            for (var i = 0; i < $scope.infoboxes.length; i++) {
              $scope.infoboxes[i].close();
            }

            $scope.infoboxes.push($scope);
            $scope.infobox.open(marker.getMap(), marker);
            $scope.infobox.setVisible(true);

            $scope.$parent.$on('$destroy', function() {
              $scope.close();
            });

            // Infobox is async
            _checkInfobox(function(infoboxDiv) {
              // TODO : better find
              var innerDiv = infoboxDiv.children[1].children[0];
              if (innerDiv) {
                // Compilation by hand !
                // console.log('innerDiv', innerDiv, $scope, $scope.$parent, $scope.$parent.$parent);
                $scope.$parent.close = $scope.close;
                $compile(innerDiv)($scope.$parent);
                if (!$scope.$$phase) {
                  $scope.$apply();
                }
                innerDiv.className = innerDiv.className.replace('hidden', '');

                // window.mapController = mapController;


                // Recentre la map au besoin
                setTimeout(function() {
                  if (innerDiv.getBoundingClientRect) {
                    /** /
                    var rect = innerDiv.getBoundingClientRect();
                    var bodySize = {
                      width: document.body.clientWidth,
                      height: document.body.clientHeight
                    };
                    var offsetX = (bodySize.width - rect.width) / 2 - rect.left;
                    var offsetY = (bodySize.height - rect.height) / 2 - rect.top;

                    console.log(offsetX, offsetY);
                    mapController.panToOffset(offsetX, -offsetY);
                    // mapController.panToOffset(offsetX, -offsetY/2);

                    console.log('rect', rect);
                    if (rect.top < 0) {
                      mapController.panToOffset(0, rect.top - 10);
                    }
                    /**/
                  }
                }, 100);
              }
            });
            /** /
              setInterval(function() {
                console.log('INFO TEST', $scope.infobox.div_);
              }, 100);
              /**/
          });
        });

        function _checkInfobox(cb) {
          if ($scope.infobox.div_) {
            return cb($scope.infobox.div_);
          }
          setTimeout(function() {
            _checkInfobox(cb);
          }, 200);
        }

        $scope.open = function() {
          if ($scope.infobox) {
            $scope.infobox.setVisible(true);
          }
        };

        $scope.close = function() {
          if ($scope.infobox) {
            var index = $scope.infoboxes.indexOf($scope);
            if(index !== -1) {
              $scope.infoboxes.splice(index, 1);
            }
            $scope.infobox.setVisible(false);
            if ($scope.onClose) {
              $scope.onClose();
            }
          }
        };
      }
    };
  }

  return mapInfoboxDirective;
});

define('map-search.directive',[],function() {
  'use strict';

  /* @ngInject */
  mapSearchDirective.$inject = ['$timeout'];
  function mapSearchDirective($timeout) {
    SearchController.$inject = ['$scope'];
    return {
      require: '^zeeMap',
      scope: {
        searchOptions: '=zeeMapSearchOptions',
        onStateChange: '=zeeMapSearchOnStateChange',
        onPlaceChange: '=zeeMapSearchOnPlaceChange',
        onGeometryChange: '=zeeMapSearchOnGeometryChange'
      },
      link: function($scope, $element, $attrs, mapController) {
        var inputElement = $element[0];
        if (inputElement.tagName.toLowerCase() !== 'input') {
          inputElement = $element.find('input')[0];
        }
        if (!inputElement) {
          console.error('zeeMapSearch', 'No input element found');
        }

        $scope.autocomplete = null;
        $scope.place = null;
        $scope.geometry = null;
        $scope.autocompleteFromText = _autocompleteFromText;

        var autocompleteService = null;
        var placeService = null;

        mapController.whenMapReady.then(function(map) {

          if(inputElement.value) {
            $timeout(function() {
              _autocompleteFromText(inputElement.value);
            }, 100);
          }


          $scope.autocomplete = new google.maps.places.Autocomplete(inputElement, $scope.searchOptions || {
            types: ['geocode'],
            componentRestrictions: {
              country: 'FR'
            }
          });

          if (inputElement.dispatchEvent && inputElement.getAttribute('autofocus') !== null) {
            var event = document.createEvent('CustomEvent');
            event.initCustomEvent('keydown', false, false, null);
            setTimeout(function() {
              inputElement.dispatchEvent(event);
            }, 500);
          }

          google.maps.event.addListener($scope.autocomplete, 'place_changed', function() {
            $scope.place = $scope.autocomplete.getPlace();

            if ($scope.place.formatted_address) {
              inputElement.value = $scope.place.formatted_address;
              if (inputElement.dispatchEvent) {
                var event = document.createEvent('CustomEvent');
                event.initCustomEvent('change', false, false, null);
                // e = new Event('change');
                inputElement.dispatchEvent(event);
              }
            }
            if (!$scope.$$phase) {
              $scope.$apply();
            }
          });
        });

        $scope.$watch('place', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            if ($scope.onPlaceChange) {
              $scope.onPlaceChange(newValue);
            }

            _onPlaceChange(newValue);
          }
        });

        $scope.$watch('geometry', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            if ($scope.onGeometryChange) {
              $scope.onGeometryChange(newValue);
            }
          }
        });


        function _onPlaceChange(place) {
          if (place && place.geometry) {
            $scope.geometry = place.geometry;
          }

          if (place && !place.geometry && place.name) {
            _autocompleteFromText(place.name);
          }
        }

        function _autocompleteFromText(text) {

          text = text || inputElement.value;

          if (!text) {
            return;
          }

          _updateState('pending');

          mapController.whenMapReady.then(function(map) {
            if (!autocompleteService) {
              autocompleteService = new google.maps.places.AutocompleteService();
            }

            autocompleteService.getPlacePredictions({
              input: text
            }, function(predictions) {
              var placeId;

              if (predictions && predictions.length) {
                for (var i = 0; i < predictions.length; i++) {
                  if (!placeId && predictions[0].place_id) {
                    placeId = predictions[0].place_id;
                  }
                }
              }

              if (placeId) {
                if (!placeService) {
                  placeService = new google.maps.places.PlacesService(map);
                }

                placeService.getDetails({
                  placeId: placeId
                }, function(place) {
                  if (place && place.geometry) {
                    $scope.place = place;

                    if (!$scope.$$phase) {
                      $scope.$apply();
                    }

                    _updateState('success');
                  } else {
                    _updateState('fail');
                  }
                });
              } else {
                _updateState('fail');
              }
            });
          });
        }

        function _updateState(state) {
          if ($scope.onStateChange) {
            $scope.onStateChange(state);
            if (!$scope.$$phase) {
              $scope.$apply();
            }
          }
        }

      },
      controller: SearchController
    };

    /* @ngInject */
    function SearchController($scope) {
      var self = this;

      $scope.$watch('autocompleteFromText', function(newValue, oldValue) {
        self.autocompleteFromText = newValue;
      });
    }
  }

  return mapSearchDirective;
});

define('map-search-button.directive',[],function() {
  'use strict';

  /* @ngInject */
  function mapSearchButtonDirective() {
    return {
      require: '^zeeMapSearch',
      link: function($scope, $element, $attrs, mapSearchController) {
        $element.on('click', function() {
          mapSearchController.autocompleteFromText();
        });
      }
    };
  }

  return mapSearchButtonDirective;
});

define('map.module',[
  './map-loader.provider',
  './map.directive',
  './map-cluster.directive',
  './map-marker.directive',
  './map-infobox.directive',
  './map-search.directive',
  './map-search-button.directive'
], function(
  mapLoaderProvider,
  mapDirective,
  mapClusterDirective,
  mapMarkerDirective,
  mapInfoboxDirective,
  mapSearchDirective,
  mapSearchButtonDirective
) {
  'use strict';

  return angular
    .module('zee.map', [])
    .provider('zeeMapLoader', mapLoaderProvider)
    .directive('zeeMap', mapDirective)
    .directive('zeeMapCluster', mapClusterDirective)
    .directive('zeeMapMarker', mapMarkerDirective)
    .directive('zeeMapInfobox', mapInfoboxDirective)
    .directive('zeeMapSearch', mapSearchDirective)
    .directive('zeeMapSearchButton', mapSearchButtonDirective);
});

requirejs.config({
  shim: {

  },
  paths: {
    angular: "../../bower_components/angular/angular",
    requirejs: "../../bower_components/requirejs/require"
  },
  packages: [

  ]
});

define("require.conf", function(){});

})(jQuery);