/**
 * @template T
 * @param {GioSettings} settings
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export function loadJson(settings, key, fallback) {
  try {
    return JSON.parse(settings.get_string(key));
  } catch {
    return fallback;
  }
}

/** @param {string} str */
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
