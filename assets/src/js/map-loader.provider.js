define(function() {
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
