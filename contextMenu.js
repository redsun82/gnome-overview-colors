import Clutter from "gi://Clutter";
import St from "gi://St";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { parseHex } from "./colorManager.js";
import * as Overlay from "./overlay.js";
import { escapeRegexLiteral, makeOverrideKey, PALETTE } from "./shared.js";

/** @type {WeakMap<WindowPreview, PopupMenu>} */
const _menus = new WeakMap();
/** @type {WeakMap<WindowPreview, StWidget>} */
const _anchors = new WeakMap();
/** @type {WeakMap<WindowPreview, number>} */
const _clickHandlers = new WeakMap();

const _openMenus = new Set();

/** @param {WindowPreview} windowPreview */
function _ensureAnchor(windowPreview) {
  let anchor = _anchors.get(windowPreview);
  if (!anchor) {
    anchor = new St.Widget({ width: 1, height: 1, visible: true });
    Main.uiGroup.add_child(anchor);
    _anchors.set(windowPreview, anchor);
  }
  return anchor;
}

/** @param {PopupMenu} menu @param {StWidget} anchor @param {ClutterEvent} event */
function _openAtCursor(menu, anchor, event) {
  for (const m of _openMenus) {
    if (m !== menu) m.close();
  }
  const [x, y] = event.get_coords();
  anchor.set_position(x, y);
  menu.open();
}

/** @param {WindowPreview} windowPreview @param {PopupMenu} menu @param {StWidget} anchor */
function _connectSecondaryClick(windowPreview, menu, anchor) {
  if (_clickHandlers.has(windowPreview)) return;

  // Use captured-event (capture phase, top-down) so we intercept right-clicks
  // before child actors consume them, without adding reactive widgets that
  // interfere with hover.
  _clickHandlers.set(
    windowPreview,
    windowPreview.connect(
      "captured-event",
      (
        /** @type {ClutterActor} */ _actor,
        /** @type {ClutterEvent} */ event,
      ) => {
        if (event.type() !== Clutter.EventType.BUTTON_PRESS)
          return Clutter.EVENT_PROPAGATE;
        if (event.get_button() !== Clutter.BUTTON_SECONDARY)
          return Clutter.EVENT_PROPAGATE;
        _openAtCursor(menu, anchor, event);
        return Clutter.EVENT_STOP;
      },
    ),
  );
}

/**
 * Create a PopupMenu anchored to `windowPreview`, register it in tracking maps,
 * and wire up secondary-click + destroy cleanup.
 * @param {WindowPreview} windowPreview
 * @returns {PopupMenu}
 */
function _createMenu(windowPreview) {
  removeMenu(windowPreview);

  const anchor = _ensureAnchor(windowPreview);
  const menu = new PopupMenu.PopupMenu(anchor, 0.0, St.Side.TOP);
  Main.uiGroup.add_child(menu.actor);
  menu.actor.hide();
  _menus.set(windowPreview, menu);
  _openMenus.add(menu);
  // @ts-ignore: 'destroy' signal exists at runtime but not in type defs
  menu.connect("destroy", () => _openMenus.delete(menu));

  _connectSecondaryClick(windowPreview, menu, anchor);
  windowPreview.connect("destroy", () => removeMenu(windowPreview));

  return menu;
}

/**
 * @param {WindowPreview} windowPreview
 * @param {{identity: string, wmClass: string}} colorInfo
 * @param {Settings} settings
 */
export function attachMenu(windowPreview, colorInfo, settings) {
  const { identity, wmClass } = colorInfo;
  const overrideKey = makeOverrideKey(wmClass, identity);

  const menu = _createMenu(windowPreview);

  for (const { label, hex } of PALETTE) {
    const item = new PopupMenu.PopupBaseMenuItem();
    const swatch = new St.Widget({
      style: `background-color: ${hex}; border-radius: 4px;`,
      width: 16,
      height: 16,
    });
    item.add_child(swatch);
    item.add_child(
      new St.Label({
        text: label,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        style: "padding-left: 8px;",
      }),
    );
    item.connect("activate", () => {
      settings.setOverride(overrideKey, hex);
      Overlay.createOverlay(windowPreview, parseHex(hex));
    });
    menu.addMenuItem(item);
  }

  menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  menu.addAction("Clear Override", () => {
    settings.clearOverride(overrideKey);
  });
}

/**
 * @param {WindowPreview} windowPreview
 * @param {MetaWindow} metaWindow
 * @param {Settings} settings
 */
export function attachCreateRuleMenu(windowPreview, metaWindow, settings) {
  const wmClass = metaWindow.get_wm_class() ?? "";
  const title = metaWindow.get_title() ?? "";

  const menu = _createMenu(windowPreview);

  const headerItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
  headerItem.add_child(
    new St.Label({
      text: "Create Matching Rule",
      style: "font-weight: bold;",
      x_expand: true,
    }),
  );
  menu.addMenuItem(headerItem);

  menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

  const classItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
  classItem.add_child(
    new St.Label({
      text: "WM_CLASS:",
      y_align: Clutter.ActorAlign.CENTER,
      style: "padding-right: 8px;",
    }),
  );
  const classEntry = new St.Entry({
    text: escapeRegexLiteral(wmClass),
    hint_text: "WM_CLASS regex",
    can_focus: true,
    x_expand: true,
    style: "min-width: 200px;",
  });
  classItem.add_child(classEntry);
  menu.addMenuItem(classItem);

  const titleItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
  titleItem.add_child(
    new St.Label({
      text: "Title:",
      y_align: Clutter.ActorAlign.CENTER,
      style: "padding-right: 8px;",
    }),
  );
  const titleEntry = new St.Entry({
    text: `(${escapeRegexLiteral(title)})`,
    hint_text: "Capture group = color key; empty = same color for all",
    can_focus: true,
    x_expand: true,
    style: "min-width: 200px;",
  });
  titleItem.add_child(titleEntry);
  const clearTitleBtn = new St.Button({
    label: "×",
    style: "padding: 0 6px;",
    y_align: Clutter.ActorAlign.CENTER,
  });
  clearTitleBtn.connect("clicked", () => titleEntry.set_text(""));
  titleItem.add_child(clearTitleBtn);
  menu.addMenuItem(titleItem);

  menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

  menu.addAction("Save Rule", () => {
    const rules = settings.getRules();
    rules.push({
      wm_class: classEntry.get_text(),
      title_pattern: titleEntry.get_text(),
    });
    settings.setRules(rules);
  });
}

/** @param {WindowPreview} windowPreview */
export function removeMenu(windowPreview) {
  const existing = _menus.get(windowPreview);
  if (existing) {
    existing.destroy();
    _menus.delete(windowPreview);
  }
  const anchor = _anchors.get(windowPreview);
  if (anchor) {
    anchor.destroy();
    _anchors.delete(windowPreview);
  }
  const clickHandlerId = _clickHandlers.get(windowPreview);
  if (clickHandlerId) {
    windowPreview.disconnect(clickHandlerId);
    _clickHandlers.delete(windowPreview);
  }
}
