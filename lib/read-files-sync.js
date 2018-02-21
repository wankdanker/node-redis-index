var fs = require('fs');
var join = require('path').join;
var basename = require('path').basename;
var extname = require('path').extname;

module.exports = readFilesSync;

function readFilesSync (path) {
  var result = {};
  var files = fs.readdirSync(path);

  files.forEach(function (file) {
    var filename = basename(file, extname(file));

    result[filename] = fs.readFileSync(join(path, file), 'utf8');
  });

  return result;
}
