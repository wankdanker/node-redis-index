redis-index
-----------

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

TODO
----

- [x] proper tests
- [x] comparisons
- [x] deep lookups
- [ ] arrays of values
- [ ] arrays of objects
- [ ] automatic full deep indexing

license
-------

MIT
