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

## Provision env variables

In the component repository you need to specify OAuth Client credentials as environment variables. You would need two variables

![image](https://cloud.githubusercontent.com/assets/56208/10132996/4de54eac-65da-11e5-92aa-a8b102d633e5.png)

You would need two variables:
 * ```SALESFORCE_KEY``` - your OAuth client key
 * ```SALESFORCE_SECRET``` - your OAUth client secret
