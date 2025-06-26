const EventEmitter = require('events');

class AbortController extends EventEmitter {
  abort() {
    this.emit('abort');
  }
}

module.exports = new AbortController();