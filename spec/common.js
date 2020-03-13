require('elasticio-rest-node');

process.env.OAUTH_CLIENT_ID = 'asd';
process.env.OAUTH_CLIENT_SECRET = 'sdc';

const EXT_FILE_STORAGE = 'http://file.storage.server/file';

require.cache[require.resolve('elasticio-rest-node')] = {
  exports: () => ({
    resources: {
      storage: {
        createSignedUrl: () => ({
          get_url: EXT_FILE_STORAGE,
          put_url: EXT_FILE_STORAGE,
        }),
      },
    },
  }),
};

module.exports = {
  configuration: {
    prodEnv: 'login',
    oauth: {
      access_token: 'the unthinkable top secret access token',
      refresh_token: 'the not less important also unthinkable top secret refresh token',
      signature: 'one of that posh signatures that is far from your cross',
      scope: 'refresh_token full',
      id_token: 'yqwdovsdfuf34fmvsdargbnr43a23egc14em8hdfy4tpe8ovq8rvshexdtartdthis',
      instance_url: 'https://test.salesforce.com',
      id: 'https://login.salesforce.com/id/000ZqVZEA0/0052o000ekAAA',
      token_type: 'Bearer',
      issued_at: '1566325368430',
    },
  },
  refresh_token: {
    url: 'https://login.salesforce.com/services/oauth2/token',
    response: {
      access_token: 'the unthinkable top secret access token',
      refresh_token: 'the not less important also unthinkable top secret refresh token',
    },
  },
  emit(what, message) {
    if (typeof what === 'string' && what.toLowerCase().includes('error')) {
      throw message;
    }

    if (typeof (this.emitCallback) === 'function') {
      this.emitCallback(what, message);
    }
  },
  logger: {
    fatal: () => { },
    error: () => { },
    warn: () => { },
    info: () => { },
    debug: () => { },
    trace: () => { },
  },
  emitCallback: null,
  buildSOQL: (objectMeta, where) => {
    let soql = `SELECT%20${objectMeta.fields[0].name}`;

    for (let i = 1; i < objectMeta.fields.length; i += 1) soql += `%2C%20${objectMeta.fields[i].name}`;

    soql += `%20FROM%20${objectMeta.name}%20WHERE%20`;

    if (typeof (where) === 'string') {
      soql += where;
    } else {
      // eslint-disable-next-line guard-for-in,no-restricted-syntax
      for (const key in where) {
        soql += `${key}%20%3D%20`;
        const field = objectMeta.fields.find(f => f.name === key);
        if (!field) {
          throw new Error(`There is not ${key} field in ${objectMeta.name} object`);
        }
        if (field.soapType === 'tns:ID' || field.soapType === 'xsd:string') {
          soql += `%27${where[key]}%27`;
        } else {
          soql += `${where[key]}`;
        }
      }
    }

    return soql;
  },
  EXT_FILE_STORAGE,
};
