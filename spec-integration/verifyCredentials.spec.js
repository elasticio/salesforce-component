/* eslint-disable no-return-assign */
const fs = require('fs');
const logger = require('@elastic.io/component-logger')();
const { expect } = require('chai');
const verify = require('../verifyCredentials');

describe('verifyCredentials', async () => {
  let configuration;

  before(async () => {
    if (fs.existsSync('.env')) {
      // eslint-disable-next-line global-require
      require('dotenv').config();
    }

    configuration = {
      oauth: {
        undefined_params: {
          instance_url: process.env.INSTANCE_URL,
        },
        refresh_token: process.env.REFRESH_TOKEN,
        access_token: process.env.ACCESS_TOKEN,
      },
    };
  });

  it('should succeed', async () => {
    const result = await verify.call({ logger }, configuration);
    expect(result.verified).to.eql(true);
  });
});
