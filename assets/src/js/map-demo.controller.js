define(function() {
  'use strict';

  /* @ngInject */
  function MapDemoController() {
    var self = this;
    self.mapOptions = {
      center: {
        lat: 46,
        lng: 2
      },
      zoom: 6,
      foo: 0,

      mapTypeControl: false,
      overviewMapControl: false,
      panControl: false,
      rotateControl: false,
      scaleControl: false,
      streetViewControl: false,
      zoomControl: false,
      scrollwheel: true
    };

    self.markerOptions1 = {
      position: {
        lat: 48,
        lng: 2
      },
      icon: '/img/marker-green.png'
    };

    self.markerOptions2 = {
      position: {
        lat: 43.2,
        lng: 2.2
      }
    };

    self.clusteredMarkers = [self.markerOptions2];
    for(var i = 0; i < 500; i++) {
      self.clusteredMarkers.push({
        position: {
          lat: 47 + Math.random() * 6 - 3,
          lng: 3 + Math.random() * 6 - 3
        }
      });
    }

    self.markerIsVisible1 = true;
    self.markerIsVisible2 = true;

    self.searchOptions = {
      types: ['geocode'],
      componentRestrictions: {
        country: 'FR'
      }
    };

    self.onMapReady = function(map) {
      console.log('onMapReady', map);
    };

    self.changeCenter = function() {
      self.mapOptions.center.lat += Math.random() * 2 - 1;
      self.mapOptions.center.lng += Math.random() * 2 - 1;
    };

    self.changeZoom = function() {
      self.mapOptions.zoom += 1;
    };

    self.changeOptions = function() {
      self.mapOptions.foo += 1;
      self.mapOptions.center.lat += Math.random() * 2 - 1;
      self.mapOptions.center.lng += Math.random() * 2 - 1;
    };

    self.changeMarker1 = function() {
      self.markerOptions1.position.lat += Math.random() - 0.5;
      self.markerOptions1.position.lng += Math.random() - 0.5;
      console.log('self.markerOptions1: ', self.markerOptions1);
    };

    self.changeMarker2 = function() {
      self.markerOptions2.position.lat += Math.random() - 0.5;
      self.markerOptions2.position.lng += Math.random() - 0.5;
    };

    self.toggleMarker1 = function() {
      self.markerIsVisible1 = !self.markerIsVisible1;
    };

    self.toggleMarker2 = function() {
      self.markerIsVisible2 = !self.markerIsVisible2;
    };

    self.onClickMarker1 = function(marker, e) {
      console.log('>> marker click', marker, e);
      alert('marker 1');
    };

    self.onClickMarker2 = function(marker, e) {
      console.log('>> marker click', marker, e);
      alert('marker 2');
    };

    var sv;
    self.onMapBoundsChange = function(map, e) {
      if(!sv) {
        sv = new google.maps.StreetViewService();
      }
      sv.getPanoramaByLocation(map.getCenter(), 50, function(data, status) {
        console.log('getPanoramaByLocation: ', data, status);
      });
      console.log('>> map bounds change', map, e);
    };

    self.onSearchGeometryChange = function(geometry) {
      console.log('>> geometry change', geometry);
      if (geometry.location) {
        self.mapOptions.center.lat = geometry.location.lat();
        self.mapOptions.center.lng = geometry.location.lng();
      }
    };
  }

  return MapDemoController;
});
