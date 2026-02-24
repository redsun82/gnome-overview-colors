export const PALETTE = [
  { label: "Red", hex: "#e84040" },
  { label: "Orange", hex: "#e88830" },
  { label: "Yellow", hex: "#d4c030" },
  { label: "Green", hex: "#40b840" },
  { label: "Teal", hex: "#30b8a0" },
  { label: "Cyan", hex: "#30b0e0" },
  { label: "Blue", hex: "#4070e0" },
  { label: "Purple", hex: "#8050d0" },
  { label: "Magenta", hex: "#c040b0" },
  { label: "Pink", hex: "#e06088" },
];

export const BORDER_RADIUS_PX = 12;

/** @param {string} value */
export function escapeRegexLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @param {string} wmClass @param {string} identity */
export function makeOverrideKey(wmClass, identity) {
  return `${wmClass}:${identity}`;
}

/**
 * @param {{r: number, g: number, b: number}} color
 * @param {number} [emphasis]
 */
export function buildOverlayStyle(color, emphasis = 0) {
  const tintAlpha = 0.12 + 0.05 * emphasis;
  const auraBlur = 20 + 8 * emphasis;
  const auraSpread = 6 + 3 * emphasis;
  const auraAlpha = 0.45 + 0.15 * emphasis;

  return [
    `background-color: rgba(${color.r}, ${color.g}, ${color.b}, ${tintAlpha})`,
    `box-shadow: 0 0 ${auraBlur}px ${auraSpread}px rgba(${color.r}, ${color.g}, ${color.b}, ${auraAlpha})`,
    `border-radius: ${BORDER_RADIUS_PX}px`,
  ].join("; ");
}

/** @param {{r: number, g: number, b: number}} color */
export function buildAltTabStyle(color) {
  return [
    `background-color: rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`,
    `border: 2px solid rgba(${color.r}, ${color.g}, ${color.b}, 0.85)`,
    `border-radius: ${BORDER_RADIUS_PX}px`,
  ].join("; ");
}
