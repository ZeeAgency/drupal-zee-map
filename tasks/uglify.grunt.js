module.exports = {
  options: {
    /** /
    beautify: true,
    compress: false,
    /**/
    banner: '/* <%= grunt.template.today("yyyy-mm-dd HH:MM") %> */\r\n'
  },
  dist: {
    files: {
      '<%= pkg.distPath %>/js/map.module.min.js': '<%= pkg.distPath %>/js/map.module.js',
      '<%= pkg.distPath %>/js/angular.min.js': '<%= pkg.distPath %>/../bower_components/angular/angular.js',
      '<%= pkg.distPath %>/js/require.min.js': '<%= pkg.distPath %>/../bower_components/requirejs/require.js'
    }
  }
};
