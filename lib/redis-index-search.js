module.exports = RedisIndexSearch;

var redis = require('redis');
var redisKey = require('redis-key');
var debug = require('debug')('redis-index:search');
var RedisIndex = require('./redis-index');
var lua = require('./lua');
var isNumber = require('./is-number');
var isDate = require('./is-date');
var isString = require('./is-string');
var isObject = require('./is-object');
var isBoolean = require('./is-boolean');
var isObjectArray = require('./is-object-array');
var comparisons = require('./comparisons');

comparisons.copy(RedisIndexSearch);

function RedisIndexSearch (index) {
	var self = this;

	self.index = index;

	self.searches = [];
}

RedisIndexSearch.prototype.find = function (obj, type) {
	var self = this;

	self.searches.push({
		type : type || 'and'
		, obj : obj || {}
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
	var del = [];
	var offset = 0;

	var sk = k('z', 'search-result');

	self.searches.forEach(function (search, i) {
		var keys = [];
		var type = search.type;
		var obj = search.obj;
		var ssk = k('z', 'search-intermediary', intermediaries.length);
		var ssk2;

		Object.keys(obj).forEach(function (key) {
			var schema = self.index.schema[key] || {};
			var valIsDate;
			var valIsNumber;
			var val = obj[key];

			if (val == null || val == undefined) {
				//we ignore comparison values that are null or undefined
				return
			}

			if (val instanceof comparisons) {
				valIsNumber = isNumber(schema, val.a);
				valIsDate = isDate(schema, val.a);

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

			//handle numbers
			if (isNumber(schema, val)) {
				keys.push(k('z', 'n', key, val));

				return;
			}

			//everything else
			keys.push(k('z', key, val));
		});

		//if nothing was generated to intersect, then use ___all___
		if (keys.length == 0) {
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

	//get the members
	commands.push(['zrange', intermediaries[intermediaries.length - 1], 0, -1]);

	//cleanup
	commands.push(['del'].concat(intermediaries).concat(del));

	debug(commands);

	client.multi(commands).exec(function (err, result) {
		if (err) {
			return end(err);
		}

		debug('exec initial callback', result);

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
				result[i] = JSON.parse(json, DateReviver);
			});

			debug('finished parsing %s json objects', result.length);

			return end(err, result);
		});
	});

	function end(err, result) {
		if (cb) {
			debug('calling callback function');

			cb(err, result);
		}

		client.quit();
	}
};

function DateReviver (name, value) {
    if (typeof value === "string" && /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/.test(value)) {
        return new Date(value);
    }
    return value;
}
