// Default configuration
export default {
  /// API end point
  endpoint: 'https://api.erraroo.com/api/v1/events',

  // What environment are we currently in.
  environment: 'production',

  // Authentication Token
  token: null,

  // Prints useful debuging messages
  debug: true,

  // captures window.timing data
  collectTimingData: true,

  // this will be included on with events
  userdata: null,

  // the unique session id
  sessionId: null,
};
