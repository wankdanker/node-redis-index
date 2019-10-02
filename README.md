redis-index
-----------

[![Build Status](https://travis-ci.org/wankdanker/node-redis-index.svg?branch=master)](https://travis-ci.org/wankdanker/node-redis-index)

Index and query arbitrary objects with Redis.

example
-------

```js
var index = require('redis-index').createIndex('item', 'item_id');

index.add({ item_id : 1, name : "thing a", type : 100 });
index.add({ item_id : 2, name : "thing b", type : 100 });
index.add({ item_id : 3, name : "thing c", type : 200 });

setTimeout(function () {
	index.search({ name : 'b' }).or({ item_id : 1 }).exec(function (err, result) {
		/*
			[ { item_id : 1, name : "thing a", type : 100 },
			{ item_id : 2, name : "thing b", type : 100 } ]
		*/
	});
}, 1000);
```

api
---

### RedisIndex

* RedisIndex.createIndex(options)

Create a new index to which objects may be added.

* **options** : options objects
	* **key** : *string* - the namespace key to use when storing keys in redis
	* **index** : *string* - the attribute which exists on an object being indexed which should be used to uniquely identify that object.
	* **schemaOnly** : *boolean* - when true, only index fields identified in the schema
	* **fullText** : *function* - when exists, this function will be called with each object being added to the index. The function should return a string to be indexed for full text search. This option must be present in order to enable full text search.
	* **schema** : *object* - an object which identifies information about attributes encountered when indexing.


TODO
----

- [x] proper tests
- [x] comparisons
- [x] deep lookups
- [ ] arrays of values
- [x] arrays of objects
- [x] automatic full deep indexing
- [x] wildcards for schema definitions
- [ ] add comparisons
	- [ ] exists
	- [ ] empty/notExists
	- [ ] contains
	- [ ] begins with
	- [ ] ends with
	- [x] in array (of values)
- [x] full text
- [ ] string comparisons
- [x] sorting
- [x] intersect with other indexes
- [x] store key
- [ ] add array of objects
- [x] custom string tokenizing
- [x] paging
- [x] make Promise compatible

license
-------

MIT
