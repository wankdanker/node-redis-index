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

test('async: add documents to the index', async function (t) {
	for (let doc of docs) {
		await index.add(doc);
	}

	t.end();
});

test('async: return all documents', async function (t) {
	t.plan(1);

	let data = await index.search().exec();

	t.deepEqual(data, [docs[0], docs[1], docs[2], docs[3]], 'correct documents returned');
	t.end();
});

test('async: test retrieving pages', async function (t) {
	t.plan(1);

	let data = await index.search().sort('item_id', 'desc').exec({ page : 2, pageSize : 2 });
	
	var expect = [docs[1], docs[0]];

	expect._page = {
		page: 2
		, size: 2
		, total: 4
		, count: 2
		, start: 2
		, stop: 3
		, first: 1
		, last: 2
		, next: null
		, previous: 1
	};

	t.deepEqual(data, expect, 'correct documents returned');
	t.end();
	
});

test('async: test retrieving pages with sort order reversed', async function (t) {
	t.plan(1);

	var expect = [docs[2], docs[3]];

	expect._page = {
		page: 2
		, size: 2
		, total: 4
		, count: 2
		, start: 2
		, stop: 3
		, first: 1
		, last: 2
		, next: null
		, previous: 1
	};

	let data = await index.search().exec({ page : 2, pageSize : 2 });

	t.deepEqual(data, expect, 'correct documents returned');
	t.end();
	
});

test('async: boolean test for true', async function (t) {
	t.plan(1);

	let data = await index.search({ boolz : true }).exec();

	t.deepEqual(data, [docs[2]], 'correct documents returned');
	t.end();
});

test('async: boolean test for false', async function (t) {
	t.plan(1);

	let data = await index.search({ boolz : false }).exec();

	t.deepEqual(data, [docs[0], docs[1], docs[3]], 'correct documents returned');
	t.end();
});

test('async: return all documents sorted by val', async function (t) {
	t.plan(1);

	let data = await index.search().sort('value').exec();

	t.deepEqual(data, [docs[3], docs[1], docs[2], docs[0]], 'correct documents returned');
	t.end();
});

test('async: return all documents sorted by val desc', async function (t) {
	t.plan(1);

	let data = await index.search().sort('value', 'desc').exec();

	t.deepEqual(data, [docs[0], docs[2], docs[1], docs[3]], 'correct documents returned');
	t.end();
});

test('async: test item_id greater than equal to 2', async function (t) {
	t.plan(1);

	let data = await index.search({ item_id : index.gte(2) }).exec();

	t.deepEqual(data, [docs[1], docs[2], docs[3]], 'correct documents returned')
	t.end();
});

test('async: test item_id greater than 2', async function (t) {
	t.plan(1);

	let data = await index.search({ item_id : index.gt(2) }).exec();

	t.deepEqual(data, [docs[2], docs[3]], 'correct documents returned')
	t.end();
});

test('async: test item_id less than equal to 2', async function (t) {
	t.plan(1);

	let data = await index.search({ item_id : index.lte(2) }).exec()

	t.deepEqual(data, [docs[0], docs[1]], 'correct documents returned')
	t.end();
});

test('async: test item_id less than 2', async function (t) {
	t.plan(1);

	let data = await index.search({ item_id : index.lt(2) }).exec();

	t.deepEqual(data, [docs[0]], 'correct documents returned')
	t.end();
});

test('async: test item_id between 2 and 3', async function (t) {
	t.plan(1);

	let data = await index.search({ item_id : index.between(2, 3) }).exec();

	t.deepEqual(data, [docs[1], docs[2]], 'correct documents returned')
	t.end();
});

test('async: test item_id in [2, 3]', async function (t) {
	t.plan(1);

	let data = await index.search({ item_id : index.in([2, 3]) }).exec();

	t.deepEqual(data, [docs[1], docs[2]], 'correct documents returned')
	t.end();
});

test('async: search on string field', async function (t) {
	t.plan(1);

	let data = await index.search({ description : 'thing' }).exec();
	t.deepEqual(data, [docs[0], docs[1], docs[3]], 'correct documents returned')
	t.end();
});

test('async: search on string field and a different field', async function (t) {
	t.plan(1);

	let data = await index.search({ description : 'thing', item_id : 1 }).exec();
	t.deepEqual(data, [docs[0]], 'correct documents returned')
	t.end();

});

test('async: multiple search', async function (t) {
	t.plan(1);

	let data = await index.search({ description : 'thing', type : 2 }).or({ item_id : 3 }).exec();
	t.deepEqual(data, [docs[2], docs[3]], 'correct documents returned');
	t.end();
});

test('async: remove a document', async function (t) {
	t.plan(0);

	let result = await index.del(docs[2]);
	
	t.end();
});

test('async: execute multiple search test with removed document', async function (t) {
	t.plan(1);

	let data = await index.search({ description : 'thing', type : 2 }).or({ item_id : 3 }).exec();
	t.deepEqual(data, [docs[3]], 'correct documents returned');
	t.end();
});

test('async: remove documents from the index', async function (t) {
	
	for (let doc of docs) {
		let result = await index.del(doc);
	}

	return t.end();
});
