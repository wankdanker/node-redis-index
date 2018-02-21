var readFileSync = require('./read-files-sync');
var join = require('path').join;

module.exports = readFileSync(join(__dirname, '../lua/'));
