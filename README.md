# salesforce-component

elastic.io component that connects to Salesforce API (node.js)

# How to use it

## Deploy it

You need a new repository in your elastic.io workspace:

![image](https://cloud.githubusercontent.com/assets/56208/10132952/d863b04c-65d9-11e5-9e37-b342af213ba2.png)

then push the code into it:

```
git push elasticio master
```

## Create new App in Salesforce

In order to make OAuth work you need a new App in your Salesforce. During app creation process you will be asked to specify
the callback URL, to process OAuth auehtncation via elastic.io platform your callback URL should be 

```
https://app.elastic.io/oauth2/callback
```

More information you can find [here](https://help.salesforce.com/apex/HTViewHelpDoc?id=connected_app_create.htm)


## Set OAuth Client key/secret

In the component repository you need to specify OAuth Client credentials as environment variables. You would need two variables

![image](https://cloud.githubusercontent.com/assets/56208/10132996/4de54eac-65da-11e5-92aa-a8b102d633e5.png)

You would need two variables:
 * ```SALESFORCE_KEY``` - your OAuth client key
 * ```SALESFORCE_SECRET``` - your OAUth client secret
