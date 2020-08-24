var test = require('tape');
var RedisIndex = require('../');
var lua = require('../lib/lua');
var debug = require('debug')('redis-index');

test('attempt to replicate and fix issue #5', async function (t) {
    const ri = RedisIndex.createIndex({
        key: 'ri:test',	// Redis key namespace
        index: 'unique',	// he attribute of the document whose value uniquely identifies that object
        schema: {
            description: {literal: false},
            name: {
                literal: true	// index complete phrase with spaces, e.g. 'brenda mcgill' not as 'brenda' and 'mcgill'
            },
            boolz: {type: 'boolean'}
        },
        schemaOnly: true,
        storeObject: false, // *** TOGGLE THIS TO SEE THE BUG ***
    });

    const docs = [
        {unique: 1, name: 'steve', description: 'hello there thing', type: 1, when: new Date(), value: 100, boolz: false},
        {unique: 2, name: 'sam', description: 'this thing is named sam', type: 1, when: new Date(), value: 50, boolz: false},
        {unique: 3, name: 'george', description: 'and here is one george', type: 2, when: new Date(), value: 75, boolz: true},
        {unique: 4, name: 'brenda mcgill', description: 'i am a hungry thing', type: 2, when: new Date(), value: 30, boolz: false},
        {unique: 6, name: 'larry mcgill', description: 'i am a hungry hungry thing', type: 2, when: new Date(), value: 30, boolz: false},
    ];

    for (let d of docs) {
        await ri.add(d);
    }
        
    let ris = await ri.search({
        description: 'hungry'
    });
    
    const result = await ris.exec();
    
    t.deepEqual(result, ['4', '1', '6', '2']);

    // Remove all 
    for (let d of docs) {
        await ri.del(d);
    }

    t.end();
});

test('attempt to replicate and fix issue #5-2', async function (t) {
    const ri = RedisIndex.createIndex({
        key: 'ri:test',	// Redis key namespace
        index: 'unique',	// the attribute of the document whose value uniquely identifies that object
        schema: {
            name: { literal: true},	// index complete phrase with spaces, e.g. 'brenda mcgill' not as 'brenda' and 'mcgill'
            boolz: { type: 'boolean' },
        },
        schemaOnly: true, // only index fields that exist in the schema
        storeObject: false	// store the document in redis or not
    });

    const docs = [
        {unique: 1, name: 'steve', description: 'hello there thing', type: 1, when: new Date(), value: 100, boolz: false},
        {unique: 2, name: 'sam', description: 'this thing is named sam', type: 1, when: new Date(), value: 50, boolz: false},
        {unique: 3, name: 'george', description: 'and here is one george', type: 2, when: new Date(), value: 75, boolz: true},
        {unique: 5, name: 'brenda mcgill', description: 'i am a hungry thing', type: 2, when: new Date(), value: 30, boolz: false},
    ];
    
    for (let d of docs) {
        await ri.add(d);
    }

    let ris = await ri.search({
        name: RedisIndex.exactly('brenda mcgill')
    });

    const result = await ris.exec();

    t.deepEqual(result, ['5', '1'])
    
    for (let d of docs) {
        await ri.del(d);
    }

    t.end();
});