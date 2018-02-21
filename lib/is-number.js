module.exports = isNumber;

function isNumber (schema, val) {
  if (schema.type === 'numeric' || (!schema.type && !isNaN(val))) {
    return true;
  }

  return false
}
