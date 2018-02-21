module.exports = isDate;

function isDate (schema, val) {
  if (schema.type === 'date' || (!schema.type && val instanceof Date)) {
    return true;
  }

  return false
}
