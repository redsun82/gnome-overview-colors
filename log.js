/**
 * Shared debug logger. Gated behind the "debug-logs" preference.
 */

let _enabled = false;

/** @param {boolean} enabled */
export function setEnabled(enabled) {
  _enabled = enabled;
}

/** @param {...unknown} args */
export function debug(...args) {
  if (_enabled) console.log(...args);
}
