'use strict';

module.exports = function(grunt) {

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Load grunt tasks automatically
  // require('load-grunt-tasks')(grunt);
  require('jit-grunt')(grunt);

  var config = {
    pkg: grunt.file.readJSON('package.json'),
    env: process.env
  };

  grunt.util._.extend(config, _loadConfig('tasks/'));

  grunt.initConfig(config);

  grunt.registerTask('default', [
    'start',
    'watch'
  ]);

  grunt.registerTask('start', [
    'build:css',
    'build:js'
  ]);

  grunt.registerTask('build:css', [
    'sass:dev',
    'autoprefixer',
    'notify:css'
  ]);

  grunt.registerTask('build:js', [
    'bowerRequirejs',
    'requirejs:map',
    'ngAnnotate',
    'uglify',
    'notify:js'
  ]);
};

function _loadConfig(cwd, path) {
  var glob = require('glob');
  var object = {};
  var key;
  path = path || '*.grunt.js';

  glob.sync(path, {
    cwd: cwd
  }).forEach(function(option) {
    key = option.replace(/\.grunt\.js$/, '');
    key = key.split('/').pop();
    object[key] = require('./' + cwd + option);
  });

  return object;
}

