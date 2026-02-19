/**
 * Right-click context menu for overriding window colors in the overview.
 */
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as ColorManager from './colorManager.js';
import * as Overlay from './overlay.js';

const MENU_KEY = Symbol('gnome-overview-colors-menu');

// Predefined palette of 10 distinguishable colors
const PALETTE = [
    {label: 'Red',       hex: '#e84040'},
    {label: 'Orange',    hex: '#e88830'},
    {label: 'Yellow',    hex: '#d4c030'},
    {label: 'Green',     hex: '#40b840'},
    {label: 'Teal',      hex: '#30b8a0'},
    {label: 'Cyan',      hex: '#30b0e0'},
    {label: 'Blue',      hex: '#4070e0'},
    {label: 'Purple',    hex: '#8050d0'},
    {label: 'Magenta',   hex: '#c040b0'},
    {label: 'Pink',      hex: '#e06088'},
];

function parseHex(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}

/**
 * Attach a right-click context menu to a WindowPreview for color overrides.
 *
 * @param {WindowPreview} windowPreview
 * @param {Meta.Window} metaWindow
 * @param {{identity: string, wmClass: string}} colorInfo - from getColor()
 * @param {Gio.Settings} settings
 */
export function attachMenu(windowPreview, metaWindow, colorInfo, settings) {
    removeMenu(windowPreview);

    const {identity, wmClass} = colorInfo;
    const overrideKey = `${wmClass}:${identity}`;

    const menu = new PopupMenu.PopupMenu(windowPreview, 0.5, St.Side.TOP);
    Main.uiGroup.add_child(menu.actor);
    menu.actor.hide();
    windowPreview[MENU_KEY] = menu;

    // Add palette items with colored indicator
    for (const {label, hex} of PALETTE) {
        const item = new PopupMenu.PopupBaseMenuItem();
        const swatch = new St.Widget({
            style: `background-color: ${hex}; border-radius: 4px;`,
            width: 16,
            height: 16,
        });
        item.add_child(swatch);
        item.add_child(new St.Label({
            text: label,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            style: 'padding-left: 8px;',
        }));
        item.connect('activate', () => {
            _setOverride(settings, overrideKey, hex);
            const rgb = parseHex(hex);
            Overlay.createOverlay(windowPreview, rgb);
        });
        menu.addMenuItem(item);
    }

    // Separator + clear option
    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    menu.addAction('Clear Override', () => {
        _clearOverride(settings, overrideKey);
        // Recompute hash-based color
        const rules = _loadJson(settings, 'rules', []);
        const overrides = _loadJson(settings, 'color-overrides', {});
        const color = ColorManager.getColor(metaWindow, rules, overrides);
        if (color)
            Overlay.createOverlay(windowPreview, color);
        else
            Overlay.removeOverlay(windowPreview);
    });

    // Right-click handler
    windowPreview.connect('button-press-event', (_actor, event) => {
        if (event.get_button() === Clutter.BUTTON_SECONDARY) {
            menu.open();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });

    windowPreview.connect('destroy', () => removeMenu(windowPreview));
}

/**
 * Remove a previously attached context menu from a WindowPreview.
 */
export function removeMenu(windowPreview) {
    const existing = windowPreview[MENU_KEY];
    if (existing) {
        existing.destroy();
        delete windowPreview[MENU_KEY];
    }
}

function _setOverride(settings, key, hex) {
    const overrides = _loadJson(settings, 'color-overrides', {});
    overrides[key] = hex;
    settings.set_string('color-overrides', JSON.stringify(overrides));
}

function _clearOverride(settings, key) {
    const overrides = _loadJson(settings, 'color-overrides', {});
    delete overrides[key];
    settings.set_string('color-overrides', JSON.stringify(overrides));
}

function _loadJson(settings, key, fallback) {
    try {
        return JSON.parse(settings.get_string(key));
    } catch {
        return fallback;
    }
}
