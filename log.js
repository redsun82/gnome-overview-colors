/**
 * Shared debug logger. Gated behind the "debug-logs" preference.
 */

let _enabled = false;

export function setEnabled(enabled) {
    _enabled = enabled;
}

export function debug(...args) {
    if (_enabled)
        console.log(...args);
}
