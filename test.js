var RedisIndex = require('./');
var debug = require('debug')('redis-index');

var product = module.exports = RedisIndex.createIndex({
	key : 'product'
	, index : 'item_id'
	, storeObject : true
	, schema : {
		name : {
			literal : true
		}
	}
});

product.add({ item_id : 1, name : 'steve', description : 'hello there thing', type : 1, when : new Date() });
product.add({ item_id : 2, name : 'sam', description : 'this thing is named sam', type : 1, when : new Date() });
product.add({ item_id : 3, name : 'george', description : 'and here is one george', type : 2, when : new Date() });
product.add({ item_id : 4, name : 'brenda mcgill', description : 'i am a hungry thing', type : 2, when : new Date() });

setTimeout(function () {
	product.search({ description : 'thing' }).exec(debug);
	product.search({ description : 'thing', type : 2 }).or({ item_id : 3 }).exec(debug);
}, 1000);
//
// setTimeout(function () {
// 	product.del(1);
// 	product.del(2);
// 	product.del(3);
// 	product.del(4);
// }, 2000);
