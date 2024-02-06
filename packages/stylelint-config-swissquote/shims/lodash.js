// Since the used modules only use a tiny fraction of lodash we don't want that huge module
// Reimplement them here waiting for https://github.com/stylelint-scss/stylelint-scss/pull/554 to be finished

export function isBoolean(value) {
  return typeof value === "boolean" || value instanceof Boolean;
}

export function isNumber(value) {
  return typeof value === "number" || value instanceof Number;
}

export function isRegExp(value) {
  return value instanceof RegExp;
}

export function isString(value) {
  return typeof value === "string" || value instanceof String;
}

/**
 * All credits go to https://github.com/developit/dlv
 */
/* eslint-disable no-param-reassign */
export function get(obj, key, def, p, undef) {
  key = key.split ? key.split(".") : key;
  for (p = 0; p < key.length; p++) {
    obj = obj ? obj[key[p]] : undef;
  }
  return obj === undef ? def : obj;
}

export function pick(obj, keys) {
  return Object.fromEntries(
    Object.entries(obj).filter((entry) => keys.indexOf(entry[0]) > -1)
  );
}
