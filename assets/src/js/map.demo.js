'use strict';
window.name = 'NG_DEFER_BOOTSTRAP!';

require([
  'map.module'
], function() {

  angular
    .module('zee.map-demo', [
      'zee.map'
    ])

    .config(['zeeMapLoaderProvider', function(zeeMapLoaderProvider) {
      zeeMapLoaderProvider.configure({
        key: 'AIzaSyAQwSWa3jxoWFRRdqwgwSqmnmB9E80itu0',
        libraries: 'places,geometry'
      });
    }])

    .controller('DemoController', function($scope) {
      var self = this;

      self.map = null;
      self.mapOptions = {
        center: {
          lat: 46,
          lng: 2
        },
        zoom: 6,
        mapTypeControl: false,
        streetViewControl: false,
        panControlOptions: {
          position: 9
        },
        zoomControlOptions: {
          position: 9
        }
      };
    });

  window.name = '';
  angular.bootstrap(document.body, ['zee.map-demo']);
});
