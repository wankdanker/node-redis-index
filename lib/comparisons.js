"use strict";

var each = require('dank-each');

module.exports = RedisIndexSearchComparison;
module.exports.RedisIndexSearchComparison = RedisIndexSearchComparison;
module.exports.copy = copy;
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

// TODO: not implemented
comparisons.contains = function (a) {
	return new RedisIndexSearchComparison('contains', a);
};

comparisons.fullText = function (a) {
	return new RedisIndexSearchComparison('full-text', a);
};

function copy (target) {
  each(comparisons, function (key, fn) {
    if (key !== 'copy') {
      target[key] = fn;
    }
  });
};
