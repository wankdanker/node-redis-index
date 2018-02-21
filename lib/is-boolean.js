module.exports = isBoolean;

function isBoolean (schema, val) {
  if (schema.type === 'boolean' || (!schema.type && typeof val === 'boolean')) {
    return true;
  }

  return false
}
