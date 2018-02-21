module.exports = isNumber;

function isNumber (schema, val) {
  if (schema.type === 'number' || (!schema.type && !isNaN(val))) {
    return true;
  }

  return false
}
