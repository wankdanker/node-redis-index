var test = require('tape');
var RedisIndex = require('../');
var lua = require('../lib/lua');
var debug = require('debug')('redis-index');

var docs = [
	{ item_id : 1, name : 'steve', description : 'hello there thing', type : 1, when : new Date(), value : 100 }
	, { item_id : 2, name : 'sam', description : 'this thing is named sam', type : 1, when : new Date(), value : 50 }
	, { item_id : 3, name : 'george', description : 'and here is one george', type : 2, when : new Date(), value : 75 }
	, { item_id : 4, name : 'brenda mcgill', description : 'i am a hungry thing', type : 2, when : new Date(), value : 30 }
];

var index;

test('create an index', function (t) {
	index = RedisIndex.createIndex({
		key : 'redis-index-test'
		, index : 'item_id'
		, storeObject : true
		, schema : {
			name : {
				literal : true
			}
		}
	});

	t.ok(index, 'an index was crated');
	t.end();
});

test('add documents to the index', function (t) {
	var pending = 0;

	docs.forEach(function (doc) {
		pending += 1;

		index.add(doc, function (err, result) {
			t.notOk(err, 'no errors returned when adding document');

			pending -= 1;

			if (pending === 0) {
				return t.end();
			}
		});
	});
});

test('return all documents', function (t) {
	t.plan(2);

	index.search().exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[0], docs[1], docs[2], docs[3]], 'correct documents returned');
		t.end();
	});
});

test('return all documents sorted by val', function (t) {
	t.plan(2);

	index.search().sort('value').exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[3], docs[1], docs[2], docs[0]], 'correct documents returned');
		t.end();
	});
});

test('return all documents sorted by val desc', function (t) {
	t.plan(2);

	index.search().sort('value', 'desc').exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[0], docs[2], docs[1], docs[3]], 'correct documents returned');
		t.end();
	});
});

test('test item_id greater than equal to 2', function (t) {
	t.plan(2);

	index.search({ item_id : index.gte(2) }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[1], docs[2], docs[3]], 'correct documents returned')
		t.end();
	});
});

test('test item_id greater than 2', function (t) {
	t.plan(2);

	index.search({ item_id : index.gt(2) }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[2], docs[3]], 'correct documents returned')
		t.end();
	});
});

test('test item_id less than equal to 2', function (t) {
	t.plan(2);

	index.search({ item_id : index.lte(2) }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[0], docs[1]], 'correct documents returned')
		t.end();
	});
});

test('test item_id less than 2', function (t) {
	t.plan(2);

	index.search({ item_id : index.lt(2) }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[0]], 'correct documents returned')
		t.end();
	});
});

test('test item_id between 2 and 3', function (t) {
	t.plan(2);

	index.search({ item_id : index.between(2, 3) }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[1], docs[2]], 'correct documents returned')
		t.end();
	});
});

test('test item_id in [2, 3]', function (t) {
	t.plan(2);

	index.search({ item_id : index.in([2, 3]) }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[1], docs[2]], 'correct documents returned')
		t.end();
	});
});

test('search on string field', function (t) {
	t.plan(2);

	index.search({ description : 'thing' }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[0], docs[1], docs[3]], 'correct documents returned')
		t.end();
	});
});

test('search on string field and a different field', function (t) {
	t.plan(2);

	index.search({ description : 'thing', item_id : 1 }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[0]], 'correct documents returned')
		t.end();
	});
});

test('multiple search', function (t) {
	t.plan(2);

	index.search({ description : 'thing', type : 2 }).or({ item_id : 3 }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[2], docs[3]], 'correct documents returned');
		t.end();
	});
});

test('remove a document', function (t) {
	t.plan(1);

	index.del(docs[2], function (err, result) {
		t.notOk(err, 'no errors returned when removing a document');
		t.end();
	});
});

test('execute multiple search test with removed document', function (t) {
	t.plan(2);

	index.search({ description : 'thing', type : 2 }).or({ item_id : 3 }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[3]], 'correct documents returned');
		t.end();
	});
});

test('remove documents from the index', function (t) {
	var pending = 0;

	docs.forEach(function (doc) {
		pending += 1;

		index.del(doc, function (err, result) {
			t.notOk(err, 'no errors returned when removing document');

			pending -= 1;

			if (pending === 0) {
				return t.end();
			}
		});
	});
});
