module.exports = {
  options: {
    sourcemap: 'none',
    style: 'compressed',
    precision: 10,
    compass: true,
    lineNumbers: false,
    loadPath: '<%= pkg.assetsPath %>/bower_components',
    require: [
      'sass-globbing',
      'sass-css-importer'
    ]
  },
  dev: {
    files: [{
      expand: true,
      cwd: '<%= pkg.assetsPath %>/scss/',
      src: ['*.{scss,sass}'],
      dest: '<%= pkg.distPath %>/css/',
      ext: '.min.css'
    }]
  }
};
