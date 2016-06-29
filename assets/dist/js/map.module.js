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

// https://github.com/googlemaps/js-marker-clusterer
(function(){var d=null;function e(a){return function(b){this[a]=b}}function h(a){return function(){return this[a]}}var j;
function k(a,b,c){this.extend(k,google.maps.OverlayView);this.c=a;this.a=[];this.f=[];this.ca=[53,56,66,78,90];this.j=[];this.A=!1;c=c||{};this.g=c.gridSize||60;this.l=c.minimumClusterSize||2;this.J=c.maxZoom||d;this.j=c.styles||[];this.X=c.imagePath||this.Q;this.W=c.imageExtension||this.P;this.O=!0;if(c.zoomOnClick!=void 0)this.O=c.zoomOnClick;this.r=!1;if(c.averageCenter!=void 0)this.r=c.averageCenter;l(this);this.setMap(a);this.K=this.c.getZoom();var f=this;google.maps.event.addListener(this.c,
"zoom_changed",function(){var a=f.c.getZoom();if(f.K!=a)f.K=a,f.m()});google.maps.event.addListener(this.c,"idle",function(){f.i()});b&&b.length&&this.C(b,!1)}j=k.prototype;j.Q="http://google-maps-utility-library-v3.googlecode.com/svn/trunk/markerclusterer/images/m";j.P="png";j.extend=function(a,b){return function(a){for(var b in a.prototype)this.prototype[b]=a.prototype[b];return this}.apply(a,[b])};j.onAdd=function(){if(!this.A)this.A=!0,n(this)};j.draw=function(){};
function l(a){if(!a.j.length)for(var b=0,c;c=a.ca[b];b++)a.j.push({url:a.X+(b+1)+"."+a.W,height:c,width:c})}j.S=function(){for(var a=this.o(),b=new google.maps.LatLngBounds,c=0,f;f=a[c];c++)b.extend(f.getPosition());this.c.fitBounds(b)};j.z=h("j");j.o=h("a");j.V=function(){return this.a.length};j.ba=e("J");j.I=h("J");j.G=function(a,b){for(var c=0,f=a.length,g=f;g!==0;)g=parseInt(g/10,10),c++;c=Math.min(c,b);return{text:f,index:c}};j.$=e("G");j.H=h("G");
j.C=function(a,b){for(var c=0,f;f=a[c];c++)q(this,f);b||this.i()};function q(a,b){b.s=!1;b.draggable&&google.maps.event.addListener(b,"dragend",function(){b.s=!1;a.L()});a.a.push(b)}j.q=function(a,b){q(this,a);b||this.i()};function r(a,b){var c=-1;if(a.a.indexOf)c=a.a.indexOf(b);else for(var f=0,g;g=a.a[f];f++)if(g==b){c=f;break}if(c==-1)return!1;b.setMap(d);a.a.splice(c,1);return!0}j.Y=function(a,b){var c=r(this,a);return!b&&c?(this.m(),this.i(),!0):!1};
j.Z=function(a,b){for(var c=!1,f=0,g;g=a[f];f++)g=r(this,g),c=c||g;if(!b&&c)return this.m(),this.i(),!0};j.U=function(){return this.f.length};j.getMap=h("c");j.setMap=e("c");j.w=h("g");j.aa=e("g");
j.v=function(a){var b=this.getProjection(),c=new google.maps.LatLng(a.getNorthEast().lat(),a.getNorthEast().lng()),f=new google.maps.LatLng(a.getSouthWest().lat(),a.getSouthWest().lng()),c=b.fromLatLngToDivPixel(c);c.x+=this.g;c.y-=this.g;f=b.fromLatLngToDivPixel(f);f.x-=this.g;f.y+=this.g;c=b.fromDivPixelToLatLng(c);b=b.fromDivPixelToLatLng(f);a.extend(c);a.extend(b);return a};j.R=function(){this.m(!0);this.a=[]};
j.m=function(a){for(var b=0,c;c=this.f[b];b++)c.remove();for(b=0;c=this.a[b];b++)c.s=!1,a&&c.setMap(d);this.f=[]};j.L=function(){var a=this.f.slice();this.f.length=0;this.m();this.i();window.setTimeout(function(){for(var b=0,c;c=a[b];b++)c.remove()},0)};j.i=function(){n(this)};
function n(a){if(a.A)for(var b=a.v(new google.maps.LatLngBounds(a.c.getBounds().getSouthWest(),a.c.getBounds().getNorthEast())),c=0,f;f=a.a[c];c++)if(!f.s&&b.contains(f.getPosition())){for(var g=a,u=4E4,o=d,v=0,m=void 0;m=g.f[v];v++){var i=m.getCenter();if(i){var p=f.getPosition();if(!i||!p)i=0;else var w=(p.lat()-i.lat())*Math.PI/180,x=(p.lng()-i.lng())*Math.PI/180,i=Math.sin(w/2)*Math.sin(w/2)+Math.cos(i.lat()*Math.PI/180)*Math.cos(p.lat()*Math.PI/180)*Math.sin(x/2)*Math.sin(x/2),i=6371*2*Math.atan2(Math.sqrt(i),
Math.sqrt(1-i));i<u&&(u=i,o=m)}}o&&o.F.contains(f.getPosition())?o.q(f):(m=new s(g),m.q(f),g.f.push(m))}}function s(a){this.k=a;this.c=a.getMap();this.g=a.w();this.l=a.l;this.r=a.r;this.d=d;this.a=[];this.F=d;this.n=new t(this,a.z(),a.w())}j=s.prototype;
j.q=function(a){var b;a:if(this.a.indexOf)b=this.a.indexOf(a)!=-1;else{b=0;for(var c;c=this.a[b];b++)if(c==a){b=!0;break a}b=!1}if(b)return!1;if(this.d){if(this.r)c=this.a.length+1,b=(this.d.lat()*(c-1)+a.getPosition().lat())/c,c=(this.d.lng()*(c-1)+a.getPosition().lng())/c,this.d=new google.maps.LatLng(b,c),y(this)}else this.d=a.getPosition(),y(this);a.s=!0;this.a.push(a);b=this.a.length;b<this.l&&a.getMap()!=this.c&&a.setMap(this.c);if(b==this.l)for(c=0;c<b;c++)this.a[c].setMap(d);b>=this.l&&a.setMap(d);
a=this.c.getZoom();if((b=this.k.I())&&a>b)for(a=0;b=this.a[a];a++)b.setMap(this.c);else if(this.a.length<this.l)z(this.n);else{b=this.k.H()(this.a,this.k.z().length);this.n.setCenter(this.d);a=this.n;a.B=b;a.ga=b.text;a.ea=b.index;if(a.b)a.b.innerHTML=b.text;b=Math.max(0,a.B.index-1);b=Math.min(a.j.length-1,b);b=a.j[b];a.da=b.url;a.h=b.height;a.p=b.width;a.M=b.textColor;a.e=b.anchor;a.N=b.textSize;a.D=b.backgroundPosition;this.n.show()}return!0};
j.getBounds=function(){for(var a=new google.maps.LatLngBounds(this.d,this.d),b=this.o(),c=0,f;f=b[c];c++)a.extend(f.getPosition());return a};j.remove=function(){this.n.remove();this.a.length=0;delete this.a};j.T=function(){return this.a.length};j.o=h("a");j.getCenter=h("d");function y(a){a.F=a.k.v(new google.maps.LatLngBounds(a.d,a.d))}j.getMap=h("c");
function t(a,b,c){a.k.extend(t,google.maps.OverlayView);this.j=b;this.fa=c||0;this.u=a;this.d=d;this.c=a.getMap();this.B=this.b=d;this.t=!1;this.setMap(this.c)}j=t.prototype;
j.onAdd=function(){this.b=document.createElement("DIV");if(this.t)this.b.style.cssText=A(this,B(this,this.d)),this.b.innerHTML=this.B.text;this.getPanes().overlayMouseTarget.appendChild(this.b);var a=this;google.maps.event.addDomListener(this.b,"click",function(){var b=a.u.k;google.maps.event.trigger(b,"clusterclick",a.u);b.O&&a.c.fitBounds(a.u.getBounds())})};function B(a,b){var c=a.getProjection().fromLatLngToDivPixel(b);c.x-=parseInt(a.p/2,10);c.y-=parseInt(a.h/2,10);return c}
j.draw=function(){if(this.t){var a=B(this,this.d);this.b.style.top=a.y+"px";this.b.style.left=a.x+"px"}};function z(a){if(a.b)a.b.style.display="none";a.t=!1}j.show=function(){if(this.b)this.b.style.cssText=A(this,B(this,this.d)),this.b.style.display="";this.t=!0};j.remove=function(){this.setMap(d)};j.onRemove=function(){if(this.b&&this.b.parentNode)z(this),this.b.parentNode.removeChild(this.b),this.b=d};j.setCenter=e("d");
function A(a,b){var c=[];c.push("background-image:url("+a.da+");");c.push("background-position:"+(a.D?a.D:"0 0")+";");typeof a.e==="object"?(typeof a.e[0]==="number"&&a.e[0]>0&&a.e[0]<a.h?c.push("height:"+(a.h-a.e[0])+"px; padding-top:"+a.e[0]+"px;"):c.push("height:"+a.h+"px; line-height:"+a.h+"px;"),typeof a.e[1]==="number"&&a.e[1]>0&&a.e[1]<a.p?c.push("width:"+(a.p-a.e[1])+"px; padding-left:"+a.e[1]+"px;"):c.push("width:"+a.p+"px; text-align:center;")):c.push("height:"+a.h+"px; line-height:"+a.h+
"px; width:"+a.p+"px; text-align:center;");c.push("cursor:pointer; top:"+b.y+"px; left:"+b.x+"px; color:"+(a.M?a.M:"black")+"; position:absolute; font-size:"+(a.N?a.N:11)+"px; font-family:Arial,sans-serif; font-weight:bold");return c.join("")}window.MarkerClusterer=k;k.prototype.addMarker=k.prototype.q;k.prototype.addMarkers=k.prototype.C;k.prototype.clearMarkers=k.prototype.R;k.prototype.fitMapToMarkers=k.prototype.S;k.prototype.getCalculator=k.prototype.H;k.prototype.getGridSize=k.prototype.w;
k.prototype.getExtendedBounds=k.prototype.v;k.prototype.getMap=k.prototype.getMap;k.prototype.getMarkers=k.prototype.o;k.prototype.getMaxZoom=k.prototype.I;k.prototype.getStyles=k.prototype.z;k.prototype.getTotalClusters=k.prototype.U;k.prototype.getTotalMarkers=k.prototype.V;k.prototype.redraw=k.prototype.i;k.prototype.removeMarker=k.prototype.Y;k.prototype.removeMarkers=k.prototype.Z;k.prototype.resetViewport=k.prototype.m;k.prototype.repaint=k.prototype.L;k.prototype.setCalculator=k.prototype.$;
k.prototype.setGridSize=k.prototype.aa;k.prototype.setMaxZoom=k.prototype.ba;k.prototype.onAdd=k.prototype.onAdd;k.prototype.draw=k.prototype.draw;s.prototype.getCenter=s.prototype.getCenter;s.prototype.getSize=s.prototype.T;s.prototype.getMarkers=s.prototype.o;t.prototype.onAdd=t.prototype.onAdd;t.prototype.draw=t.prototype.draw;t.prototype.onRemove=t.prototype.onRemove;
})();

