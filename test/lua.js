var test = require('tape');
var RedisIndex = require('../');
var lua = require('../lib/lua');

test('test zrangestore lua script', function (t) {
	var commands = [];
	var client = RedisIndex.obtainClient();

	commands.push(['zadd', 'source', 10, 'd'])
	commands.push(['zadd', 'source', 1, 'a'])
	commands.push(['zadd', 'source', 4, 'c'])
	commands.push(['zadd', 'source', 8, 'b'])
	commands.push(['eval', lua.zrangestore, 2, 'dest', 'source', 2, 3]);
	commands.push(['zrange', 'dest', 0, -1]);
	commands.push(['del', 'source', 'dest']);

	client.multi(commands).exec(function (err, result) {
		t.notOk(err, 'no errors returned when running commands');

		var data = result[result.length - 2];

		t.deepEqual(data, ['b', 'd'], 'expected values returned');

		t.end();
		client.quit();
	});
});

test('test zrangebyscorestore lua script', function (t) {
	var commands = [];
	var client = RedisIndex.obtainClient();

	commands.push(['zadd', 'source', 10, 'd'])
	commands.push(['zadd', 'source', 1, 'a'])
	commands.push(['zadd', 'source', 4, 'c'])
	commands.push(['zadd', 'source', 8, 'b'])
	commands.push(['eval', lua.zrangebyscorestore, 2, 'dest', 'source', 1, 5]);
	commands.push(['zrange', 'dest', 0, -1]);
	commands.push(['del', 'source', 'dest']);

	client.multi(commands).exec(function (err, result) {
		t.notOk(err, 'no errors returned when running commands');

		var data = result[result.length - 2];

		t.deepEqual(data, ['a', 'c'], 'expected values returned');

		t.end();
		client.quit();
	});
});

test('test zrangebylexstore lua script', function (t) {
	var commands = [];
	var client = RedisIndex.obtainClient();

	commands.push(['zadd', 'source', 0, 'd'])
	commands.push(['zadd', 'source', 0, 'a'])
	commands.push(['zadd', 'source', 0, 'c'])
	commands.push(['zadd', 'source', 0, 'b'])
	commands.push(['eval', lua.zrangebylexstore, 2, 'dest', 'source', '-', '(c']);
	commands.push(['zrange', 'dest', 0, -1]);
	commands.push(['del', 'source', 'dest']);

	client.multi(commands).exec(function (err, result) {
		t.notOk(err, 'no errors returned when running commands');

		var data = result[result.length - 2];

		t.deepEqual(data, ['a', 'b'], 'expected values returned');

		t.end();
		client.quit();
	});
});

test('test zrangestoreswap lua script', function (t) {
	var commands = [];
	var client = RedisIndex.obtainClient();

	commands.push(['zadd', 'source', 10001, 1])
	commands.push(['zadd', 'source', 10002, 2])
	commands.push(['zadd', 'source', 10003, 3])
	commands.push(['zadd', 'source', 10004, 4])
	commands.push(['zadd', 'source', 10004, 5])
	commands.push(['eval', lua.zrangestoreswap, 2, 'dest', 'source', 0, -1]);
	commands.push(['zrange', 'dest', 0, -1, 'withscores']);
	commands.push(['del', 'source', 'dest']);

	client.multi(commands).exec(function (err, result) {
		t.notOk(err, 'no errors returned when running commands');

		var data = result[result.length - 2];

		t.deepEqual(data, [ '10001', '1', '10002', '1', '10003', '1', '10004', '2' ], 'expected values returned');

		t.end();
		client.quit();
	});
});

test('test zdiffstore lua script', function (t) {
	var commands = [];
	var client = RedisIndex.obtainClient();

	commands.push(['zadd', 'list1', 10001, 1])
	commands.push(['zadd', 'list1', 10002, 2])
	commands.push(['zadd', 'list1', 10003, 3])
	commands.push(['zadd', 'list1', 10004, 4])
	commands.push(['zadd', 'list1', 10005, 5])
	commands.push(['zadd', 'list2', 10003, 3])
	commands.push(['zadd', 'list2', 10004, 4])
	commands.push(['zadd', 'list2', 10005, 5])

	commands.push(['eval', lua.zdiffstore, 3, 'result', 'list1', 'list2']);
	commands.push(['zrange', 'result', 0, -1, 'withscores']);
	commands.push(['del', 'list1', 'list2', 'result']);

	client.multi(commands).exec(function (err, result) {
		t.notOk(err, 'no errors returned when running commands');

		var count = result[result.length - 3];

		t.equal(count, 2, 'script returned correct number of diff items')

		var data = result[result.length - 2];

		t.deepEqual(data, [ '1', '10001', '2', '10002' ], 'expected values returned');

		t.end();
		client.quit();
	});
});

test('test zduplicatescorestore lua script', function (t) {
	var commands = [];
	var client = RedisIndex.obtainClient();

	commands.push(['zadd', 'list1', 10001, 1])
	commands.push(['zadd', 'list1', 10001, 2])
	commands.push(['zadd', 'list1', 10004, 3])
	commands.push(['zadd', 'list1', 10004, 4])
	commands.push(['zadd', 'list1', 10005, 5])
	commands.push(['zadd', 'list1', 10005, 6])
	commands.push(['zadd', 'list1', 10009, 7])
	commands.push(['zadd', 'list1', 10009, 8])
	commands.push(['zadd', 'list1', 10009, 9])
	commands.push(['zadd', 'list1', 10009, 10])

	commands.push(['eval', lua.zduplicatescorestore, 2, 'result', 'list1', 0, -1]);
	commands.push(['zrange', 'result', 0, -1, 'withscores']);
	commands.push(['del', 'list1', 'list2', 'result']);

	client.multi(commands).exec(function (err, result) {
		t.notOk(err, 'no errors returned when running commands');

		var count = result[result.length - 3];

		t.equal(count, 6, 'script returned correct number of duplicate items')

		var data = result[result.length - 2];

		t.deepEqual(data, [ '2', '10001', '4', '10004', '6', '10005', '7', '10009', '8', '10009', '9', '10009' ], 'expected values returned');

		t.end();
		client.quit();
	});
});
