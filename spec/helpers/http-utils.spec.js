const nock = require('nock');
const chai = require('chai');

const { expect } = chai;
const action = require('../../lib/helpers/http-utils');

describe('http-utils Unit Test', () => {
  it('Should pass', async () => {
    const params = {
      url: 'https://testurl.com/testing',
      method: 'get',
      headers: {},
      statusExpected: 200,
    };
    const body = '{"testMessage": "Pass test message"}';
    nock('https://testurl.com')
      .get('/testing')
      .reply(200, body);

    action.getJSON(params, (error, result) => {
      expect(result.testMessage).to.equal('Pass test message');
    });
  });

  it('Should throw error', () => {
    const params = {
      url: 'https://testurl.com/testing',
      method: 'get',
      headers: {},
      statusExpected: 200,
    };
    const body = '{"testMessage": "Error test message"}';
    nock('https://testurl.com')
      .get('/testing')
      .reply(404, body);

    action.getJSON(params, (error) => {
      expect(error.responseBody).to.equal(body);
      expect(error.statusCode).to.equal(404);
    });
  });
});
