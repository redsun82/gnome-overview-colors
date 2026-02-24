import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { Workspace } from "resource:///org/gnome/shell/ui/workspace.js";
import * as AltTab from "resource:///org/gnome/shell/ui/altTab.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { ColorMatcher } from "./colorManager.js";
import * as Overlay from "./overlay.js";
import { Settings } from "./settings.js";
import { attachMenu, attachCreateRuleMenu, removeMenu } from "./contextMenu.js";

class GnomeOverviewColorsImplementation {
  /** @param {GioSettings} gioSettings */
  constructor(gioSettings) {
    this.settings = new Settings(gioSettings);
    this.colorMatcher = this.#buildMatcher();
    /** @type {Set<WindowPreview>} */
    this.overlayPreviews = new Set();

    this.rulesChangedId = this.settings.connect("changed::rules", () => {
      this.colorMatcher = this.#buildMatcher();
      this.#refreshAllOverlays();
    });
    this.overridesChangedId = this.settings.connect(
      "changed::color-overrides",
      () => {
        this.colorMatcher = this.#buildMatcher();
        this.#refreshAllOverlays();
      },
    );

    const origAddWindowClone = Workspace.prototype._addWindowClone;
    this.origAddWindowClone = origAddWindowClone;
    const self = this;
    Workspace.prototype._addWindowClone = function (
      /** @type {MetaWindow} */ metaWindow,
    ) {
      const ret = origAddWindowClone?.call(this, metaWindow);
      const preview = this._windows?.[this._windows.length - 1];
      if (preview) self.#applyOverlay(preview, metaWindow);
      return ret;
    };

    this.overviewHidingId = Main.overview.connect("hiding", () => {
      for (const preview of this.overlayPreviews) {
        const overlay = Overlay.getOverlay(preview);
        if (overlay) overlay.hide();
      }
    });

    this.switcherPatches = [
      this.#patchSwitcher(AltTab.WindowSwitcherPopup, "WindowSwitcherPopup"),
      this.#patchSwitcher(AltTab.AppSwitcherPopup, "AppSwitcherPopup"),
    ];
  }

  destroy() {
    Workspace.prototype._addWindowClone = this.origAddWindowClone;

    for (const preview of this.overlayPreviews) {
      Overlay.removeOverlay(preview);
      removeMenu(preview);
    }
    this.overlayPreviews.clear();

    for (const { ctor, orig } of this.switcherPatches) {
      if (orig && ctor?.prototype) {
        ctor.prototype._init = orig;
      }
    }

    this.settings.disconnect(this.rulesChangedId);
    this.settings.disconnect(this.overridesChangedId);
    Main.overview.disconnect(this.overviewHidingId);
  }

  #buildMatcher() {
    return new ColorMatcher(
      this.settings.getRules(),
      this.settings.getOverrides(),
    );
  }

  /** @param {{ prototype?: { _init?: Function } }} ctor @param {string} name */
  #patchSwitcher(ctor, name) {
    if (!ctor?.prototype?._init) {
      console.warn(
        `[overview-colors] ${name}._init not found; Alt+Tab coloring disabled`,
      );
      return { ctor: null, orig: null };
    }
    const orig = ctor.prototype._init;
    const self = this;
    ctor.prototype._init = function () {
      /** @type {Function} */ (orig).apply(this, arguments);
      self.#applyAltTabStylesInPopup(/** @type {SwitcherPopup} */ (this));
    };
    return { ctor, orig };
  }

  /** @param {WindowPreview} windowPreview @param {MetaWindow} metaWindow */
  #applyOverlay(windowPreview, metaWindow) {
    const color = this.colorMatcher.getColor(metaWindow);
    this.overlayPreviews.add(windowPreview);
    windowPreview.connect("destroy", () => {
      this.overlayPreviews.delete(windowPreview);
    });

    if (color) {
      Overlay.createOverlay(windowPreview, color);
      attachMenu(windowPreview, metaWindow, color, this.settings);
    } else {
      attachCreateRuleMenu(windowPreview, metaWindow, this.settings);
    }
  }

  /**
   * Style an Alt+Tab switcher item with a colored tint + border.
   * The preview is a Clutter.Clone that cannot host overlay children,
   * so we style the item container directly.
   * @param {{ set_style: (style: string) => void }} widget
   * @param {{r: number, g: number, b: number}} color
   */
  #applyAltTabStyle(widget, color) {
    widget.set_style(
      [
        `background-color: rgba(${color.r}, ${color.g}, ${color.b}, 0.28)`,
        `border: 2px solid rgba(${color.r}, ${color.g}, ${color.b}, 0.85)`,
        "border-radius: 12px",
      ].join("; "),
    );
  }

  /** @param {SwitcherPopup} popup */
  #applyAltTabStylesInPopup(popup) {
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

        const color = this.colorMatcher.getColor(metaWindow);
        if (!color) continue;

        const widget =
          typeof item.set_style === "function"
            ? item
            : typeof item.actor?.set_style === "function"
              ? item.actor
              : null;

        if (widget) {
          this.#applyAltTabStyle(
            /** @type {{ set_style: (s: string) => void }} */ (widget),
            color,
          );
        }
      }
    }
  }

  #refreshAllOverlays() {
    for (const preview of this.overlayPreviews) {
      Overlay.removeOverlay(preview);
      removeMenu(preview);
    }
    this.overlayPreviews.clear();

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
          this.#applyOverlay(preview, preview.metaWindow);
      }
    }
  }
}

export default class GnomeOverviewColorsExtension extends Extension {
  enable() {
    this._impl = new GnomeOverviewColorsImplementation(this.getSettings());
  }

  disable() {
    this._impl?.destroy();
    this._impl = null;
  }
}
