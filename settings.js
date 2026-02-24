/**
 * Thin wrapper around Gio.Settings for typed access to extension settings.
 * Safe to use in both the extension process and the preferences process.
 */

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** @param {unknown} value @returns {value is string} */
function isString(value) {
  return typeof value === "string";
}

/** @param {unknown} value */
function normalizeHex(value) {
  if (!isString(value) || !HEX_COLOR_RE.test(value)) return null;
  return value.toLowerCase();
}

/** @param {unknown} value */
function sanitizeRule(value) {
  if (!value || typeof value !== "object") return null;

  const wmClass = /** @type {{ wm_class?: unknown }} */ (value).wm_class;
  const titlePattern = /** @type {{ title_pattern?: unknown }} */ (value)
    .title_pattern;

  if (!isString(wmClass) || !isString(titlePattern)) return null;

  return {
    wm_class: wmClass,
    title_pattern: titlePattern,
  };
}

/** @param {unknown} value @returns {Rule[]} */
function sanitizeRules(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((rule) => sanitizeRule(rule))
    .filter((rule) => rule !== null);
}

/** @param {unknown} value @returns {Record<string, string>} */
function sanitizeOverrides(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  /** @type {Record<string, string>} */
  const result = {};
  for (const [key, hex] of Object.entries(value)) {
    const normalizedHex = normalizeHex(hex);
    if (!normalizedHex) continue;
    if (!isString(key) || key.length === 0) continue;
    result[key] = normalizedHex;
  }

  return result;
}

export class Settings {
  /** @param {GioSettings} gioSettings */
  constructor(gioSettings) {
    this._s = gioSettings;
  }

  /** @returns {Rule[]} */
  getRules() {
    return sanitizeRules(this.#loadJson("rules", []));
  }

  /** @param {Rule[]} rules */
  setRules(rules) {
    this._s.set_string("rules", JSON.stringify(sanitizeRules(rules)));
  }

  /** @returns {Record<string, string>} */
  getOverrides() {
    return sanitizeOverrides(this.#loadJson("color-overrides", {}));
  }

  /** @param {string} key @param {string} hex */
  setOverride(key, hex) {
    const normalizedHex = normalizeHex(hex);
    if (!normalizedHex || !key) return;

    const overrides = this.getOverrides();
    overrides[key] = normalizedHex;
    this._s.set_string("color-overrides", JSON.stringify(overrides));
  }

  /** @param {string} key */
  clearOverride(key) {
    const overrides = this.getOverrides();
    delete overrides[key];
    this._s.set_string("color-overrides", JSON.stringify(overrides));
  }

  clearAllOverrides() {
    this._s.set_string("color-overrides", "{}");
  }

  /**
   * @param {string} signal
   * @param {() => void} callback
   * @returns {number}
   */
  connect(signal, callback) {
    return this._s.connect(signal, callback);
  }

  /** @param {number} id */
  disconnect(id) {
    this._s.disconnect(id);
  }

  /**
   * @template T
   * @param {string} key
   * @param {T} fallback
   * @returns {T}
   */
  #loadJson(key, fallback) {
    try {
      return JSON.parse(this._s.get_string(key));
    } catch {
      return fallback;
    }
  }
}
