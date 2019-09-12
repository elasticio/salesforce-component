'use strict';

process.env.SALESFORCE_KEY = "asd";
process.env.SALESFORCE_SECRET = "sdc";

module.exports = {
  configuration: {
    prodEnv: "login",
    oauth: {
      access_token: "the unthinkable top secret access token",
      refresh_token: "the not less important also unthinkable top secret refresh token",
      signature: "one of that posh signatures that is far from your cross",
      scope: "refresh_token full",
      id_token: "yqwdovsdfuf34fmvsdargbnr43a23egc14em8hdfy4tpe8ovq8rvshexdtartdthis",
      instance_url: "https://test.salesforce.com",
      id: "https://login.salesforce.com/id/000ZqVZEA0/0052o000ekAAA",
      token_type: "Bearer",
      issued_at: "1566325368430"
    }
  },
  refresh_token: {
    url: "https://login.salesforce.com/services/oauth2/token",
    response: {
      access_token: "the unthinkable top secret access token",
      refresh_token: "the not less important also unthinkable top secret refresh token"
    }
  },
  emit: function(par1, par2) {}
};
