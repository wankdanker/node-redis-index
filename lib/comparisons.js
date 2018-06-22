"use strict";

var each = require('dank-each');

module.exports = RedisIndexSearchComparison;
module.exports.RedisIndexSearchComparison = RedisIndexSearchComparison;
module.exports.copyTo = copyTo;
module.exports.comparisons = comparisons;

function RedisIndexSearchComparison (type, a, b) {
	var self = this;

	self.type = type;
	self.a = a;
	self.b = b;
}

var comparisons = {};

comparisons.between = function (a, b) {
	return new RedisIndexSearchComparison('between', a, b);
};

comparisons.gt = function (a) {
	return new RedisIndexSearchComparison('gt', a);
};

comparisons.gte = function (a) {
	return new RedisIndexSearchComparison('gte', a);
};

comparisons.lt = function (a) {
	return new RedisIndexSearchComparison('lt', a);
};

comparisons.lte = function (a) {
	return new RedisIndexSearchComparison('lte', a);
};

comparisons.in = function (a) {
	return new RedisIndexSearchComparison('in', a);
};

comparisons.exactly = function (a) {
	return new RedisIndexSearchComparison('exactly', a);
};

comparisons.isNull = function () {
	return new RedisIndexSearchComparison('is-null');
};

comparisons.fullText = function (a) {
	return new RedisIndexSearchComparison('full-text', a);
};

// TODO: not implemented
comparisons.contains = function (a) {
	return new RedisIndexSearchComparison('contains', a);
};

function copyTo (target) {
  each(comparisons, function (key, fn) {
    if (key !== 'copyTo') {
      target[key] = fn;
    }
  });
};
