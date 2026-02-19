/**
 * Overlay widget: creates and manages the colored tint + aura + border overlay
 * added to WindowPreview actors in the overview.
 */
import St from 'gi://St';

const OVERLAY_KEY = Symbol('gnome-overview-colors-overlay');

/**
 * Build an inline CSS style string for the given RGB color.
 * Produces a subtle tint, inset aura (box-shadow), and solid border.
 */
function buildStyle(r, g, b) {
    return [
        `background-color: rgba(${r}, ${g}, ${b}, 0.12)`,
        `box-shadow: inset 0 0 30px 10px rgba(${r}, ${g}, ${b}, 0.45)`,
        `border: 2px solid rgba(${r}, ${g}, ${b}, 0.6)`,
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
    removeOverlay(windowPreview);

    const container = windowPreview.window_container;
    const overlay = new St.Widget({
        style: buildStyle(color.r, color.g, color.b),
        reactive: false,
        x_expand: true,
        y_expand: true,
    });

    container.add_child(overlay);

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
        existing.destroy();
        delete windowPreview[OVERLAY_KEY];
    }
}

/**
 * Check whether a WindowPreview currently has an overlay.
 */
export function hasOverlay(windowPreview) {
    return !!windowPreview[OVERLAY_KEY];
}
