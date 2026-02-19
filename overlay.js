/**
 * Overlay widget: creates and manages the colored tint + aura + border overlay
 * added to WindowPreview actors in the overview.
 */
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {debug} from './log.js';

const TAG = '[overview-colors/overlay]';
const OVERLAY_KEY = Symbol('gnome-overview-colors-overlay');

/**
 * Build an inline CSS style string for the given RGB color.
 * Produces a subtle tint, outward-bleeding aura (box-shadow), and solid border.
 */
function buildStyle(r, g, b) {
    return [
        `background-color: rgba(${r}, ${g}, ${b}, 0.12)`,
        `box-shadow: 0 0 30px 10px rgba(${r}, ${g}, ${b}, 0.45)`,
        `border-radius: 12px`,
    ].join('; ');
}

/**
 * Add a colored overlay to a WindowPreview, constrained to its window_container.
 *
 * @param {WindowPreview} windowPreview
 * @param {{r: number, g: number, b: number}} color
 */
export function createOverlay(windowPreview, color) {
    debug(`${TAG} createOverlay: rgb(${color.r},${color.g},${color.b}) on ${windowPreview}`);
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
    overlay.add_constraint(new Clutter.BindConstraint({
        source: container,
        coordinate: Clutter.BindCoordinate.POSITION,
    }));
    overlay.add_constraint(new Clutter.BindConstraint({
        source: container,
        coordinate: Clutter.BindCoordinate.SIZE,
    }));

    debug(`${TAG} overlay added to windowPreview, bound to container`);

    windowPreview[OVERLAY_KEY] = overlay;
}

/**
 * Remove a previously added overlay from a WindowPreview.
 *
 * @param {WindowPreview} windowPreview
 */
export function removeOverlay(windowPreview) {
    const existing = windowPreview[OVERLAY_KEY];
    if (existing) {
        debug(`${TAG} removeOverlay: removing existing overlay`);
        existing.destroy();
        delete windowPreview[OVERLAY_KEY];
    }
}

/**
 * Get the overlay widget from a WindowPreview, if any.
 */
export function getOverlay(windowPreview) {
    return windowPreview[OVERLAY_KEY] ?? null;
}

/**
 * Check whether a WindowPreview currently has an overlay.
 */
export function hasOverlay(windowPreview) {
    return !!windowPreview[OVERLAY_KEY];
}
