/* global TraceKit, timing */
import Ember from 'ember';
import config from 'ember-cli-erraroo/erraroo/config';

const logger = Ember.Logger;

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function normalizeFrame(frame) {
  // reject this frame if there is no url
  if (!frame.url) {
    return;
  }

  // reject this frame if there is no column
  if (!frame.column) {
    return;
  }

  // reject this frame if there is no column
  if (!frame.line) {
    return;
  }

  return {
    column: frame.column,
    func: frame.func,
    line: frame.line,
    url: frame.url,
  };
}

function normalizedPlugins() {
  const normal = [];
  const plugins = (window.navigator.plugins || []);
  for(let i = 0; i < plugins.length; i++) {
    normal.push(normalizedPlugin(plugins[i]));
  }

  return normal;
}

function normalizedPlugin(plugin) {
  return {name: plugin.name, description: plugin.description};
}

let logs = [];
const MAX_LOG_SIZE = 100;

const Erraroo = Ember.Object.extend({
  log: function(message, level) {
    if (logs.length > MAX_LOG_SIZE) {
      logs.shift();
    }

    logs.push({
      timestamp: (new Date()).getTime(),
      message: message,
      level: level || 'info',
    });

    if (config.debug) {
      logger.debug(message);
    }
  },

  makeRequest: function(kind, data) {
    return Ember.$.ajax({
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
    if (Ember.isNone(env)) {
      config.enabled = false;
      return;
    }

    if (Ember.isNone(env.token)) {
      logger.warn("Please set your project token on ErrarooENV.token = 'xxx' in config/environment.js");
      return;
    }

    Ember.merge(config, env);
    config.enabled = true;
    config.sessionId = guid();

    TraceKit.remoteFetching = false;
    TraceKit.collectWindowErrors = true;
  },

  initialize: function(instance) {
    const { container } = instance;

    if (config.enabled) {
      this.install(instance);
      const router = container.lookup('router:main');
      router.on('willTransition', (t) => this.willTransition(t));

      if (config.collectTimingData) {
        this.collectTimingData();
      }
    }
  },

  install: function(instance) {
    logger.debug('installing');

    const { container } = instance;

    const that = this;
    that.instance = instance;
    that.container = container;
    that.router = container.lookup('router:main');

    TraceKit.report.subscribe(function reportError(errorReport) {
      that.reportError(errorReport);
    });

    var oldEmberOnerror = Ember.onerror || Ember.K;
    Ember.onerror = function(error) {
      try {
        TraceKit.report(error);
      } catch(ex) {
        if (ex !== error) {
          throw ex;
        }
      }

      logger.error('Ember.onerror', error);
      return oldEmberOnerror(error);
    };

    Ember.RSVP.on('error', function(error) {
      try {
        TraceKit.report(error);
      } catch(ex) {
        if (ex !== error) {
          throw ex;
        }
      }

      logger.error('Ember.RSVP.onerror', error);
    });
  },

  reportError: function(error) {
    this.log(error.message, 'error');

    if (error.stack) {
      var frames = [];
      for(var j = 0; j < error.stack.length; j++) {
        var frame = normalizeFrame(error.stack[j]);
        if (frame) {
          frames.push(frame);
        }
      }

      error.stack = frames;
    }

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
    const target = transition.targetName;
    let current = this.router.get('currentRouteName');
    if (Ember.isNone(current)) {
      current = "root";
    }

    this.log('Transition ' + current + ' => ' + transition.targetName, 'transition');
  },

  reportApplicationRouteError: function(error, transition) {
    const err = {
      name: "Error while processing route: "+ transition.targetName,
    };

    if (error.errors) {
      error = error.errors[0];
      err.message =  `${error.title} ${error.status} ${error.detail}`;
    } else {
      err.message = `Error ${error.status} ${error.responseText}`;
    }

    this.reportError(err);
  }
});

const erraroo = Erraroo.create();
export default erraroo;
