class LookupCache {
  constructor() {
    this.requestCache = new WeakMap();
  }

  getMap() {
    return this.requestCache;
  }

  addRequestResponsePair(request, response) {
    this.requestCache.set(request, response);
  }

  hasKey(request) {
    return this.requestCache.has(request);
  }

  getResponse(request) {
    return this.requestCache.get(request);
  }

  // eslint-disable-next-line class-methods-use-this
  generateKeyFromDataArray(...params) {
    return params.reduce((a, b) => a + b);
  }
}

const lookupCache = new LookupCache();
exports.lookupCache = lookupCache;
