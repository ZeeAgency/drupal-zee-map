define([
  'require'
], function(require) {
  'use strict';

  /* @ngInject */
  function mapClusterDirective() {
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
