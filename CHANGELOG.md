## 1.2.0 (November 6, 2019)

* Add support for `Bulk operations` feature (Create/Update/Delete and Query)
* Add `Delete Object` action
* Add `Lookup Objects (Plural)` action
* `Create object` action: add ability to utilize binary data attachment from previous step
* `Upsert object` action: add ability to utilize binary data attachment from previous step
* `Lookup Object (at most 1)` action: add ability to pass binary data (if found object has it) to the next component as a binary attachment
* `Query` action: add ability to query deleted objects

## 1.1.1 (July 10, 2019)

* Add support for `Create Attachment` feature
* Fix bug with Salesforce's and platform's types mismatch
* Make unit tests great again (internal issue)

## 1.0.0 (June 27, 2019)

* Initial release which includes a bunch of previous unversioned releases
