module.exports = {
  map: {
    options: {
      baseUrl: '<%= pkg.assetsPath %>/js',
      mainConfigFile: '<%= pkg.assetsPath %>/js/require.conf.js',
      optimize: 'none',

      name: 'map.module',
      include: [
        'require.conf'
      ],

      findNestedDependencies: false,

      paths: {

      },

      out: '<%= pkg.distPath %>/js/map.module.js',

      wrap: {
        start: '(function($){',
        end: '})(jQuery);'
      },
      optimizeCss: 'none'
    }
  }
};
