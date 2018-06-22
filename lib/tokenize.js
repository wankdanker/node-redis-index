var pluralize = require('pluralize');

module.exports = tokenize;

function tokenize(val, schema, literal) {
  if (!val.toLowerCase) {
    val = String(val);
  }
  
  val = val.toLowerCase();

  var tmp = literal ? [val] : val.split(/\ /g);

  tmp.forEach(function(v, i) {
    tmp[i] = pluralize.singular(v);
  });

  return tmp;
}
