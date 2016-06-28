define(function() {
  'use strict';

  /* @ngInject */
  function mapMarkerDirective() {
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
