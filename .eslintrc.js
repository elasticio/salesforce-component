module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    mocha: true
  },
  extends: [
    'airbnb-base',
  ],
  rules: {
    'max-len': ["error", { "code": 150 }]
  }
};
