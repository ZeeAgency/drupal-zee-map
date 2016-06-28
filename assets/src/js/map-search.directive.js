define(function() {
  'use strict';

  /* @ngInject */
  function mapSearchDirective($timeout) {
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
