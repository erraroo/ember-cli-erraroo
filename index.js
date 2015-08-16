/* jshint node: true */
'use strict';

module.exports = {
  name: 'ember-cli-erraroo',

  included: function(app) {
    this._super.included.apply(this, arguments);
    app.import('vendor/tracekit.js');
    app.import('vendor/timing.js');
  }
};

