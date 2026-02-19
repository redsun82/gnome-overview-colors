/**
 * Extension entry point: monkey-patches Workspace to add colored overlays
 * to window previews in the overview.
 */
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {Workspace} from 'resource:///org/gnome/shell/ui/workspace.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as ColorManager from './colorManager.js';
import * as Overlay from './overlay.js';
import {attachMenu, removeMenu} from './contextMenu.js';

export default class GnomeOverviewColorsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._rules = this._loadJson('rules', []);
        this._overrides = this._loadJson('color-overrides', {});
        this._overlayPreviews = new Set();

        this._rulesChangedId = this._settings.connect('changed::rules', () => {
            this._rules = this._loadJson('rules', []);
            this._refreshAllOverlays();
        });
        this._overridesChangedId = this._settings.connect('changed::color-overrides', () => {
            this._overrides = this._loadJson('color-overrides', {});
            this._refreshAllOverlays();
        });

        // Monkey-patch Workspace._addWindowClone
        this._origAddWindowClone = Workspace.prototype._addWindowClone;
        const ext = this;
        Workspace.prototype._addWindowClone = function (metaWindow) {
            const clone = ext._origAddWindowClone.call(this, metaWindow);
            ext._applyOverlay(clone, metaWindow);
            return clone;
        };
    }

    disable() {
        // Restore original method
        if (this._origAddWindowClone) {
            Workspace.prototype._addWindowClone = this._origAddWindowClone;
            this._origAddWindowClone = null;
        }

        // Destroy all overlays and menus
        for (const preview of this._overlayPreviews) {
            Overlay.removeOverlay(preview);
            removeMenu(preview);
        }
        this._overlayPreviews.clear();

        // Disconnect signals
        if (this._rulesChangedId) {
            this._settings.disconnect(this._rulesChangedId);
            this._rulesChangedId = null;
        }
        if (this._overridesChangedId) {
            this._settings.disconnect(this._overridesChangedId);
            this._overridesChangedId = null;
        }

        this._settings = null;
        this._rules = null;
        this._overrides = null;
        this._overlayPreviews = null;
    }

    _loadJson(key, fallback) {
        try {
            return JSON.parse(this._settings.get_string(key));
        } catch {
            return fallback;
        }
    }

    _applyOverlay(windowPreview, metaWindow) {
        const color = ColorManager.getColor(metaWindow, this._rules, this._overrides);
        if (color) {
            Overlay.createOverlay(windowPreview, color);
            this._overlayPreviews.add(windowPreview);

            // Attach right-click context menu
            attachMenu(windowPreview, metaWindow, color, this._settings);

            windowPreview.connect('destroy', () => {
                this._overlayPreviews.delete(windowPreview);
            });
        }
    }

    _refreshAllOverlays() {
        // Remove all existing overlays and menus
        for (const preview of this._overlayPreviews) {
            Overlay.removeOverlay(preview);
            removeMenu(preview);
        }
        this._overlayPreviews.clear();

        // Walk current workspace views and reapply
        const workspacesDisplay = Main.overview._overview?._controls?._workspacesDisplay;
        if (!workspacesDisplay)
            return;

        const workspacesViews = workspacesDisplay._workspacesViews;
        if (!workspacesViews)
            return;

        for (const view of workspacesViews) {
            const workspaces = view?._workspaces;
            if (!workspaces)
                continue;
            for (const ws of workspaces) {
                if (!ws?._windows)
                    continue;
                for (const preview of ws._windows)
                    this._applyOverlay(preview, preview.metaWindow);
            }
        }
    }
}
