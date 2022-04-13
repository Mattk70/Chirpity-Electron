var mc;
onconnect = function(e) {
  var port = e.ports[0];
  if (mc) {
    port.postMessage({port:mc.port2}, [mc.port2]);
    mc = undefined;
  } else {
    mc = new MessageChannel();
    port.postMessage({port:mc.port1}, [mc.port1]);
  }
};