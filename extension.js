/**
 * Extension entry point: monkey-patches Workspace to add colored overlays
 * to window previews in the overview.
 */
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { Workspace } from "resource:///org/gnome/shell/ui/workspace.js";
import * as AltTab from "resource:///org/gnome/shell/ui/altTab.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import * as ColorManager from "./colorManager.js";
import * as Overlay from "./overlay.js";
import {
  attachMenu,
  attachCreateRuleMenu,
  removeMenu,
  clearState as clearMenuState,
} from "./contextMenu.js";
import { debug, setEnabled as setDebugEnabled } from "./log.js";

const TAG = "[overview-colors]";

export default class GnomeOverviewColorsExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    setDebugEnabled(this._settings.get_boolean("debug-logs"));
    this._debugChangedId = this._settings.connect("changed::debug-logs", () => {
      setDebugEnabled(this._settings?.get_boolean("debug-logs") ?? false);
    });

    debug(`${TAG} enable() called`);
    this._rules = this._loadJson("rules", []);
    this._overrides = this._loadJson("color-overrides", {});
    this._overlayPreviews = new Set();

    debug(
      `${TAG} loaded ${this._rules.length} rules: ${JSON.stringify(this._rules)}`,
    );
    debug(`${TAG} loaded overrides: ${JSON.stringify(this._overrides)}`);

    this._rulesChangedId = this._settings.connect("changed::rules", () => {
      this._rules = this._loadJson("rules", []);
      debug(`${TAG} rules changed, now ${this._rules.length} rules`);
      this._refreshAllOverlays();
    });
    this._overridesChangedId = this._settings.connect(
      "changed::color-overrides",
      () => {
        this._overrides = this._loadJson("color-overrides", {});
        debug(`${TAG} overrides changed`);
        this._refreshAllOverlays();
      },
    );

    // Monkey-patch Workspace._addWindowClone
    this._origAddWindowClone = Workspace.prototype._addWindowClone;
    const ext = this;
    /** @type {(metaWindow: MetaWindow) => WindowPreview} */
    Workspace.prototype._addWindowClone = function (metaWindow) {
      debug(
        `${TAG} _addWindowClone called for: wm_class=${metaWindow.get_wm_class()}, title="${metaWindow.get_title()}"`,
      );
      const nBefore = this._windows?.length ?? 0;
      const ret = ext._origAddWindowClone?.call(this, metaWindow);
      const nAfter = this._windows?.length ?? 0;
      debug(
        `${TAG} _addWindowClone returned: ${ret} (type=${typeof ret}), _windows: ${nBefore} -> ${nAfter}`,
      );

      // The original may not return the clone; find it in this._windows
      const preview = ret ?? this._windows?.[this._windows.length - 1];
      debug(
        `${TAG} resolved preview: ${preview}, has window_container: ${!!preview?.window_container}`,
      );

      if (preview) {
        try {
          ext._applyOverlay(preview, metaWindow);
        } catch (e) {
          console.error(
            `${TAG} _applyOverlay error: ${/** @type {Error} */ (e).message}\n${/** @type {Error} */ (e).stack}`,
          );
        }
      } else {
        debug(`${TAG} could not find preview for ${metaWindow.get_wm_class()}`);
      }

      return /** @type {WindowPreview} */ (ret);
    };
    debug(`${TAG} monkey-patch installed`);

    // Hide overlays immediately when the overview starts closing
    this._overviewHidingId = Main.overview.connect("hiding", () => {
      for (const preview of this._overlayPreviews ?? []) {
        const overlay = Overlay.getOverlay(preview);
        if (overlay) overlay.hide();
      }
    });

    // Monkey-patch Alt+Tab popup classes (stable exported API)
    this._windowSwitcherCtor = AltTab.WindowSwitcherPopup;
    if (this._windowSwitcherCtor?.prototype?._init) {
      this._origWindowSwitcherInit = this._windowSwitcherCtor.prototype._init;
      this._windowSwitcherCtor.prototype._init = function () {
        /** @type {any} */ (ext._origWindowSwitcherInit).apply(this, arguments);
        try {
          ext._applyAltTabStylesInPopup(this);
        } catch (e) {
          debug(
            `${TAG} WindowSwitcherPopup color error: ${/** @type {Error} */ (e).message}`,
          );
        }
      };
    } else {
      debug(
        `${TAG} AltTab.WindowSwitcherPopup not available; skipping Alt+Tab coloring`,
      );
    }

    this._appSwitcherCtor = AltTab.AppSwitcherPopup;
    if (this._appSwitcherCtor?.prototype?._init) {
      this._origAppSwitcherInit = this._appSwitcherCtor.prototype._init;
      this._appSwitcherCtor.prototype._init = function () {
        /** @type {any} */ (ext._origAppSwitcherInit).apply(this, arguments);
        try {
          ext._applyAltTabStylesInPopup(this);
        } catch (e) {
          debug(
            `${TAG} AppSwitcherPopup color error: ${/** @type {Error} */ (e).message}`,
          );
        }
      };
    } else {
      debug(
        `${TAG} AltTab.AppSwitcherPopup not available; skipping Alt+Tab coloring`,
      );
    }
  }

  disable() {
    debug(`${TAG} disable() called`);
    // Restore original method
    if (this._origAddWindowClone) {
      Workspace.prototype._addWindowClone = this._origAddWindowClone;
      this._origAddWindowClone = null;
    }

    // Destroy all overlays and menus
    for (const preview of this._overlayPreviews ?? []) {
      Overlay.removeOverlay(preview);
      removeMenu(preview);
    }
    this._overlayPreviews?.clear();
    Overlay.clearState();
    clearMenuState();

    // Restore Alt+Tab monkey-patches
    if (this._origWindowSwitcherInit && this._windowSwitcherCtor?.prototype) {
      this._windowSwitcherCtor.prototype._init = this._origWindowSwitcherInit;
      this._origWindowSwitcherInit = null;
    }
    if (this._origAppSwitcherInit && this._appSwitcherCtor?.prototype) {
      this._appSwitcherCtor.prototype._init = this._origAppSwitcherInit;
      this._origAppSwitcherInit = null;
    }
    this._windowSwitcherCtor = null;
    this._appSwitcherCtor = null;

    // Disconnect signals
    if (this._debugChangedId) {
      this._settings?.disconnect(this._debugChangedId);
      this._debugChangedId = null;
    }
    if (this._rulesChangedId) {
      this._settings?.disconnect(this._rulesChangedId);
      this._rulesChangedId = null;
    }
    if (this._overridesChangedId) {
      this._settings?.disconnect(this._overridesChangedId);
      this._overridesChangedId = null;
    }
    if (this._overviewHidingId) {
      Main.overview.disconnect(this._overviewHidingId);
      this._overviewHidingId = null;
    }

    this._settings = null;
    this._rules = null;
    this._overrides = null;
    this._overlayPreviews = null;
  }

  /**
   * @param {string} key
   * @param {any} fallback
   */
  _loadJson(key, fallback) {
    try {
      return JSON.parse(this._settings?.get_string(key) ?? "");
    } catch (e) {
      console.warn(
        `${TAG} failed to parse setting '${key}': ${/** @type {Error} */ (e).message}`,
      );
      return fallback;
    }
  }

  /**
   * @param {WindowPreview} windowPreview
   * @param {MetaWindow} metaWindow
   */
  _applyOverlay(windowPreview, metaWindow) {
    debug(
      `${TAG} _applyOverlay: wm_class=${metaWindow.get_wm_class()}, title="${metaWindow.get_title()}"`,
    );
    const color = ColorManager.getColor(
      metaWindow,
      this._rules,
      this._overrides,
    );
    debug(
      `${TAG} _applyOverlay: color=${color ? JSON.stringify({ r: color.r, g: color.g, b: color.b, identity: color.identity }) : "null"}`,
    );
    this._overlayPreviews?.add(windowPreview);
    windowPreview.connect("destroy", () => {
      this._overlayPreviews?.delete(windowPreview);
    });

    if (color) {
      Overlay.createOverlay(windowPreview, color);
      attachMenu(
        windowPreview,
        metaWindow,
        color,
        /** @type {GioSettings} */ (this._settings),
      );
    } else {
      // Unmatched window: offer to create a rule via right-click
      attachCreateRuleMenu(
        windowPreview,
        metaWindow,
        /** @type {GioSettings} */ (this._settings),
      );
    }
  }

  /**
   * Apply a colored tint + border to an Alt+Tab switcher item.
   * The preview is a Clutter.Clone that cannot host overlay children,
   * so we style the item container directly.
   * @param {any} widget
   * @param {{r: number, g: number, b: number}} color
   */
  _applyAltTabStyle(widget, color) {
    widget.set_style(
      [
        `background-color: rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`,
        `border: 2px solid rgba(${color.r}, ${color.g}, ${color.b}, 0.85)`,
        "border-radius: 12px",
      ].join("; "),
    );
  }

  /**
   * Apply colors to items in an Alt+Tab popup instance.
   * @param {any} popup
   */
  _applyAltTabStylesInPopup(popup) {
    const seen = new Set();
    const buckets = [
      popup?._items,
      popup?._appIcons,
      popup?._windowIcons,
      popup?._switcherList?._items,
    ];

    for (const bucket of buckets) {
      if (!Array.isArray(bucket)) continue;
      for (const item of bucket) {
        if (!item || seen.has(item)) continue;
        seen.add(item);

        const metaWindow =
          item.window ??
          item.metaWindow ??
          item._window ??
          item.app?.get_windows?.()?.[0] ??
          item._app?.get_windows?.()?.[0];

        if (!metaWindow) continue;

        const color = ColorManager.getColor(
          metaWindow,
          this._rules ?? [],
          this._overrides ?? {},
        );
        if (!color) continue;

        const widget =
          typeof item.set_style === "function"
            ? item
            : typeof item.actor?.set_style === "function"
              ? item.actor
              : null;

        if (widget) this._applyAltTabStyle(widget, color);
      }
    }
  }

  _refreshAllOverlays() {
    debug(`${TAG} _refreshAllOverlays called`);
    // Remove all existing overlays and menus
    for (const preview of this._overlayPreviews ?? []) {
      Overlay.removeOverlay(preview);
      removeMenu(preview);
    }
    this._overlayPreviews?.clear();

    // Walk current workspace views and reapply
    const workspacesDisplay =
      Main.overview._overview?._controls?._workspacesDisplay;
    if (!workspacesDisplay) {
      debug(`${TAG} _refreshAllOverlays: workspacesDisplay not found`);
      return;
    }

    const workspacesViews = workspacesDisplay._workspacesViews;
    if (!workspacesViews) return;

    for (const view of workspacesViews) {
      const workspaces = view?._workspaces;
      if (!workspaces) continue;
      for (const ws of workspaces) {
        if (!ws?._windows) continue;
        for (const preview of ws._windows)
          this._applyOverlay(preview, preview.metaWindow);
      }
    }
  }
}