define("plugins/marker-clusterer", function(){});

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

// https://github.com/lucasfs7/google-maps-infobox-module
define('plugins/infobox',[],function() {
  function InfoBox(a){a=a||{},google.maps.OverlayView.apply(this,arguments),this.content_=a.content||"",this.disableAutoPan_=a.disableAutoPan||!1,this.maxWidth_=a.maxWidth||0,this.pixelOffset_=a.pixelOffset||new google.maps.Size(0,0),this.position_=a.position||new google.maps.LatLng(0,0),this.zIndex_=a.zIndex||null,this.boxClass_=a.boxClass||"infoBox",this.boxStyle_=a.boxStyle||{},this.closeBoxMargin_=a.closeBoxMargin||"2px",this.closeBoxURL_=a.closeBoxURL||"http://www.google.com/intl/en_us/mapfiles/close.gif",""===a.closeBoxURL&&(this.closeBoxURL_=""),this.infoBoxClearance_=a.infoBoxClearance||new google.maps.Size(1,1),"undefined"==typeof a.visible&&(a.visible="undefined"==typeof a.isHidden?!0:!a.isHidden),this.isHidden_=!a.visible,this.alignBottom_=a.alignBottom||!1,this.pane_=a.pane||"floatPane",this.enableEventPropagation_=a.enableEventPropagation||!1,this.div_=null,this.closeListener_=null,this.moveListener_=null,this.contextListener_=null,this.eventListeners_=null,this.fixedWidthSet_=null}InfoBox.prototype=new google.maps.OverlayView,InfoBox.prototype.createInfoBoxDiv_=function(){var a,b,c,d=this,e=function(a){a.cancelBubble=!0,a.stopPropagation&&a.stopPropagation()},f=function(a){a.returnValue=!1,a.preventDefault&&a.preventDefault(),d.enableEventPropagation_||e(a)};if(!this.div_){if(this.div_=document.createElement("div"),this.setBoxStyle_(),"undefined"==typeof this.content_.nodeType?this.div_.innerHTML=this.getCloseBoxImg_()+this.content_:(this.div_.innerHTML=this.getCloseBoxImg_(),this.div_.appendChild(this.content_)),this.getPanes()[this.pane_].appendChild(this.div_),this.addClickHandler_(),this.div_.style.width?this.fixedWidthSet_=!0:0!==this.maxWidth_&&this.div_.offsetWidth>this.maxWidth_?(this.div_.style.width=this.maxWidth_,this.div_.style.overflow="auto",this.fixedWidthSet_=!0):(c=this.getBoxWidths_(),this.div_.style.width=this.div_.offsetWidth-c.left-c.right+"px",this.fixedWidthSet_=!1),this.panBox_(this.disableAutoPan_),!this.enableEventPropagation_){for(this.eventListeners_=[],b=["mousedown","mouseover","mouseout","mouseup","click","dblclick","touchstart","touchend","touchmove"],a=0;a<b.length;a++)this.eventListeners_.push(google.maps.event.addDomListener(this.div_,b[a],e));this.eventListeners_.push(google.maps.event.addDomListener(this.div_,"mouseover",function(){this.style.cursor="default"}))}this.contextListener_=google.maps.event.addDomListener(this.div_,"contextmenu",f),google.maps.event.trigger(this,"domready")}},InfoBox.prototype.getCloseBoxImg_=function(){var a="";return""!==this.closeBoxURL_&&(a="<img",a+=" src='"+this.closeBoxURL_+"'",a+=" align=right",a+=" style='",a+=" position: relative;",a+=" cursor: pointer;",a+=" margin: "+this.closeBoxMargin_+";",a+="'>"),a},InfoBox.prototype.addClickHandler_=function(){var a;""!==this.closeBoxURL_?(a=this.div_.firstChild,this.closeListener_=google.maps.event.addDomListener(a,"click",this.getCloseClickHandler_())):this.closeListener_=null},InfoBox.prototype.getCloseClickHandler_=function(){var a=this;return function(b){b.cancelBubble=!0,b.stopPropagation&&b.stopPropagation(),google.maps.event.trigger(a,"closeclick"),a.close()}},InfoBox.prototype.panBox_=function(a){var b,c,d=0,e=0;if(!a&&(b=this.getMap(),b instanceof google.maps.Map)){b.getBounds().contains(this.position_)||b.setCenter(this.position_),c=b.getBounds();var f=b.getDiv(),g=f.offsetWidth,h=f.offsetHeight,i=this.pixelOffset_.width,j=this.pixelOffset_.height,k=this.div_.offsetWidth,l=this.div_.offsetHeight,m=this.infoBoxClearance_.width,n=this.infoBoxClearance_.height,o=this.getProjection().fromLatLngToContainerPixel(this.position_);o.x<-i+m?d=o.x+i-m:o.x+k+i+m>g&&(d=o.x+k+i+m-g),this.alignBottom_?o.y<-j+n+l?e=o.y+j-n-l:o.y+j+n>h&&(e=o.y+j+n-h):o.y<-j+n?e=o.y+j-n:o.y+l+j+n>h&&(e=o.y+l+j+n-h),(0!==d||0!==e)&&(b.getCenter(),b.panBy(d,e))}},InfoBox.prototype.setBoxStyle_=function(){var a,b;if(this.div_){this.div_.className=this.boxClass_,this.div_.style.cssText="",b=this.boxStyle_;for(a in b)b.hasOwnProperty(a)&&(this.div_.style[a]=b[a]);this.div_.style.WebkitTransform="translateZ(0)","undefined"!=typeof this.div_.style.opacity&&""!==this.div_.style.opacity&&(this.div_.style.MsFilter='"progid:DXImageTransform.Microsoft.Alpha(Opacity='+100*this.div_.style.opacity+')"',this.div_.style.filter="alpha(opacity="+100*this.div_.style.opacity+")"),this.div_.style.position="absolute",this.div_.style.visibility="hidden",null!==this.zIndex_&&(this.div_.style.zIndex=this.zIndex_)}},InfoBox.prototype.getBoxWidths_=function(){var a,b={top:0,bottom:0,left:0,right:0},c=this.div_;return document.defaultView&&document.defaultView.getComputedStyle?(a=c.ownerDocument.defaultView.getComputedStyle(c,""),a&&(b.top=parseInt(a.borderTopWidth,10)||0,b.bottom=parseInt(a.borderBottomWidth,10)||0,b.left=parseInt(a.borderLeftWidth,10)||0,b.right=parseInt(a.borderRightWidth,10)||0)):document.documentElement.currentStyle&&c.currentStyle&&(b.top=parseInt(c.currentStyle.borderTopWidth,10)||0,b.bottom=parseInt(c.currentStyle.borderBottomWidth,10)||0,b.left=parseInt(c.currentStyle.borderLeftWidth,10)||0,b.right=parseInt(c.currentStyle.borderRightWidth,10)||0),b},InfoBox.prototype.onRemove=function(){this.div_&&(this.div_.parentNode.removeChild(this.div_),this.div_=null)},InfoBox.prototype.draw=function(){this.createInfoBoxDiv_();var a=this.getProjection().fromLatLngToDivPixel(this.position_);this.div_.style.left=a.x+this.pixelOffset_.width+"px",this.alignBottom_?this.div_.style.bottom=-(a.y+this.pixelOffset_.height)+"px":this.div_.style.top=a.y+this.pixelOffset_.height+"px",this.div_.style.visibility=this.isHidden_?"hidden":"visible"},InfoBox.prototype.setOptions=function(a){"undefined"!=typeof a.boxClass&&(this.boxClass_=a.boxClass,this.setBoxStyle_()),"undefined"!=typeof a.boxStyle&&(this.boxStyle_=a.boxStyle,this.setBoxStyle_()),"undefined"!=typeof a.content&&this.setContent(a.content),"undefined"!=typeof a.disableAutoPan&&(this.disableAutoPan_=a.disableAutoPan),"undefined"!=typeof a.maxWidth&&(this.maxWidth_=a.maxWidth),"undefined"!=typeof a.pixelOffset&&(this.pixelOffset_=a.pixelOffset),"undefined"!=typeof a.alignBottom&&(this.alignBottom_=a.alignBottom),"undefined"!=typeof a.position&&this.setPosition(a.position),"undefined"!=typeof a.zIndex&&this.setZIndex(a.zIndex),"undefined"!=typeof a.closeBoxMargin&&(this.closeBoxMargin_=a.closeBoxMargin),"undefined"!=typeof a.closeBoxURL&&(this.closeBoxURL_=a.closeBoxURL),"undefined"!=typeof a.infoBoxClearance&&(this.infoBoxClearance_=a.infoBoxClearance),"undefined"!=typeof a.isHidden&&(this.isHidden_=a.isHidden),"undefined"!=typeof a.visible&&(this.isHidden_=!a.visible),"undefined"!=typeof a.enableEventPropagation&&(this.enableEventPropagation_=a.enableEventPropagation),this.div_&&this.draw()},InfoBox.prototype.setContent=function(a){this.content_=a,this.div_&&(this.closeListener_&&(google.maps.event.removeListener(this.closeListener_),this.closeListener_=null),this.fixedWidthSet_||(this.div_.style.width=""),"undefined"==typeof a.nodeType?this.div_.innerHTML=this.getCloseBoxImg_()+a:(this.div_.innerHTML=this.getCloseBoxImg_(),this.div_.appendChild(a)),this.fixedWidthSet_||(this.div_.style.width=this.div_.offsetWidth+"px","undefined"==typeof a.nodeType?this.div_.innerHTML=this.getCloseBoxImg_()+a:(this.div_.innerHTML=this.getCloseBoxImg_(),this.div_.appendChild(a))),this.addClickHandler_()),google.maps.event.trigger(this,"content_changed")},InfoBox.prototype.setPosition=function(a){this.position_=a,this.div_&&this.draw(),google.maps.event.trigger(this,"position_changed")},InfoBox.prototype.setZIndex=function(a){this.zIndex_=a,this.div_&&(this.div_.style.zIndex=a),google.maps.event.trigger(this,"zindex_changed")},InfoBox.prototype.setVisible=function(a){this.isHidden_=!a,this.div_&&(this.div_.style.visibility=this.isHidden_?"hidden":"visible")},InfoBox.prototype.getContent=function(){return this.content_},InfoBox.prototype.getPosition=function(){return this.position_},InfoBox.prototype.getZIndex=function(){return this.zIndex_},InfoBox.prototype.getVisible=function(){var a;return a="undefined"==typeof this.getMap()||null===this.getMap()?!1:!this.isHidden_},InfoBox.prototype.show=function(){this.isHidden_=!1,this.div_&&(this.div_.style.visibility="visible")},InfoBox.prototype.hide=function(){this.isHidden_=!0,this.div_&&(this.div_.style.visibility="hidden")},InfoBox.prototype.open=function(a,b){var c=this;b&&(this.position_=b.getPosition(),this.moveListener_=google.maps.event.addListener(b,"position_changed",function(){c.setPosition(this.getPosition())})),this.setMap(a),this.div_&&this.panBox_()},InfoBox.prototype.close=function(){var a;if(this.closeListener_&&(google.maps.event.removeListener(this.closeListener_),this.closeListener_=null),this.eventListeners_){for(a=0;a<this.eventListeners_.length;a++)google.maps.event.removeListener(this.eventListeners_[a]);this.eventListeners_=null}this.moveListener_&&(google.maps.event.removeListener(this.moveListener_),this.moveListener_=null),this.contextListener_&&(google.maps.event.removeListener(this.contextListener_),this.contextListener_=null),this.setMap(null)};
  return InfoBox;
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


          require(['./plugins/infobox'], function(InfoBox) {
            // console.log('InfoBox: ', InfoBox);
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
    angular: '../../bower_components/angular/angular',
    requirejs: '../../bower_components/requirejs/require'
  },
  packages: [

  ]
});

define("require.conf", function(){});

})(jQuery);