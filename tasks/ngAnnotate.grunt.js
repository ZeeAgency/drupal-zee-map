module.exports = {
  options: {
    singleQuotes: true
  },
  main: {
    src: '<%= pkg.distPath %>/js/map.module.js',
    dest: '<%= pkg.distPath %>/js/map.module.js'
  }
};
