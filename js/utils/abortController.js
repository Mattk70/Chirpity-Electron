const EventEmitter = require('events');

class AbortController extends EventEmitter {
  abort() {
    this.emit('abort');
  }
}
 const abortController = new AbortController();
export default abortController;