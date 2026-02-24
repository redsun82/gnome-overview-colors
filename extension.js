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

export default class GnomeOverviewColorsExtension extends Extension {
  enable() {
    const settings = this.getSettings();

    this._rules = this._loadJson("rules", []);
    this._overrides = this._loadJson("color-overrides", {});
    this._overlayPreviews = new Set();
    this._settings = settings;

    this._rulesChangedId = this._settings.connect("changed::rules", () => {
      this._rules = this._loadJson("rules", []);
      this._refreshAllOverlays();
    });
    this._overridesChangedId = this._settings.connect(
      "changed::color-overrides",
      () => {
        this._overrides = this._loadJson("color-overrides", {});
        this._refreshAllOverlays();
      },
    );

    // Monkey-patch Workspace._addWindowClone
    this._origAddWindowClone = Workspace.prototype._addWindowClone;
    const ext = this;
    /** @type {(metaWindow: MetaWindow) => WindowPreview} */
    Workspace.prototype._addWindowClone = function (metaWindow) {
      const ret = ext._origAddWindowClone?.call(this, metaWindow);

      // The original may not return the clone; find it in this._windows
      const preview = ret ?? this._windows?.[this._windows.length - 1];

      if (preview) {
        ext._applyOverlay(preview, metaWindow);
      }

      return /** @type {WindowPreview} */ (ret);
    };

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
        ext._applyAltTabStylesInPopup(this);
      };
    } else {
    }

    this._appSwitcherCtor = AltTab.AppSwitcherPopup;
    if (this._appSwitcherCtor?.prototype?._init) {
      this._origAppSwitcherInit = this._appSwitcherCtor.prototype._init;
      this._appSwitcherCtor.prototype._init = function () {
        /** @type {any} */ (ext._origAppSwitcherInit).apply(this, arguments);
        ext._applyAltTabStylesInPopup(this);
      };
    } else {
    }
  }

  disable() {
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
      return JSON.parse(
        /** @type {GioSettings} */ (this._settings).get_string(key),
      );
    } catch (e) {
      console.warn(
        `[overview-colors] failed to parse setting '${key}': ${/** @type {Error} */ (e).message}`,
      );
      return fallback;
    }
  }

  /**
   * @param {WindowPreview} windowPreview
   * @param {MetaWindow} metaWindow
   */
  _applyOverlay(windowPreview, metaWindow) {
    const color = ColorManager.getColor(
      metaWindow,
      this._rules,
      this._overrides,
    );
    /** @type {Set<WindowPreview>} */ (this._overlayPreviews).add(
      windowPreview,
    );
    windowPreview.connect("destroy", () => {
      /** @type {Set<WindowPreview>} */ (this._overlayPreviews).delete(
        windowPreview,
      );
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
          this._rules,
          this._overrides,
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
    // Remove all existing overlays and menus
    for (const preview of this._overlayPreviews ?? []) {
      Overlay.removeOverlay(preview);
      removeMenu(preview);
    }
    this._overlayPreviews?.clear();

    // Walk current workspace views and reapply
    const workspacesDisplay =
      Main.overview._overview?._controls?._workspacesDisplay;
    if (!workspacesDisplay) return;

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
