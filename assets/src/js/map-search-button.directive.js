define(function() {
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
