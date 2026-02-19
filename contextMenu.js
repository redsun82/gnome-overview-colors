/**
 * Right-click context menu for overriding window colors in the overview.
 */
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as ColorManager from './colorManager.js';
import * as Overlay from './overlay.js';
import {debug} from './log.js';

const MENU_KEY = Symbol('gnome-overview-colors-menu');
const ANCHOR_KEY = Symbol('gnome-overview-colors-anchor');
const CLICK_HANDLER_KEY = Symbol('gnome-overview-colors-click-handler');
const TAG = '[overview-colors/context-menu]';

const _openMenus = new Set();

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a 1x1 invisible anchor on Main.uiGroup used as the menu source.
 * Moving this anchor before opening the menu makes it appear at the cursor.
 */
function _ensureAnchor(windowPreview) {
    if (!windowPreview[ANCHOR_KEY]) {
        const anchor = new St.Widget({width: 1, height: 1, visible: true});
        Main.uiGroup.add_child(anchor);
        windowPreview[ANCHOR_KEY] = anchor;
    }
    return windowPreview[ANCHOR_KEY];
}

function _openAtCursor(menu, anchor, event) {
    // Close any other open menus first
    for (const m of _openMenus) {
        if (m !== menu)
            m.close();
    }
    const [x, y] = event.get_coords();
    anchor.set_position(x, y);
    menu.open();
}

function _connectSecondaryClick(windowPreview, menu, anchor) {
    if (windowPreview[CLICK_HANDLER_KEY])
        return;

    debug(`${TAG} connect secondary-click handler on ${windowPreview}`);
    // Use captured-event (capture phase, top-down) so we intercept right-clicks
    // before child actors consume them, without adding reactive widgets that
    // interfere with hover.
    windowPreview[CLICK_HANDLER_KEY] = windowPreview.connect('captured-event', (_actor, event) => {
        if (event.type() !== Clutter.EventType.BUTTON_PRESS)
            return Clutter.EVENT_PROPAGATE;
        if (event.get_button() !== Clutter.BUTTON_SECONDARY)
            return Clutter.EVENT_PROPAGATE;
        debug(`${TAG} secondary click on WindowPreview -> open menu`);
        _openAtCursor(menu, anchor, event);
        return Clutter.EVENT_STOP;
    });
}

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

    const anchor = _ensureAnchor(windowPreview);
    const menu = new PopupMenu.PopupMenu(anchor, 0.0, St.Side.TOP);
    Main.uiGroup.add_child(menu.actor);
    menu.actor.hide();
    windowPreview[MENU_KEY] = menu;
    _openMenus.add(menu);
    menu.connect('destroy', () => _openMenus.delete(menu));

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

    _connectSecondaryClick(windowPreview, menu, anchor);

    windowPreview.connect('destroy', () => removeMenu(windowPreview));
}

/**
 * Attach a right-click context menu to an unmatched WindowPreview for rule creation.
 * Shows editable WM_CLASS and title pattern fields prefilled from the window.
 *
 * @param {WindowPreview} windowPreview
 * @param {Meta.Window} metaWindow
 * @param {Gio.Settings} settings
 */
export function attachCreateRuleMenu(windowPreview, metaWindow, settings) {
    removeMenu(windowPreview);

    const wmClass = metaWindow.get_wm_class() ?? '';
    const title = metaWindow.get_title() ?? '';

    const anchor = _ensureAnchor(windowPreview);
    const menu = new PopupMenu.PopupMenu(anchor, 0.0, St.Side.TOP);
    Main.uiGroup.add_child(menu.actor);
    menu.actor.hide();
    windowPreview[MENU_KEY] = menu;
    _openMenus.add(menu);
    menu.connect('destroy', () => _openMenus.delete(menu));

    // Header
    const headerItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
    headerItem.add_child(new St.Label({
        text: 'Create Matching Rule',
        style: 'font-weight: bold;',
        x_expand: true,
    }));
    menu.addMenuItem(headerItem);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // WM_CLASS entry
    const classItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
    classItem.add_child(new St.Label({
        text: 'WM_CLASS:',
        y_align: Clutter.ActorAlign.CENTER,
        style: 'padding-right: 8px;',
    }));
    const classEntry = new St.Entry({
        text: escapeRegex(wmClass),
        hint_text: 'WM_CLASS regex',
        can_focus: true,
        x_expand: true,
        style: 'min-width: 200px;',
    });
    classItem.add_child(classEntry);
    menu.addMenuItem(classItem);

    // Title pattern entry
    const titleItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
    titleItem.add_child(new St.Label({
        text: 'Title:',
        y_align: Clutter.ActorAlign.CENTER,
        style: 'padding-right: 8px;',
    }));
    const titleEntry = new St.Entry({
        text: `(${escapeRegex(title)})`,
        hint_text: 'Capture group = color key; empty = same color for all',
        can_focus: true,
        x_expand: true,
        style: 'min-width: 200px;',
    });
    titleItem.add_child(titleEntry);
    const clearTitleBtn = new St.Button({
        label: '×',
        style: 'padding: 0 6px;',
        y_align: Clutter.ActorAlign.CENTER,
    });
    clearTitleBtn.connect('clicked', () => titleEntry.set_text(''));
    titleItem.add_child(clearTitleBtn);
    menu.addMenuItem(titleItem);

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    // Save button
    menu.addAction('Save Rule', () => {
        const rules = _loadJson(settings, 'rules', []);
        rules.push({
            wm_class: classEntry.get_text(),
            title_pattern: titleEntry.get_text(),
        });
        settings.set_string('rules', JSON.stringify(rules));
    });

    _connectSecondaryClick(windowPreview, menu, anchor);

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
    const anchor = windowPreview[ANCHOR_KEY];
    if (anchor) {
        anchor.destroy();
        delete windowPreview[ANCHOR_KEY];
    }
    const clickHandlerId = windowPreview[CLICK_HANDLER_KEY];
    if (clickHandlerId) {
        debug(`${TAG} disconnect secondary-click handler on ${windowPreview}`);
        windowPreview.disconnect(clickHandlerId);
        delete windowPreview[CLICK_HANDLER_KEY];
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
