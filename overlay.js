/**
 * Overlay widget: creates and manages the colored tint + aura + border overlay
 * added to WindowPreview actors in the overview.
 */
import Clutter from "gi://Clutter";
import St from "gi://St";

import { debug } from "./log.js";

const TAG = "[overview-colors/overlay]";

/** @type {WeakMap<WindowPreview, StWidget>} */
const _overlays = new WeakMap();

/** @type {WeakMap<StWidget, {container: ClutterActor, signalIds: number[]}>} */
const _scaleSync = new WeakMap();

/**
 * Build an inline CSS style string for the given RGB color.
 * Produces a subtle tint, outward-bleeding aura (box-shadow), and solid border.
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @param {number} [emphasis]
 */
function buildStyle(r, g, b, emphasis = 0) {
  const tintAlpha = 0.12 + 0.05 * emphasis;
  const auraBlur = 30 + 10 * emphasis;
  const auraSpread = 10 + 4 * emphasis;
  const auraAlpha = 0.45 + 0.15 * emphasis;

  return [
    `background-color: rgba(${r}, ${g}, ${b}, ${tintAlpha})`,
    `box-shadow: 0 0 ${auraBlur}px ${auraSpread}px rgba(${r}, ${g}, ${b}, ${auraAlpha})`,
    `border-radius: 12px`,
  ].join("; ");
}

/**
 * @param {StWidget} overlay
 * @param {ClutterActor} container
 * @param {{r: number, g: number, b: number}} color
 */
function _syncOverlayScale(overlay, container, color) {
  const applyVisuals = () => {
    overlay.set_scale(container.scale_x, container.scale_y);

    // WindowPreview hover bump is subtle; normalize to [0..1] for style emphasis.
    const hoverScale = Math.max(container.scale_x, container.scale_y);
    const emphasis = Math.max(0, Math.min(1, (hoverScale - 1) / 0.06));
    overlay.set_style(buildStyle(color.r, color.g, color.b, emphasis));
  };

  // Match WindowPreview hover growth, which is animated via actor scale.
  overlay.set_pivot_point(0.5, 0.5);
  applyVisuals();

  const signalIds = [
    container.connect("notify::scale-x", applyVisuals),
    container.connect("notify::scale-y", applyVisuals),
  ];

  _scaleSync.set(overlay, { container, signalIds });
  overlay.connect("destroy", () => {
    const syncInfo = _scaleSync.get(overlay);
    if (!syncInfo) return;

    for (const signalId of syncInfo.signalIds)
      syncInfo.container.disconnect(signalId);

    _scaleSync.delete(overlay);
  });
}

/**
 * Add a colored overlay to a WindowPreview, constrained to its window_container.
 *
 * @param {WindowPreview} windowPreview
 * @param {{r: number, g: number, b: number}} color
 */
export function createOverlay(windowPreview, color) {
  debug(
    `${TAG} createOverlay: rgb(${color.r},${color.g},${color.b}) on ${windowPreview}`,
  );
  removeOverlay(windowPreview);

  const container = windowPreview.window_container;
  if (!container) {
    debug(`${TAG} createOverlay: windowPreview has no window_container!`);
    return;
  }

  const overlay = new St.Widget({
    style: buildStyle(color.r, color.g, color.b),
    reactive: false,
  });

  // Add overlay to the windowPreview itself, not window_container
  // (window_container uses WindowPreviewLayout which ignores non-tracked children)
  windowPreview.add_child(overlay);

  // Bind position and size to window_container
  overlay.add_constraint(
    new Clutter.BindConstraint({
      source: container,
      coordinate: Clutter.BindCoordinate.POSITION,
    }),
  );
  overlay.add_constraint(
    new Clutter.BindConstraint({
      source: container,
      coordinate: Clutter.BindCoordinate.SIZE,
    }),
  );

  debug(`${TAG} overlay added to windowPreview, bound to container`);

  _overlays.set(windowPreview, overlay);
}

/**
 * Remove a previously added overlay from a WindowPreview.
 *
 * @param {WindowPreview} windowPreview
 */
export function removeOverlay(windowPreview) {
  const existing = _overlays.get(windowPreview);
  if (existing) {
    debug(`${TAG} removeOverlay: removing existing overlay`);
    existing.destroy();
    _overlays.delete(windowPreview);
  }
}

/**
 * Get the overlay widget from a WindowPreview, if any.
 * @param {WindowPreview} windowPreview
 */
export function getOverlay(windowPreview) {
  return _overlays.get(windowPreview) ?? null;
}

/**
 * Check whether a WindowPreview currently has an overlay.
 * @param {WindowPreview} windowPreview
 */
export function hasOverlay(windowPreview) {
  return _overlays.has(windowPreview);
}
