module.exports = isString;

function isString (schema, val) {
  if (schema.type === 'string' || (!schema.type && typeof val === 'string')) {
    return true;
  }

  return false
}
