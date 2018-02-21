var test = require('tape');
var RedisIndex = require('../');
var lua = require('../lib/lua');
var debug = require('debug')('redis-index');

var docs = [
	{ id : 23, description : { color : 'purple', weight : 20 } }
	, { id : 49, description : { color : 'blue', weight : 12 } }
	, { id : 2, description : { color : 'brown', weight : 100 } }
	, { id : 52, description : { color : 'yellow', weight : 30 } }
];

var index;

test('create an index', function (t) {
	index = RedisIndex.createIndex({
		key : 'redis-index-test'
		, index : 'id'
		, storeObject : true
		, schema : {
			'description.color' : { type : 'string' }
			, 'description.weight' : { type : 'number' }
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

test('test description.weight greater than 20', function (t) {
	t.plan(2);

	index.search({ "description.weight" : index.gte(20) }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[0], docs[3], docs[2]], 'correct documents returned')
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
