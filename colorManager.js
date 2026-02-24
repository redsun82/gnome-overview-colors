import { makeOverrideKey } from "./shared.js";

/** @param {string} str */
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++)
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  return hash;
}

/** @param {number} h @param {number} s @param {number} l */
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/** @param {string} identity @returns {{r: number, g: number, b: number}} */
function hashToColor(identity) {
  const hue = djb2(identity) % 360;
  return hslToRgb(hue, 0.65, 0.55);
}

/** @param {string} hex "#rrggbb" */
export function parseHex(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/**
 * Pre-compiles rules for efficient window matching.
 * Create a new instance when rules or overrides change.
 */
/** @param {string} pattern @param {string} [flags] @returns {RegExp | null} */
function tryCompile(pattern, flags) {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export class ColorMatcher {
  /**
   * @param {Rule[]} rules
   * @param {Record<string, string>} overrides  "wmClass:identity" → "#rrggbb"
   */
  constructor(rules, overrides) {
    /** @type {{classRe: RegExp | null, titleRe: RegExp | null, hasTitlePattern: boolean}[]} */
    this._compiled = rules.map((rule) => ({
      classRe: tryCompile(rule.wm_class, "i"),
      titleRe: rule.title_pattern ? tryCompile(rule.title_pattern) : null,
      hasTitlePattern: !!rule.title_pattern,
    }));
    this._overrides = overrides;
  }

  /**
   * @param {MetaWindow} metaWindow
   * @returns {{identity: string, wmClass: string} | null}
   */
  matchWindow(metaWindow) {
    const wmClass = metaWindow.get_wm_class();
    const title = metaWindow.get_title();
    if (!wmClass || !title) return null;

    for (const { classRe, titleRe, hasTitlePattern } of this._compiled) {
      if (!classRe || !classRe.test(wmClass)) continue;

      if (!hasTitlePattern) return { identity: wmClass, wmClass };

      if (!titleRe) continue;
      const m = title.match(titleRe);
      if (!m) continue;

      const identity = m[1] ?? m[0];
      return { identity, wmClass };
    }
    return null;
  }

  /**
   * @param {MetaWindow} metaWindow
   * @returns {?{r: number, g: number, b: number, identity: string, wmClass: string}}
   */
  getColor(metaWindow) {
    const match = this.matchWindow(metaWindow);
    if (!match) return null;

    const { identity, wmClass } = match;
    const key = makeOverrideKey(wmClass, identity);

    if (this._overrides[key])
      return { ...parseHex(this._overrides[key]), identity, wmClass };

    const color = hashToColor(identity);
    return { ...color, identity, wmClass };
  }
}
