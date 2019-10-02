/* eslint-disable no-return-assign */
const fs = require('fs');
const sinon = require('sinon');
const { messages } = require('elasticio-node');
const chai = require('chai');
const lookup = require('../../lib/actions/lookup');
const common = require('../../lib/common.js');

const { expect } = chai;

describe('IsItWorking', () => {
  let message;
  let lastCall;
  let configuration;

  beforeEach(async () => {
    console.log('u IsItWorking beforeEach');
  });

  before(async () => {
    console.log('u IsItWorking before');
    if (fs.existsSync('.env')) {
      // eslint-disable-next-line global-require
      require('dotenv').config();
    }
  });

  after(async () => {
    console.log('u IsItWorking after');
  });

  it('it', async () => {
    console.log('u IsItWorking it');
  });

  it('it2', async () => {
    console.log('u IsItWorking it2');
  });

});
