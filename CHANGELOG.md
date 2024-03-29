## 1.3.9 (April 08, 2022)

* Update Sailor version to 2.6.27
* Get rid of vulnerabilities in dependencies
* Add component pusher job to Circle.ci config

## 1.3.8 (November 10, 2020)

Change logo to grayscale.

## 1.3.7 (October 30, 2020)

Upgrade to sailor 2.6.18

## 1.3.6 (October 8, 2020)

Component got deprecated. Use https://github.com/elasticio/salesforce-component-v2 instead

## 1.3.5 (August 21, 2020)

* Update `Bulk Create/Update/Delete` action:
   - now it supports `Bulk Upsert` feature
   - fix bug `404 - File's metadata is not found`

## 1.3.4 (May 8, 2020)

* Hotfix: removed `Max Fetch Count` field from Query trigger, as it does not work

## 1.3.3 (May 8, 2020)

* Fix bug with 1,000 objects limit in actions:
  - Query
  - Lookup Object
  - Lookup Objects

  and trigger:
  - Get New and Updated Objects Polling.

New configuration field `Max Fetch Count` added to configure the limit. Please see the README.md for the details

## 1.3.2 (March 26, 2020)

* Add new optional field `Include linked objects` in trigger: `Get New and Updated Objects Polling`

## 1.3.1 (March 11, 2020)

* Add new optional field `Output method` in triggers: `Query` and `Get New and Updated Objects Polling`

## 1.3.0 (February 27, 2020)

* Add Delete Object (at most 1) Action
* Add new optional field in the Lookup Object Action

## 1.2.3 (February 4, 2020)

* Fix query action

## 1.2.2 (January 25, 2020)

* Add request caching for lookup actions

## 1.2.1 (December 27, 2019)

* Update sailor version to 2.5.4
* Refactor console.log to built in sailor logger
* Change build type to `docker`

## 1.2.0 (December 2, 2019)

* Add support for `Bulk operations` feature (Create/Update/Delete and Query)
* Add `Delete Object` action
* Add `Lookup Objects` action
* `Create object` action: add ability to utilize binary data attachment from previous step
* `Upsert object` action: add ability to utilize binary data attachment from previous step
* `Lookup Object (at most 1)` action: add ability to pass binary data (if found object has it) to the next component as a binary attachment
* `Query` action: add ability to query deleted objects

## 1.1.2 (October 28, 2019)

* Change Oauth values naming

## 1.1.1 (July 10, 2019)

* Add support for `Create Attachment` feature
* Fix bug with Salesforce's and platform's types mismatch
* Make unit tests great again (internal issue)

## 1.0.0 (June 27, 2019)

* Initial release which includes a bunch of previous unversioned releases
