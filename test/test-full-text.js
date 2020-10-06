var test = require('tape');
var RedisIndex = require('../');
var lua = require('../lib/lua');
var debug = require('debug')('redis-index');

var docs = [
	{ item_id : 1, name : 'steve', description : 'hello there thing', type : 1, when : new Date(), value : 100, boolz : false }
	, { item_id : 2, name : 'sam', description : 'this thing is named sam', type : 1, when : new Date(), value : 50, boolz : false }
	, { item_id : 3, name : 'george', description : 'and here is one george', type : 2, when : new Date(), value : 75, boolz : true }
	, { item_id : 4, name : 'brenda mcgill', description : 'i am a hungry thing', type : 2, when : new Date(), value : 30, boolz : false }
];

var index;

test('create an index', function (t) {
	index = RedisIndex.createIndex({
		key : 'redis-index-test'
		, compress : RedisIndex.compression[process.env.COMPRESS]
		, index : 'item_id'
		, storeObject : true
    , fullText : function (obj) {
      return [obj.name, obj.description, obj.value].join(' ');
    }
		, schema : {
			name : {
				literal : true
			}
			, boolz : { type : 'boolean' }
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

test('do a full text search for "thing"', function (t) {
	var pending = 0;

	index.search({ keyword : index.fullText('thing')}).exec(function (err, result) {
    t.deepEqual(result, [docs[0], docs[1], docs[3]]);
    t.end();
  });
});

test('do a full text search for "hungry thing"', function (t) {
	var pending = 0;

	index.search({ keyword : index.fullText('hungry thing')}).exec(function (err, result) {
    t.deepEqual(result, [docs[3]]);
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
