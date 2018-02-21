module.exports = isObjectArray;

function isObjectArray (schema, val) {
  if (schema.type === 'object-array') {
    return true;
  }

  if (!Array.isArray(val)) {
    //it's not an array at all!
    return false;
  }

  if (!val.length) {
    //there are no elements in the array, so we can't determine if it's an
    // object array
    return false;
  }

  //TODO: check the first couple of elements
  if (typeof val[0] !== 'object') {
    return false;
  }

  return true;
}
