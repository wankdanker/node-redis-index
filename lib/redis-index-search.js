module.exports = RedisIndexSearch;

var debug = require('debug')('redis-index:search');
var getValue = require('deepval');
var RedisIndex = require('./redis-index');
var lua = require('./lua');
var isNumber = require('./is-number');
var isDate = require('./is-date');
var isString = require('./is-string');
var isObject = require('./is-object');
var isBoolean = require('./is-boolean');
var isObjectArray = require('./is-object-array');
var comparisons = require('./comparisons');
var Page = require('./page-object');
var promised = require('./promised');

comparisons.copyTo(RedisIndexSearch);

function RedisIndexSearch (index) {
	var self = this;

	self.index = index;

	self.searches = [];
	self.sorts = [];
}

RedisIndexSearch.prototype.find = function (obj, type) {
	var self = this;

	self.searches.push({
		type : type || 'and'
		, obj : obj || {}
	});

	return self;
};

RedisIndexSearch.prototype.sort = function (key, direction) {
	var self = this;

	self.sorts.push({
		key : key
		, direction : direction
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

/**
 * intersect - description
 *
 * @param  {type} obj   the other RedisIndex to intersect
 * @param  {type} left  the key on the left side of the intersection
 * @param  {type} right the key on the right side of the intersection
 * @return {type}
 */
RedisIndexSearch.prototype.intersect = function (index, left, right) {
	var self = this;

	//insure obj is an instance of RedisIndex
	if (!(index instanceof RedisIndex)) {
		throw new Error('The first argument to intersect must be an instance of a RedisIndex');
	}

	//TODO: return index (the other RedisIndex we're joining)
	// but we need to somehow make the exec call to that index process this index's
	// exec function first and then store the results from which we will start
	// our exec
	var obj = {
		index : index
		, left : left
		, right : right
	};

	self.find(obj, 'intersect');

	return index.createSearch().fromOtherSearch(self);
};

RedisIndexSearch.prototype.from = function (key) {
	var self = this;

	return self.find({ storeKey : key }, 'from');
};

RedisIndexSearch.prototype.store = function (key, cb) {
	var self = this;

	//If no callback function provided, then return a Promise
	if (cb === undefined) {
		return promised(self, self.store, key);
	}

	self.exec({ storeKey : key }, function (err, result) {
		return cb(err, cb);
	});

	return self.index.createSearch();
};

RedisIndexSearch.prototype.fromOtherSearch = function (search) {
	var self = this;

	//insure obj is an instance of RedisIndexSearch
	if (!(search instanceof RedisIndexSearch)) {
		throw new Error('The first argument to intersect must be an instance of a RedisIndexSearch');
	}

	var obj = {
		search : search
	};

	return self.find(obj, 'from-index');
}

RedisIndexSearch.prototype.exec = function (opts, cb) {
	var self = this;

	if (typeof opts == 'function' || (!opts && !cb)) {
		cb = opts;
		opts = {};
	}

	//If no callback function provided, then return a Promise
	if (cb === undefined) {
		return promised(self, self.exec, opts);
	}

	var k = self.index.redisKey;
	var commands = [];

	var intermediaries = [];
	var del = [];
	var offset = 0;
	var sortDirection = self.sortDirection || 'asc';

	if (self.searches[0].type === 'from-index') {
		return processFromIndex(self.searches.shift());
	}

	//must create the client here other wise it won't be closed because the
	// above statment returns
	var client = self.index.obtainClient({
		return_buffers : !!self.index.compress
	});

	self.searches.forEach(function (search, i) {
		var keys = [];
		var type = search.type;
		var obj = search.obj;
		var ssk = k('z', 'search-intermediary', intermediaries.length);

		debug('processing search of type: %s', type);

		if (type === 'intersect') {
			return processIntersect(search, intermediaries, keys);
		}
		else if (type === 'from') {
			keys.push(obj.storeKey);
		}
		else if (type === 'from-index') {
			throw new Error('from-index should be the first in the searches array, not later')
		}
		else {
			processObject(obj, intermediaries, keys);
		}

		//if nothing was generated to intersect, then use ___all___
		if (keys.length == 0) {
			debug('keys.length is zero. adding default ___all___ key');
			keys.push(k('z', '___all___'));
		}

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

	processSorts(self.sorts, intermediaries);

	if (opts.storeKey) {
		//store the results rather than retrieve them;
		commands.push(['rename', intermediaries[intermediaries.length - 1], opts.storeKey]);
	}
	else {
		var start = 0;
		var stop = -1;

		if (opts.page) {
			start = (opts.page - 1) * opts.pageSize;
			stop = (opts.page * opts.pageSize) - 1;
		}

		//get the members
		if (sortDirection === 'desc') {
			commands.push(['zrevrange', intermediaries[intermediaries.length - 1], start, stop, "withscores"]);
		}
		else {
			commands.push(['zrange', intermediaries[intermediaries.length - 1], start, stop, "withscores"]);
		}
	}

	//cleanup
	commands.push(['del'].concat(intermediaries).concat(del));

	debug(commands);

	client.multi(commands).exec(function (err, result) {
		if (err) {
			return end(err);
		}

		debug('exec initial callback', result);

		var total = result[offset - 1];
		var matches = result[offset];

		if (self.index.compress && Array.isArray(result)) {
			matches.forEach(function (match, i) {
				if (Buffer.isBuffer(match)) {
					matches[i] = match.toString();
				}
			});
		}

		if (opts.page) {
			matches._page = new Page(opts.page, opts.pageSize, total);
		}

		if (opts.storeKey) {
			debug('data stored at key: %s, matches: %s', opts.storeKey, matches);

			return end(null, matches);
		}

		//if objects are not stored then just return the matches
		if (!self.index.storeObject || opts.indexesOnly) {
			return end(null, matches);
		}

		var lookups = [];

		for (var x = 0; x < matches.length; x += 2) {
			lookups.push(k('k', '___obj___', matches[x]));
		}

		if (!lookups.length) {
			//we used to return an empty array here, but since matches should be
			// an empty array (because lookups got nothing pushed to it), then
			// we can just pass matches because it might already have the _page
			// object attached to it.
			return end(err, matches);
		}

		debug('exec getting json objects');

		client.mget(lookups, function (err, result) {
			if (err) {
				return end(err);
			}

			debug('exec received %s json objects', result.length);

			result.forEach(function (json, i) {
				if (self.index.compress) {
					json = self.index.compress.decode(json);
				}
				else if (Buffer.isBuffer(json)) {
					json = json.toString('utf-8');
				}

				result[i] = JSON.parse(json, DateReviver);

				if (opts.score) {
					result[i]._score = matches[(i * 2) + 1];
				}
			});

			debug('finished parsing %s json objects', result.length);

			//if the _page object exists, copy it to the result object
			if (matches._page) {
				result._page = matches._page;
			}

			return end(err, result);
		});
	});

	function end(err, result) {
		if (cb) {
			debug('calling callback function');

			cb(err, result);
		}

		self.index.releaseClient(err, client);
	}

	function processSorts(sorts, intermediaries) {
		var tmp;

		//add commands to process the sorts
		self.sorts.forEach(function (sort) {
			var key = sort.key;
			var direction = sort.direction;

			tmp = k('z', 'search-intermediary', intermediaries.length);
			intermediaries.push(tmp);
			commands.push(['zinterstore', tmp, 2, intermediaries[intermediaries.length -2], k('z', key), 'WEIGHTS', 0, 1]);
			offset += 1;

			//BUG: this specifies a global sort direction; only the last one encountered
			// is respected.
			sortDirection = direction || 'asc';
		});
	}

	function processFromIndex(search) {
		var s = search.obj.search;
		//TODO: fix storeKey
		s.exec({ storeKey : 'asdf' }, function (err, data) {
			self.from('asdf').exec(cb);
		});
	}

	function processIntersect(search, intermediaries, keys) {
		var ssk2
		//do a zinterstore between the left index's latest result set and
		//the left index's requested left key
		ssk2 = k('z', 'search-intermediary', intermediaries.length);
		intermediaries.push(ssk2);
		commands.push(['zinterstore', ssk2, 2, intermediaries[intermediaries.length -2], k('z', search.obj.left), 'weights', 0, 1]);
		offset += 1;

		//then do a zrangestoreswap of the latest result set
		ssk2 = k('z', 'search-intermediary', intermediaries.length);
		intermediaries.push(ssk2);
		commands.push(['eval', lua.zrangestoreswap, 2, ssk2, intermediaries[intermediaries.length -2], 0, -1]);
		offset += 1;

		//then do a zinterstore against the right index's right key
		ssk2 = k('z', 'search-intermediary', intermediaries.length);
		intermediaries.push(ssk2);
		commands.push(['zinterstore', ssk2, 2, intermediaries[intermediaries.length -2], search.obj.index.redisKey('z',  search.obj.right)]);
		offset += 1;
	}

	function processFullText(keyword, intermediaries, keys) {
		var tokens = RedisIndex.tokenize(keyword);

		tokens.forEach(function(tok) {
			keys.push(k('z', '___ft___', tok));
		});
	}

	function processObject(obj, intermediaries, keys) {
		var ssk2;

		Object.keys(obj).forEach(function (key) {
			var schema = getValue(self.index.schema, key) || {};
			var keys2 = [];
			var valIsDate;
			var valIsNumber;
			var valIsString;
			var val = obj[key];

			if (val == null || val == undefined) {
				//we ignore comparison values that are null or undefined
				return
			}

			if (val instanceof comparisons) {
				valIsNumber = isNumber(schema, val.a);
				valIsDate = isDate(schema, val.a);
				valIsString = isString(schema, val.a);

				if (val.type === 'in') {
					//in's are basically an or between all of the values, so we need to
					// create an intermediary here that contains all of the matching direct
					// lookups for this field:value

					ssk2 = k('z', 'search-intermediary', intermediaries.length);
					intermediaries.push(ssk2);
					keys.push(ssk2);

					//TODO: check val.a is an array
					//get all of the lookup keys for whats requested
					val.a.forEach(function (a) {
						if (isDate(schema, a)) {
							keys2.push(k('z', 'd', key, a));
						}
						else if (isNumber(schema, a)) {
							keys2.push(k('z', 'n', key, a));
						}
						else {
							keys2.push(k('z', key, a));
						}
					});

					commands.push(['zunionstore', ssk2, keys2.length].concat(keys2));
					offset += 1;

					return;
				}

				if (val.type === 'full-text') {
					processFullText(val.a, intermediaries, keys);

					return
				}

				if (val.type === 'is-null') {
					keys.push(k('z', key, '__null__'));

					return;
				}

				if (val.type === 'exactly') {
					keys.push(k('z', key, val.a));

					return;
				}

				if (~['gte', 'gt', 'lte', 'lt', 'between'].indexOf(val.type) && (valIsNumber || valIsDate)) {
					var a, b;

					//if the value is a date, then change the dates to their unix timestamp
					if (valIsDate) {
						if (val.a) {
							val.a = +val.a;
						}

						if (val.b) {
							val.b = +val.b;
						}
					}

					if (val.type == 'gte') {
						a = val.a;
						b = '+inf';
					}
					else if (val.type == 'gt') {
						a = '(' + val.a;
						b = '+inf';
					}
					else if (val.type == 'lte') {
						a = '-inf';
						b = val.a;
					}
					else if (val.type == 'lt') {
						a = '-inf';
						b = '(' + val.a;
					}
					else if (val.type == 'between') {
						a = val.a;
						b = val.b;
					}

					ssk2 = k('z', 'search-intermediary', intermediaries.length);
					commands.push(['eval', lua.zrangebyscorestore, 2, ssk2, k('z', key), a, b]);
					keys.push(ssk2);
					intermediaries.push(ssk2);
					offset += 1;

					return;
				}
			}

			//handle dates
			if (isDate(schema, val)) {
				val = val.getTime();

				keys.push(k('z', 'd', key, val));

				return;
			}

			if (isBoolean(schema, val)) {
				keys.push(k('z', key, val));

				return;
			}

			//handle numbers
			if (isNumber(schema, val)) {
				keys.push(k('z', 'n', key, val));

				return;
			}

			if (isString(schema, val)) {
				RedisIndex.tokenize(val, schema).forEach(function (tok) {
					keys.push(k('z', key, tok));
				});

				return;
			}

			//everything else
			keys.push(k('z', key, val));
		});
	}
};

function DateReviver (name, value) {
    if (typeof value === "string" && /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/.test(value)) {
        return new Date(value);
    }
    return value;
}
