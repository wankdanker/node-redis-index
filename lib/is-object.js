module.exports = isObject;

function isObject (schema, val) {
  if (schema.type === 'object' || (!schema.type && typeof val === 'object')) {
    return true;
  }

  return false
}
