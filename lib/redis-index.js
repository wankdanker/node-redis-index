module.exports = RedisIndex;

var redis = require('redis');
var redisKey = require('redis-key');
var each = require('dank-each');
var debug = require('debug')('redis-index');
var lua = require('./lua');
var isNumber = require('./is-number');
var isDate = require('./is-date');
var isString = require('./is-string');
var isObject = require('./is-object');
var isBoolean = require('./is-boolean');
var isObjectArray = require('./is-object-array');
var dv = require('deepval');
var comparisons = require('./comparisons');
var RedisIndexSearch = require('./redis-index-search');
var tokenize = require('./tokenize');

comparisons.copy(RedisIndex);

module.exports.createClient = function () {
	return redis.createClient();
}

module.exports.tokenize = tokenize;

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


/**
 * RedisIndex - constructor function for RedisIndex
 *
 * @param  {Object} opts        options object
 * @param  {String} opts.key    the prefix key for storing data in redis
 * @param  {String} opts.index  the attribute of the document whose value
 *                              uniquely identifies that object
 * @param  {Object} opts.schema a schema object
 * @param  {Boolean} opts.schemaOnly only index fields that exist in the schema
 * @param  {Boolean} opts.storeObject store the document in redis or not
 * @return {RedisIndex}         instance of RedisIndex
 */
function RedisIndex (opts) {
	var self = this;

	self.opts = opts;
	self.schema = opts.schema || {};
	self.storeObject = (opts.storeObject === false) ? false : true;
	self.redisKey = redisKey.defaults(':', self.opts.key);
	self.client = null

	comparisons.copy(self);
}

/**
 * RedisIndex.add - add an object to the index and index it
 *
 * @param  {Object} obj object to add to the index
 * @param  {Function} cb  callback function when complete
 * @return {undefined}
 */
RedisIndex.prototype.add = function (obj, cb) {
	var self = this;
	var k = self.redisKey;
	var schemaOnly = self.opts.schemaOnly;
	var indexKey = self.opts.index;
	var client = module.exports.createClient();
	var commands = [];
	var keys = [];
	var strReg = /\ /gi
	var index = obj[indexKey];

	indexObject(self.schema, '', obj);

	//save a reference to all
	var all = k('z', '___all___');
	commands.push(['zadd', all, 0, index]);
	keys.push(all);

	if (self.opts.fullText) {
		var str = self.opts.fullText(obj);
		var tokens = module.exports.tokenize(str);

		tokens.forEach(function (token) {
			var ft = k('z', '___ft___', token);
			keys.push(ft);
			commands.push(['zadd', ft, 'incr', 1, index]);
		});
	}

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

				commands.unshift(['srem', k('s', '___keys___', index), key]);
			});
		}

		debug(commands);

		client.multi(commands).exec(function (err, result) {
			end(err, result);
		});
	});

	function indexObject(rootSchema, rootKey, obj) {
		if (obj == null || obj == undefined) {
			return;
		}

		//the attributes of obj are appended to rootKey to get the indexing key
		Object.keys(obj).forEach(function (key) {
			var val = obj[key];
			var indexKey = (rootKey) ? rootKey + '.' + key : key;
			var schema = rootSchema[key] || rootSchema["*"] || {};
			var rk;

			if (schema.ignore || (!(rootSchema[key] || rootSchema["*"]) && schemaOnly)) {
				return;
			}

			if (val == null || val == undefined) {
				return;
			}

			if (isObjectArray(schema, val)) {
				return val.forEach(function (obj) {
					indexObject(schema, indexKey, obj);
				});
			}

			//handle strings
			if (isString(schema, val)) {
				return indexString(schema, indexKey, val);
			}

			//handle booleans
			if (isBoolean(schema, val)) {
				return indexBoolean(schema, indexKey, val);
			}

			//handle dates
			if (isDate(schema, val)) {
				return indexDate(schema, indexKey, val);
			}

			//handle numbers
			if (isNumber(schema, val)) {
				return indexNumber(schema, indexKey, val);
			}

			if (isObject(schema, val)) {
				return indexObject(schema, indexKey, val);
			}

			// handle everything else
			return indexOther(schema, indexKey, val);
		});
	}

	function indexString (schema, key, val) {
		debug('indexString: %s', key, val, schema);

		module.exports.tokenize(val, schema, schema.literal).forEach(function (tok) {
			rk = k('z', key, tok);
			keys.push(rk);
			commands.push(['zadd', rk, 'incr', 1, index]);
		});
	}

	function indexBoolean (schema, key, val) {
		debug('indexBoolean: %s', key, val, schema);

		rk = k('z', key, val);
		keys.push(rk);
		commands.push(['zadd', rk, 0, index]);
	}

	function indexDate (schema, key, val) {
		debug('indexDate: %s', key, val, schema);

		val = val.getTime();

		//add a key for a direct lookup for this value
		rk = k('z', 'd', key, val);
		keys.push(rk);
		commands.push(['zadd', rk, val, index]);

		//add a key for a range lookup for this value
		rk = k('z', key);
		keys.push(rk);
		commands.push(['zadd', rk, val, index]);
	}

	function indexNumber (schema, key, val) {
		debug('indexNumber: %s', key, val, schema);

		//add a key for a direct lookup for this value
		rk = k('z', 'n', key, val);
		keys.push(rk);
		commands.push(['zadd', rk, val, index]);

		//add a key for a range lookup for this value
		rk = k('z', key);
		keys.push(rk);
		commands.push(['zadd', rk, val, index]);
	}

	function indexOther (schema, key, val) {
		debug('indexOther: %s', key, val, schema);

		rk = k('z', key, val);
		keys.push(rk);

		commands.push(['zadd', rk, 0, index]);
	}

	function end(err, result) {
		if (cb) {
			cb(err, result);
		}

		client.quit();
	}
};

/**
 * RedisIndex.del - remove documents/objects from the index
 *
 * @param  {Object} obj the object to remove from the index (must contain at least
 *                      the index field
 * @param  {Function} cb  callback function when operation is complete
 * @return {undefined}
 */
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

/**
 * RedisIndex.search - execute a search on the index
 *
 * @param  {Object} obj  search object
 * @param  {String} type I forgot what this does, maybe determine if it's and/or
 * @return {RedisIndexSearch}  returns an instance of a RedisIndexSearch object
 */
RedisIndex.prototype.search = function (obj, type) {
	var self = this;

	var search = new RedisIndexSearch(self);

	search.find(obj, type);

	return search;
};

/**
 * RedisIndex.createSearch - execute a search on the index
 *
 * @return {RedisIndexSearch}  returns an instance of a RedisIndexSearch object
 */
RedisIndex.prototype.createSearch = function () {
	var self = this;

	var search = new RedisIndexSearch(self);

	return search;
};

/**
 * RedisIndex.from - create a search starting with a stored key
 *
 * @return {RedisIndexSearch}  returns an instance of a RedisIndexSearch object
 */
RedisIndex.prototype.from = function (key) {
	var self = this;

	var search = new RedisIndexSearch(self);

	return search.from(key);
};
