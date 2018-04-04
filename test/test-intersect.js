var test = require('tape');
var RedisIndex = require('../');
var lua = require('../lib/lua');
var debug = require('debug')('redis-index');

var things = [
	{ item_id : 1, name : 'steve', description : 'hello there thing', type : 1, when : new Date() }
	, { item_id : 2, name : 'sam', description : 'this thing is named sam', type : 1, when : new Date() }
	, { item_id : 3, name : 'george', description : 'and here is one george', type : 2, when : new Date() }
	, { item_id : 4, name : 'brenda mcgill', description : 'i am a hungry thing', type : 2, when : new Date() }
];

var types = [
	{ type : 1, what : "a" }
	, { type : 2, what : "b" }
	, { type : 3, what : "c" }
];

var thingsIndex;
var typesIndex;

test('create a thingsIndex', function (t) {
	thingsIndex = RedisIndex.createIndex({
		key : 'redis-index-test-things'
		, index : 'item_id'
		, storeObject : true
		, schema : {
			name : {
				literal : true
			}
		}
	});

	t.ok(thingsIndex, 'an index was crated');
	t.end();
});

test('create a typesIndex', function (t) {
	typesIndex = RedisIndex.createIndex({
		key : 'redis-index-test-types'
		, index : 'type'
		, storeObject : true
		, schema : {
			name : {
				literal : true
			}
		}
	});

	t.ok(typesIndex, 'an index was crated');
	t.end();
});

test('add documents to the thingsIndex', function (t) {
	var pending = 0;

	things.forEach(function (doc) {
		pending += 1;

		thingsIndex.add(doc, function (err, result) {
			t.notOk(err, 'no errors returned when adding document');

			pending -= 1;

			if (pending === 0) {
				return t.end();
			}
		});
	});
});

test('add documents to the typesIndex', function (t) {
	var pending = 0;

	types.forEach(function (doc) {
		pending += 1;

		typesIndex.add(doc, function (err, result) {
			t.notOk(err, 'no errors returned when adding document');

			pending -= 1;

			if (pending === 0) {
				return t.end();
			}
		});
	});
});

test('test storeKey and from', function (t) {
	// t.plan(2);

	var key = 'test-key';

	thingsIndex.search({ item_id : 1 }).exec({ storeKey : key }, function (err, result) {
		t.notOk(err, 'no errors returned when storing');

		thingsIndex.createSearch().from(key).exec(function (err, data) {
			t.notOk(err, 'no errors returned when retrieving');

			t.deepEqual(data, [things[0]], 'correct documents returned')
			t.end();
		});
	});
});

test('test index.search(...).store(key) then index.from(key)', function (t) {
	t.plan(3);

	var key = 'test-key';

	thingsIndex.search({ item_id : 1 }).store(key, function (err, result) {
		t.notOk(err, 'no errors returned when storing');

		thingsIndex.from(key).exec(function (err, data) {
			t.notOk(err, 'no errors returned when retrieving');

			t.deepEqual(data, [things[0]], 'correct documents returned')
			t.end();
		});
	});
});

test('test index.search().store(key) then index.from(key).and(...)', function (t) {
	t.plan(3);

	var key = 'test-key';

	thingsIndex.search().store(key, function (err, result) {
		t.notOk(err, 'no errors returned when storing');

		thingsIndex.from(key).and({ item_id : 4 }).exec(function (err, data) {
			t.notOk(err, 'no errors returned when retrieving');

			t.deepEqual(data, [things[3]], 'correct documents returned')
			t.end();
		});
	});
});

test('test item_id greater than equal to 2 intersected with typesIndex', function (t) {
	t.plan(2);

	thingsIndex.search({ item_id : 1 }).intersect(typesIndex, 'type', 'type').exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [types[0]], 'correct documents returned')
		t.end();
	});
});

test('remove documents from the thingsIndex', function (t) {
	var pending = 0;

	things.forEach(function (doc) {
		pending += 1;

		thingsIndex.del(doc, function (err, result) {
			t.notOk(err, 'no errors returned when removing document');

			pending -= 1;

			if (pending === 0) {
				return t.end();
			}
		});
	});
});

test('remove documents from the typesIndex', function (t) {
	var pending = 0;

	types.forEach(function (doc) {
		pending += 1;

		typesIndex.del(doc, function (err, result) {
			t.notOk(err, 'no errors returned when removing document');

			pending -= 1;

			if (pending === 0) {
				return t.end();
			}
		});
	});
});
