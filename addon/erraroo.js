/* global TraceKit, timing */
import Ember from 'ember';
import config from 'ember-cli-erraroo/erraroo/config';
import {
  guid,
  normalizedPlugins,
  normalizeError,
  isEnabled
} from 'ember-cli-erraroo/erraroo/helpers';

const logger = Ember.Logger;
const { get, $ } = Ember;

let logs = [];
const MAX_LOG_SIZE = 100;

function lookup(instance, name) {
  // 2.1.0 Introduces a new lookup api.
  let lookup = instance.lookup;
  if (!lookup) {
    lookup = instance.container.lookup;
  }

  return lookup.call(instance, name);
}

const Erraroo = Ember.Object.extend({
  log: function(payload, level) {
    if (logs.length > MAX_LOG_SIZE) {
      logs.shift();
    }

    logs.push({
      timestamp: (new Date()).getTime(),
      payload: payload,
      level: level || 'info',
    });

    if (config.debug) {
      logger.debug(payload);
    }
  },

  makeRequest: function(kind, data) {
    return $.ajax({
      url: config.endpoint,
      data: this.makePayload(kind, data),
      dataType: 'json',
      method: 'POST',
      headers: {
        'X-Token': config.token,
      }
    });
  },

  makePayload: function(kind, data) {
    return JSON.stringify({
      client: {
        name: 'ember-cli-erraroo',
        version: config.version,
      },
      data: data,
      kind: kind,
      session: config.sessionId,
    });
  },

  beforeInitialize: function(env) {
    const cfg = env['ember-cli-erraroo'];
    if (Ember.isNone(cfg)) {
      config.enabled = false;
      return;
    }

    if (Ember.isNone(cfg.token)) {
      logger.warn("Please set your project token on ENV['ember-cli-erraroo'] = { token:'xxx' } in config/environment.js");
      return;
    }

    Ember.merge(config, cfg);
    config.enabled = isEnabled(config, env);
    config.sessionId = guid();

    TraceKit.remoteFetching = false;
    TraceKit.collectWindowErrors = config.enabled;
  },

  // There is probably something we can do with
  // the transition argument.
  applicationRouteError(error/*, transition*/) {
    // TODO: What useful information can we gather
    // about this error and the application state?
    const { message, status } = error;
    const { log } = this;

    // Looks like an ajax error
    if (typeof status === 'number' && status >= 400) {
      const newError = {
        name: `Error ${status}`,
        message: error.responseText,
      };

      this.reportError(newError);
    }

    // Should be an ember data errorr
    if (message === "Adapter operation failed") {
      let message = null;
      let name = null;

      error.errors.forEach(function(err) {
        log(err, 'error-object');

        if (message === null) {
          message = err.detail;
        }

        if (name === null) {
          name = err.title;
        }
      });

      const newError = {
        name,
        message
      };

      this.reportError(newError);
    }
  },

  initialize: function(instance) {
    if (config.enabled) {
      this.install(instance);

      const router = lookup(instance, 'router:main');
      router.on('willTransition', (transition) => this.willTransition(transition));
      router.on('didTransition', () => this.didTransition());

      if (config.installRouteHandler) {
        this.installRouteHandler(instance);
      }

      if (config.collectTimingData) {
        this.collectTimingData();
      }
    }
  },

  // It seems in order to get the /error.hbs on a load
  // you need to incldue an
  // actions: {
  //   error() {
  //     return true;
  //   }
  // }
  //
  installRouteHandler(instance) {
    const addon = this;

    Ember.run.next(function() {
      const route = lookup(instance, 'route:application');

      const actions = get(route, 'actions');
      const error = get(actions, 'error');
      let last = null;

      actions.error = function(err, transition) {
        // when entering an app this can be called twice
        if (err === last) {
          return;
        }

        last = err;

        let ret = true;

        if (typeof error === 'function') {
          // ensure that we capture their error state,
          // they can retrun false and the app should not
          // transition to any error state.
          //
          // however we should probably document this as
          // since it isn't wildly known
          ret = error(err, transition);
        }

        addon.applicationRouteError(...arguments);
        return ret;
      };

      route.actions = actions;
    });
  },

  install: function(instance) {
    logger.debug('installing erraroo');

    const that = this;
    that.instance = instance;
    that.router = lookup(instance, 'router:main');

    TraceKit.report.subscribe(function reportError(errorReport) {
      that.reportError(errorReport);
    });

    const oldEmberOnerror = Ember.onerror || function() {};
    Ember.onerror = function(error) {
      try {
        TraceKit.report(error);
      } catch(ex) {
        if (ex !== error) {
          throw ex;
        }
      }

      logger.error(...arguments);
      return oldEmberOnerror(...arguments);
    };

    Ember.RSVP.on('error', function(error) {
      try {
        TraceKit.report(error);
      } catch(ex) {
        if (ex !== error) {
          throw ex;
        }
      }

      logger.error(...arguments);
    });
  },

  reportError: function(error) {
    if (typeof error.message === 'undefined') {
      return;
    }

    this.log({message: error.message, event: 'error'}, 'error');
    normalizeError(error);

    var request = {
      language: window.navigator.language,
      libaries: this.libaries(),
      plugins: normalizedPlugins(),
      useragent: window.navigator.userAgent,
      userdata: this.get('userdata'),
      url: window.location.href,
      trace: error,
      logs: logs,
    };

    this.makeRequest('js.error', request);
  },

  libaries: function() {
    return Ember.libraries._registry || [];
  },

  collectTimingData: function() {
    const that = this;
    setTimeout(function() {
      that.makeRequest('js.timing', timing.getTimes());
    }, 5000);
  },

  willTransition: function(transition) {
    let current = this.router.get('currentRouteName');
    if (Ember.isNone(current)) {
      current = "root";
    }

    this.log({currentRouteName: current, targetName: transition.targetName, event: 'willTransition'});
  },

  didTransition: function() {
    let current = this.router.get('currentRouteName');
    if (Ember.isNone(current)) {
      current = "root";
    }

    this.log({currentRouteName: current, event: 'didTransition'});
  }
});

const erraroo = Erraroo.create();
export default erraroo;
