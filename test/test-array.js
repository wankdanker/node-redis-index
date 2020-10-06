var test = require('tape');
var RedisIndex = require('../');
var lua = require('../lib/lua');
var debug = require('debug')('redis-index');

var docs = [
	{ id : 5, categories : [ { id : 1, default : true }, { id : 6, default : false } ] }
	, { id : 10, categories : [ { id : 1, default : true }, { id : 6, default : false } ] }
	, { id : 15, categories : [ { id : 4, default : true }, { id : 2, default : false } ] }
	, { id : 20, categories : [ { id : 4, default : false }, { id : 2, default : false } ] }
];

var index;

test('create an index', function (t) {
	index = RedisIndex.createIndex({
		key : 'redis-index-test'
		, compress : RedisIndex.compression[process.env.COMPRESS]
		, index : 'id'
		, storeObject : true
		, schema : {
			'categories' : { type : 'object-array' }
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

test('test categories.id is 4 and categories.default true', function (t) {
	t.plan(2);

	index.search({ "categories.id" : 4, 'categories.default' : 'true' }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[2]], 'correct documents returned')
		t.end();
	});
});

test('test categories.id is 4 and categories.default true or categories.id is 6', function (t) {
	t.plan(2);

	index.search({ "categories.id" : 4, 'categories.default' : 'true' }).or({ "categories.id" : 6 }).exec(function (err, data) {
		t.notOk(err, 'no errors returned');

		t.deepEqual(data, [docs[2], docs[1], docs[0]], 'correct documents returned')
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
