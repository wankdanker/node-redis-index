var redis = require('redis');
var redisKey = require('redis-key');
var debug = require('debug')('redis-index');

module.exports = RedisIndex;

module.exports.createClient = function () {
	return redis.createClient();
}

module.exports.createIndex = function (key, index, schema) {
	return new RedisIndex ({ key : key, index : index, schema : schema });
};

function RedisIndex (opts) {
	var self = this;

	self.opts = opts;
	self.schema = opts.schema || {};
	self.redisKey = redisKey.defaults(':', self.opts.key);
	self.client = null
}

RedisIndex.prototype.add = function (obj, cb) {
	var self = this;
	var k = self.redisKey;
	var indexKey = self.opts.index;
	var client = module.exports.createClient();
	var commands = [];
	var keys = [];
	var strReg = /\ /gi
	var index = obj[indexKey];

	Object.keys(obj).forEach(function (key) {
		var val = obj[key];
		var schema = self.schema[key];
		var rk;

		if (typeof val === 'string') {
			val.split(strReg).forEach(function (tok) {
				rk = k('z', key, tok);
				keys.push(rk);

				commands.push(['zadd', rk, 'incr', 1, index]);
			});
		}
		else if (schema && schema.sorted) {
			rk = k('z', key);
			keys.push(rk);

			commands.push(['zadd', rk, val, index]);
		}
		else {
			rk = k('z', key, val);
			keys.push(rk);

			commands.push(['sadd', rk, 0, index]);
		}
	});

	var ok = k('k', '___obj___', index);
	keys.push(ok);

	commands.push(['set', ok, JSON.stringify(obj)]);

	var kk = k('s', '___keys___', index);
	keys.push(kk);

	commands.push(['sadd', kk].concat(keys));

	//try to get the keys for this object to remove them
	client.smembers(kk, function (err, keys) {
		if (err) {
			return end(err);
		}

		if (keys.length) {
			var zsetTest = k('z');

			keys.forEach(function (key) {
				if (key.indexOf(zsetTest) === 0) {
					commands.unshift(['zrem', key, index]);
				}
				else {
					commands.unshift(['srem', key, index]);
				}
			});
		}

		debug(commands);

		client.multi(commands).exec(function (err, result) {
			end(err, result);
		});
	});

	function end(err, result) {
		if (cb) {
			cb(err, result);
		}

		client.end();
	}
};

RedisIndex.prototype.search = function (obj, type) {
	var self = this;

	var search = new RedisIndexSearch(self);

	search.find(obj, type);

	return search;
};

function RedisIndexSearch (index) {
	var self = this;

	self.index = index;

	self.searches = [];
}

RedisIndexSearch.prototype.find = function (obj, type) {
	self = this;

	self.searches.push({
		type : type || 'and'
		, obj : obj
	});

	return self;
};

RedisIndexSearch.prototype.and = function (obj) {
	self = this;

	return self.find(obj, 'and');
};

RedisIndexSearch.prototype.or = function (obj) {
	self = this;

	return self.find(obj, 'or');
};

RedisIndexSearch.prototype.exec = function (cb) {
	var self = this;
	var k = self.index.redisKey;
	var commands = [];
	var client = module.exports.createClient();
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

		var matches = result[offset];
		var lookups = [];

		matches.forEach(function (match) {
			lookups.push(k('k', '___obj___', match));
		});

		if (!lookups.length) {
			return end(err, []);
		}

		client.mget(lookups, function (err, result) {
			if (err) {
				return end(err);
			}

			result.forEach(function (json, i) {
				result[i] = JSON.parse(json);
			});

			return end(err, result);
		});
	});
	
	function end(err, result) {
		if (cb) {
			cb(err, result);
		}

		client.end();
	}

};

