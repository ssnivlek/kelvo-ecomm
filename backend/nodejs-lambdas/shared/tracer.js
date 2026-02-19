// dd-trace is auto-initialized via NODE_OPTIONS='--require=dd-trace/init'
// Configuration comes from DD_* environment variables (DD_SERVICE, DD_ENV, DD_VERSION, etc.)
// Re-export the tracer instance for custom span creation in handlers
module.exports = require('dd-trace');
