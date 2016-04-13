var redis = require('redis');
var redisKey = require('redis-key');
var debug = require('debug')('redis-index');

module.exports = RedisIndex;

//RedisIndexSearch must be required after RedisIndex is exported otherwise
//RedisIndexSearch will not have access to createClient()
var RedisIndexSearch = require('./redis-index-search');

module.exports.createClient = function () {
	return redis.createClient();
}

module.exports.createIndex = function (key, index, schema) {
	var opts;

	if (typeof key === 'object' && key) {
		opts = key;
	}
	else {
		opts = {
			key : key
			, index : index
			, schema : schema
		};
	}

	return new RedisIndex (opts);
};

function RedisIndex (opts) {
	var self = this;

	self.opts = opts;
	self.schema = opts.schema || {};
	self.storeObject = (opts.storeObject === false) ? false : true;
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
		var schema = self.schema[key] || {};
		var rk;

		if (schema.ignore) {
			return;
		}

		// handle strings
		if (schema.type === 'string' || (!schema.type && typeof val === 'string')) {
			if (schema.literal) {
				rk = k('z', key, val);
				keys.push(rk);
				commands.push(['zadd', rk, 0, index]);

				return;
			}

			val.split(strReg).forEach(function (tok) {
				rk = k('z', key, tok);
				keys.push(rk);
				commands.push(['zadd', rk, 'incr', 1, index]);
			});

			return;
		}

		//handle dates
		if (schema.type === 'date' || (!schema.type && val instanceof Date)) {
			val = val.getTime();

			rk = k('z', 'd', key, val);
			keys.push(rk);

			commands.push(['zadd', rk, val, index]);

			return;
		}

		//handle numbers
		if (schema.type === 'numeric' || (!schema.type && !isNaN(val))) {
			rk = k('z', 'n', key, val);
			keys.push(rk);

			commands.push(['zadd', rk, val, index]);

			return;
		}

		// this should be removed, probably
		if (schema.sorted) {
			rk = k('z', key);
			keys.push(rk);

			commands.push(['zadd', rk, val, index]);

			return;
		}

		// handle everything else
		rk = k('z', key, val);
		keys.push(rk);

		commands.push(['zadd', rk, 0, index]);
	});

	//only save a representation of the object in redis
	//if that is what is wanted.
	if (self.storeObject) {
		var ok = k('k', '___obj___', index);
		keys.push(ok);

		commands.push(['set', ok, JSON.stringify(obj)]);
	}

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

		client.quit();
	}
};

RedisIndex.prototype.del = function (obj, cb) {
	var self = this;
	var k = self.redisKey;
	var indexKey = self.opts.index;
	var client = module.exports.createClient();
	var commands = [];
	var index;

	if (typeof obj === 'object') {
		index = obj[indexKey];
	}
	else {
		index = obj;
	}

	var kk = k('s', '___keys___', index);

	//try to get the keys for this object to remove them
	client.smembers(kk, function (err, keys) {
		if (err) {
			return end(err);
		}

		commands.push(['del', kk]);

		if (keys.length) {
			var zsetTest = k('z');
			var keyTest = k('k');

			keys.forEach(function (key) {
				if (key.indexOf(zsetTest) === 0) {
					commands.unshift(['zrem', key, index]);
				}
				else if (key.indexOf(keyTest) === 0) {
					commands.unshift(['del', key]);
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

		client.quit();
	}
};

RedisIndex.prototype.search = function (obj, type) {
	var self = this;

	var search = new RedisIndexSearch(self);

	search.find(obj, type);

	return search;
};