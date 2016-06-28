define([
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
