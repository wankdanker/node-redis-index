var RedisIndex = require('./');
var debug = require('debug')('redis-index');

var product = RedisIndex.createIndex('product', 'item_id');

product.add({ item_id : 1, name : 'steve', description : 'hello there thing', type : 1 });
product.add({ item_id : 2, name : 'sam', description : 'this thing is named sam', type : 1 });
product.add({ item_id : 3, name : 'george', description : 'and here is one george', type : 2 });
product.add({ item_id : 4, name : 'brenda', description : 'i am a hungry thing', type : 2 });

setTimeout(function () {
	product.search({ description : 'thing' }).exec(debug);
	product.search({ description : 'thing', type : 2 }).or({ item_id : 3 }).exec(debug);
}, 1000);
