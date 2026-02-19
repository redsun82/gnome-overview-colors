/**
 * Preferences UI for the Overview colors extension.
 * Uses libadwaita (Adw) widgets for GNOME 45+.
 */
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GnomeOverviewColorsPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // --- Rules page ---
        const rulesPage = new Adw.PreferencesPage({
            title: 'Rules',
            icon_name: 'view-list-symbolic',
        });
        window.add(rulesPage);

        const rulesGroup = new Adw.PreferencesGroup({
            title: 'Window Matching Rules',
            description: 'Each rule matches windows by WM_CLASS and extracts an identity from the title using a regex capture group. The identity determines the color.',
        });
        rulesPage.add(rulesGroup);

        // Preset button
        const presetRow = new Adw.ActionRow({
            title: 'Quick Presets',
        });
        const vscodeBtn = new Gtk.Button({
            label: 'Add VS Code Rule',
            valign: Gtk.Align.CENTER,
        });
        vscodeBtn.connect('clicked', () => {
            const rules = this._loadJson(settings, 'rules', []);
            if (!rules.some(r => r.wm_class === '^code$'))
                rules.push({wm_class: '^code$', title_pattern: '— (.+?) —'});
            settings.set_string('rules', JSON.stringify(rules));
            this._rebuildRulesList(settings, rulesGroup, presetRow);
        });
        presetRow.add_suffix(vscodeBtn);

        const codeInsidersBtn = new Gtk.Button({
            label: 'Add Code Insiders Rule',
            valign: Gtk.Align.CENTER,
        });
        codeInsidersBtn.connect('clicked', () => {
            const rules = this._loadJson(settings, 'rules', []);
            if (!rules.some(r => r.wm_class === '^code-insiders$'))
                rules.push({wm_class: '^code-insiders$', title_pattern: '— (.+?) —'});
            settings.set_string('rules', JSON.stringify(rules));
            this._rebuildRulesList(settings, rulesGroup, presetRow);
        });
        presetRow.add_suffix(codeInsidersBtn);

        rulesGroup.add(presetRow);

        this._rebuildRulesList(settings, rulesGroup, presetRow);

        // Add rule button
        const addGroup = new Adw.PreferencesGroup();
        rulesPage.add(addGroup);
        const addRow = new Adw.ActionRow({title: 'Add New Rule'});
        const addBtn = new Gtk.Button({
            icon_name: 'list-add-symbolic',
            valign: Gtk.Align.CENTER,
        });
        addBtn.connect('clicked', () => {
            const rules = this._loadJson(settings, 'rules', []);
            rules.push({wm_class: '', title_pattern: ''});
            settings.set_string('rules', JSON.stringify(rules));
            this._rebuildRulesList(settings, rulesGroup, presetRow);
        });
        addRow.add_suffix(addBtn);
        addGroup.add(addRow);

        // --- Overrides page ---
        const overridesPage = new Adw.PreferencesPage({
            title: 'Overrides',
            icon_name: 'preferences-color-symbolic',
        });
        window.add(overridesPage);

        const overridesGroup = new Adw.PreferencesGroup({
            title: 'Color Overrides',
            description: 'Colors manually assigned via right-click in the overview. You can clear individual overrides here.',
        });
        overridesPage.add(overridesGroup);

        this._rebuildOverridesList(settings, overridesGroup);

        // Clear all button
        const clearAllGroup = new Adw.PreferencesGroup();
        overridesPage.add(clearAllGroup);
        const clearAllRow = new Adw.ActionRow({title: 'Clear All Overrides'});
        const clearAllBtn = new Gtk.Button({
            label: 'Clear All',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
        });
        clearAllBtn.connect('clicked', () => {
            settings.set_string('color-overrides', '{}');
            this._rebuildOverridesList(settings, overridesGroup);
        });
        clearAllRow.add_suffix(clearAllBtn);
        clearAllGroup.add(clearAllRow);

        // Refresh overrides list when settings change (e.g. from right-click menu)
        settings.connect('changed::color-overrides', () => {
            this._rebuildOverridesList(settings, overridesGroup);
        });
    }

    _loadJson(settings, key, fallback) {
        try {
            return JSON.parse(settings.get_string(key));
        } catch {
            return fallback;
        }
    }

    _rebuildRulesList(settings, group, presetRow) {
        for (const row of this._ruleRows ?? [])
            group.remove(row);
        this._ruleRows = [];

        const rules = this._loadJson(settings, 'rules', []);

        rules.forEach((rule, index) => {
            const row = new Adw.ExpanderRow({
                title: rule.wm_class || '(empty WM_CLASS)',
                subtitle: rule.title_pattern || '(empty title pattern)',
            });

            // WM_CLASS entry
            const classRow = new Adw.ActionRow({title: 'WM_CLASS Pattern'});
            const classEntry = new Gtk.Entry({
                text: rule.wm_class,
                placeholder_text: 'e.g. ^code$',
                valign: Gtk.Align.CENTER,
                hexpand: true,
            });
            classEntry.connect('changed', () => {
                const current = this._loadJson(settings, 'rules', []);
                if (current[index]) {
                    current[index].wm_class = classEntry.get_text();
                    settings.set_string('rules', JSON.stringify(current));
                    row.title = classEntry.get_text() || '(empty WM_CLASS)';
                }
            });
            this._addRegexValidation(classEntry);
            classRow.add_suffix(classEntry);
            row.add_row(classRow);

            // Title pattern entry
            const titleRow = new Adw.ActionRow({title: 'Title Pattern'});
            const titleEntry = new Gtk.Entry({
                text: rule.title_pattern,
                placeholder_text: 'e.g. — (.+?) —',
                valign: Gtk.Align.CENTER,
                hexpand: true,
            });
            titleEntry.connect('changed', () => {
                const current = this._loadJson(settings, 'rules', []);
                if (current[index]) {
                    current[index].title_pattern = titleEntry.get_text();
                    settings.set_string('rules', JSON.stringify(current));
                    row.subtitle = titleEntry.get_text() || '(empty title pattern)';
                }
            });
            this._addRegexValidation(titleEntry);
            titleRow.add_suffix(titleEntry);
            row.add_row(titleRow);

            // Delete button
            const deleteRow = new Adw.ActionRow({title: 'Remove Rule'});
            const deleteBtn = new Gtk.Button({
                icon_name: 'edit-delete-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['destructive-action'],
            });
            deleteBtn.connect('clicked', () => {
                const current = this._loadJson(settings, 'rules', []);
                current.splice(index, 1);
                settings.set_string('rules', JSON.stringify(current));
                this._rebuildRulesList(settings, group, presetRow);
            });
            deleteRow.add_suffix(deleteBtn);
            row.add_row(deleteRow);

            group.add(row);
            this._ruleRows.push(row);
        });
    }

    _rebuildOverridesList(settings, group) {
        for (const row of this._overrideRows ?? [])
            group.remove(row);
        this._overrideRows = [];

        const overrides = this._loadJson(settings, 'color-overrides', {});
        const keys = Object.keys(overrides);

        if (keys.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: 'No overrides set',
                subtitle: 'Right-click a window in the overview to assign a color',
            });
            group.add(emptyRow);
            this._overrideRows.push(emptyRow);
            return;
        }

        for (const key of keys) {
            const hex = overrides[key];
            const row = new Adw.ActionRow({
                title: key,
                subtitle: hex,
            });

            const swatch = new Gtk.DrawingArea({
                content_width: 20,
                content_height: 20,
                valign: Gtk.Align.CENTER,
            });
            swatch.set_draw_func((area, cr, w, h) => {
                const c = this._parseHex(hex);
                cr.setSourceRGBA(c.r / 255, c.g / 255, c.b / 255, 1.0);
                cr.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, 2 * Math.PI);
                cr.fill();
            });
            row.add_prefix(swatch);

            const clearBtn = new Gtk.Button({
                icon_name: 'edit-clear-symbolic',
                valign: Gtk.Align.CENTER,
            });
            clearBtn.connect('clicked', () => {
                const current = this._loadJson(settings, 'color-overrides', {});
                delete current[key];
                settings.set_string('color-overrides', JSON.stringify(current));
            });
            row.add_suffix(clearBtn);

            group.add(row);
            this._overrideRows.push(row);
        }
    }

    _addRegexValidation(entry) {
        entry.connect('changed', () => {
            const text = entry.get_text();
            if (text === '') {
                entry.remove_css_class('error');
                return;
            }
            try {
                new RegExp(text);
                entry.remove_css_class('error');
            } catch {
                entry.add_css_class('error');
            }
        });
    }

    _parseHex(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16),
        };
    }
}
