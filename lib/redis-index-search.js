var redis = require('redis');
var redisKey = require('redis-key');
var debug = require('debug')('redis-index:search');
var RedisIndex = require('./redis-index');

module.exports = RedisIndexSearch;

function RedisIndexSearchComparison (type, a, b) {
	var self = this;

	self.type = type;
	self.a = a;
	self.b = b;
}

RedisIndexSearch.between = function (a, b) {
	return new RedisIndexSearchComparison('between', a, b);
};

RedisIndexSearch.gt = function (a) {
	return new RedisIndexSearchComparison('gt', a);
};

RedisIndexSearch.gte = function (a) {
	return new RedisIndexSearchComparison('gte', a);
};

RedisIndexSearch.lt = function (a) {
	return new RedisIndexSearchComparison('lt', a);
};

RedisIndexSearch.lte = function (a) {
	return new RedisIndexSearchComparison('lte', a);
};

RedisIndexSearch.contains = function (a) {
	return new RedisIndexSearchComparison('contains', a);
};

function RedisIndexSearch (index) {
	var self = this;

	self.index = index;

	self.searches = [];
}

RedisIndexSearch.prototype.find = function (obj, type) {
	var self = this;

	self.searches.push({
		type : type || 'and'
		, obj : obj
	});

	return self;
};

RedisIndexSearch.prototype.and = function (obj) {
	var self = this;

	return self.find(obj, 'and');
};

RedisIndexSearch.prototype.or = function (obj) {
	var self = this;

	return self.find(obj, 'or');
};

RedisIndexSearch.prototype.exec = function (cb) {
	var self = this;
	var k = self.index.redisKey;
	var commands = [];
	var client = RedisIndex.createClient();
	var intermediaries = [];
	var offset = 0;

	var sk = k('z', 'search-result');

	self.searches.forEach(function (search, i) {
		var keys = [];
		var type = search.type;
		var obj = search.obj;
		var ssk = k('z', 'search-intermediary', i);

		Object.keys(obj).forEach(function (key) {
			var val = obj[key];

			keys.push(k('z', key, val));
		});

		intermediaries.push(ssk);
		commands.push(['zinterstore', ssk, keys.length].concat(keys));
		offset += 1;

		if (intermediaries.length > 1) {
			if (type === 'and') {
				commands.push(['zinterstore', ssk, 2, ssk, intermediaries[intermediaries.length -2]]);
				offset += 1;
			}
			else if (type === 'or') {
				commands.push(['zunionstore', ssk, 2, ssk, intermediaries[intermediaries.length -2]]);
				offset += 1;
			}
		}

	});

	//get the members
	commands.push(['zrange', intermediaries[intermediaries.length - 1], 0, -1]);

	//cleanup
	commands.push(['del'].concat(intermediaries));

	debug(commands);

	client.multi(commands).exec(function (err, result) {
		if (err) {
			return end(err);
		}

		debug('exec initial callback');

		var matches = result[offset];

		//if objects are not stored then just return the matches
		if (!self.index.storeObject) {
			return end(null, matches);
		}

		var lookups = [];

		matches.forEach(function (match) {
			lookups.push(k('k', '___obj___', match));
		});

		if (!lookups.length) {
			return end(err, []);
		}

		debug('exec getting json objects');

		client.mget(lookups, function (err, result) {
			if (err) {
				return end(err);
			}

			debug('exec received %s json objects', result.length);

			result.forEach(function (json, i) {
				result[i] = JSON.parse(json);
			});

			debug('finished parsing %s json objects', result.length);

			return end(err, result);
		});
	});

	function end(err, result) {
		if (cb) {
			cb(err, result);
		}

		client.quit();
	}

};
