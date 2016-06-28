define([
  'require'
], function(require) {
  'use strict';

  /* @ngInject */
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
