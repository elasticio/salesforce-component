const axios = require('axios');
const client = require('elasticio-rest-node')();

const REQUEST_TIMEOUT = process.env.REQUEST_TIMEOUT || 10000; // 10s
const REQUEST_MAX_CONTENT_LENGTH = process.env.REQUEST_MAX_CONTENT_LENGTH || 10485760; // 10 MB
const REQUEST_MAX_RETRY = process.env.REQUEST_MAX_RETRY || 3;
const REQUEST_RETRY_DELAY = process.env.REQUEST_RETRY_DELAY || 5000; // 5s

function addRetryCountInterceptorToAxios(ax) {
  ax.interceptors.response.use(undefined, (err) => { //  Retry count interceptor for axios
    const { config } = err;
    if (!config || !config.retry || !config.delay) { return Promise.reject(err); }
    config.currentRetryCount = config.currentRetryCount || 0;
    if (config.currentRetryCount >= config.retry) {
      return Promise.reject(err);
    }
    config.currentRetryCount += 1;
    return new Promise((resolve) => setTimeout(() => resolve(ax(config)), config.delay));
  });
}


module.exports.base64Encode = (value) => Buffer.from(value).toString('base64');
module.exports.base64Decode = (value) => Buffer.from(value, 'base64').toString('utf-8');
module.exports.createSignedUrl = async () => client.resources.storage.createSignedUrl();
module.exports.uploadAttachment = async (url, payload) => {
  const ax = axios.create();
  addRetryCountInterceptorToAxios(ax);
  return ax.put(url, payload, {
    method: 'PUT',
    timeout: REQUEST_TIMEOUT,
    retry: REQUEST_MAX_RETRY,
    delay: REQUEST_RETRY_DELAY,
    maxContentLength: REQUEST_MAX_CONTENT_LENGTH,
  });
};
module.exports.downloadAttachment = async (url) => {
  const ax = axios.create();
  addRetryCountInterceptorToAxios(ax);
  const response = await ax.get(url, {
    method: 'GET',
    timeout: REQUEST_TIMEOUT,
    retry: REQUEST_MAX_RETRY,
    delay: REQUEST_RETRY_DELAY,
  });
  return response.data;
};
