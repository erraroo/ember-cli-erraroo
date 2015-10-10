export function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

export function normalizeError(error) {
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
}

export function normalizeFrame(frame) {
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

export function normalizedPlugins() {
  const normal = [];
  const plugins = (window.navigator.plugins || []);
  for(let i = 0; i < plugins.length; i++) {
    normal.push(normalizedPlugin(plugins[i]));
  }

  return normal;
}

export function normalizedPlugin(plugin) {
  return {name: plugin.name, description: plugin.description};
}

export function isEnabled(config, env) {
  return config.enabled ? true : env.environment === 'production';
}

