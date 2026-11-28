const dns = require('node:dns');
const orig = dns.lookup;
const MAP = { 'lomu.deploy-ui.lokeshrc.me': process.env.LOMU_TEST_HUB_IP || '192.168.1.17' };
dns.lookup = function (host, opts, cb) {
  if (typeof opts === 'function') { cb = opts; opts = {}; }
  if (MAP[host]) return typeof opts === 'object' && opts.all ? cb(null, [{ address: MAP[host], family: 4 }]) : cb(null, MAP[host], 4);
  return orig.call(dns, host, opts, cb);
};
