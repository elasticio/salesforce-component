const cacheExpirationTime = process.env.HASH_LIMIT_TIME
  ? process.env.HASH_LIMIT_TIME : 600 * 1000;

class Node {
  constructor(key, value, nextNode) {
    this.key = key;
    this.value = value;
    this.nextNode = nextNode;
  }
}

class LinkedLimitedMap {
  constructor(sizeLimit = 10) {
    this.sizeLimit = sizeLimit;
    this.zeroNode = new Node();
    this.size = 0;
  }

  has(key) {
    let currentNode = this.zeroNode;
    while (currentNode.nextNode) {
      currentNode = currentNode.nextNode;
      if (currentNode.key === key) {
        return true;
      }
    }

    return false;
  }

  get(key) {
    let currentNode = this.zeroNode;
    let prevNode;
    while (currentNode.nextNode) {
      prevNode = currentNode;
      currentNode = currentNode.nextNode;
      if (currentNode.key === key) {
        prevNode.nextNode = currentNode.nextNode;
        currentNode.nextNode = this.zeroNode.nextNode;
        this.zeroNode.nextNode = currentNode;
        return currentNode.value;
      }
    }

    return undefined;
  }

  set(key, value) {
    let currentNode = this.zeroNode;
    while (currentNode.nextNode) {
      currentNode = currentNode.nextNode;
      if (currentNode.key === key) {
        currentNode.value = value;
        return;
      }
    }

    this.zeroNode.nextNode = new Node(key, value, this.zeroNode.nextNode);
    setTimeout(() => this.delete(key), cacheExpirationTime);

    this.size += 1;
    if (this.size > this.sizeLimit) {
      this.replaceLastNode();
    }
  }

  delete(key) {
    let currentNode = this.zeroNode;
    let prevNode;
    while (currentNode.nextNode) {
      prevNode = currentNode;
      currentNode = currentNode.nextNode;
      if (currentNode.key === key) {
        prevNode.nextNode = currentNode.nextNode;
        this.size -= 1;
        return true;
      }
    }

    return false;
  }

  clear() {
    this.zeroNode.nextNode = undefined;
    this.size = 0;
  }

  replaceLastNode() {
    let currentNode = this.zeroNode;
    while (currentNode.nextNode) {
      currentNode = currentNode.nextNode;
      if (currentNode.nextNode && !currentNode.nextNode.nextNode) {
        currentNode.nextNode = undefined;
        this.size -= 1;
        return;
      }
    }
  }
}

class LookupCache {
  constructor() {
    const hashSize = process.env.HASH_LIMIT_ELEMENTS ? process.env.HASH_LIMIT_ELEMENTS : 10;
    this.requestCache = new LinkedLimitedMap(hashSize);
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

  clear() {
    this.requestCache.clear();
  }
}

const lookupCache = new LookupCache();
exports.lookupCache = lookupCache;
