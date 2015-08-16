import ENV from '../config/environment';
import erraroo from 'ember-cli-erraroo/erraroo';

erraroo.beforeInitialize(ENV['ErrarooENV']);
export function initialize(application) {
  erraroo.initialize(application);
}

export default {
  name: 'erraroo-config',
  initialize: initialize
};
