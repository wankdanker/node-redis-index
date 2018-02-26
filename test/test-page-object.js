var test = require('tape');
var PageObject = require('../lib/page-object');

test('test page object usage', function (t) {
  var po = new PageObject(1, 25, 123);

  var expect = {
    page: 1
    , size: 25
    , total: 123
    , count: 5
    , start: 0
    , stop: 24
    , first: 1
    , last: 5
    , next: 2
    , previous: null
  };

  t.deepEqual(po, expect, 'page object matches as expected')

  t.end();
});

test('test requesting page more than total pages', function (t) {
  var po = new PageObject(6, 25, 123);

  var expect = {
    page: 6
    , size: 25
    , total: 123
    , count: 5
    , start: 125
    , stop: 122
    , first: 1
    , last: 5
    , next: null
    , previous: 5
  };

  t.deepEqual(po, expect, 'page object matches as expected')

  t.end();
});
