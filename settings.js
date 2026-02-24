/**
 * Thin wrapper around Gio.Settings for typed access to extension settings.
 * Safe to use in both the extension process and the preferences process.
 */
export class Settings {
  /** @param {GioSettings} gioSettings */
  constructor(gioSettings) {
    this._s = gioSettings;
  }

  /** @returns {Rule[]} */
  getRules() {
    return this.#loadJson("rules", /** @type {Rule[]} */ ([]));
  }

  /** @param {Rule[]} rules */
  setRules(rules) {
    this._s.set_string("rules", JSON.stringify(rules));
  }

  /** @returns {Record<string, string>} */
  getOverrides() {
    return this.#loadJson(
      "color-overrides",
      /** @type {Record<string, string>} */ ({}),
    );
  }

  /** @param {string} key @param {string} hex */
  setOverride(key, hex) {
    const overrides = this.getOverrides();
    overrides[key] = hex;
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
