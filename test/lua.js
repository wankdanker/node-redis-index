var test = require('tape');
var RedisIndex = require('../');
var lua = require('../lib/lua');

test('test zrangestore lua script', function (t) {
	var commands = [];
	var client = RedisIndex.createClient();

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
	var client = RedisIndex.createClient();

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
