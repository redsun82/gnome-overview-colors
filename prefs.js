import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { parseHex } from "./colorManager.js";
import { Settings } from "./settings.js";

export default class GnomeOverviewColorsPrefs extends ExtensionPreferences {
  /** @type {AdwPreferencesRow[]} */
  #ruleRows = [];
  /** @type {AdwPreferencesRow[]} */
  #overrideRows = [];

  /** @param {AdwPreferencesWindow} window */
  async fillPreferencesWindow(window) {
    const settings = new Settings(this.getSettings());

    const rulesPage = new Adw.PreferencesPage({
      title: "Rules",
      icon_name: "view-list-symbolic",
    });
    window.add(rulesPage);

    const rulesGroup = new Adw.PreferencesGroup({
      title: "Window Matching Rules",
      description:
        "Each rule matches windows by WM_CLASS and extracts an identity from the title using a regex capture group. The identity determines the color.",
    });
    rulesPage.add(rulesGroup);

    this.#rebuildRulesList(settings, rulesGroup);

    const addGroup = new Adw.PreferencesGroup();
    rulesPage.add(addGroup);
    const addRow = new Adw.ActionRow({ title: "Add New Rule" });
    const addBtn = new Gtk.Button({
      icon_name: "list-add-symbolic",
      valign: Gtk.Align.CENTER,
    });
    addBtn.connect("clicked", () => {
      const rules = settings.getRules();
      rules.push({ wm_class: "", title_pattern: "" });
      settings.setRules(rules);
      this.#rebuildRulesList(settings, rulesGroup);
    });
    addRow.add_suffix(addBtn);
    addGroup.add(addRow);

    const overridesPage = new Adw.PreferencesPage({
      title: "Overrides",
      icon_name: "preferences-color-symbolic",
    });
    window.add(overridesPage);

    const overridesGroup = new Adw.PreferencesGroup({
      title: "Color Overrides",
      description:
        "Colors manually assigned via right-click in the overview. You can clear individual overrides here.",
    });
    overridesPage.add(overridesGroup);

    this.#rebuildOverridesList(settings, overridesGroup);

    const clearAllGroup = new Adw.PreferencesGroup();
    overridesPage.add(clearAllGroup);
    const clearAllRow = new Adw.ActionRow({ title: "Clear All Overrides" });
    const clearAllBtn = new Gtk.Button({
      label: "Clear All",
      valign: Gtk.Align.CENTER,
      css_classes: ["destructive-action"],
    });
    clearAllBtn.connect("clicked", () => {
      settings.clearAllOverrides();
      this.#rebuildOverridesList(settings, overridesGroup);
    });
    clearAllRow.add_suffix(clearAllBtn);
    clearAllGroup.add(clearAllRow);

    settings.connect("changed::color-overrides", () => {
      this.#rebuildOverridesList(settings, overridesGroup);
    });
  }

  /**
   * @param {Settings} settings
   * @param {AdwPreferencesGroup} group
   */
  #rebuildRulesList(settings, group) {
    for (const row of this.#ruleRows) group.remove(row);
    this.#ruleRows = [];

    const rules = settings.getRules();

    rules.forEach((/** @type {Rule} */ rule, /** @type {number} */ index) => {
      const row = new Adw.ExpanderRow({
        title: rule.wm_class || "(empty WM_CLASS)",
        subtitle: rule.title_pattern || "(empty title pattern)",
      });

      const classRow = new Adw.ActionRow({ title: "WM_CLASS Pattern" });
      const classEntry = new Gtk.Entry({
        text: rule.wm_class,
        placeholder_text: "e.g. ^code$",
        valign: Gtk.Align.CENTER,
        hexpand: true,
      });
      classEntry.connect("changed", () => {
        const current = settings.getRules();
        if (current[index]) {
          current[index].wm_class = classEntry.get_text();
          settings.setRules(current);
          row.title = classEntry.get_text() || "(empty WM_CLASS)";
        }
      });
      this.#addRegexValidation(classEntry);
      classRow.add_suffix(classEntry);
      row.add_row(classRow);

      const titleRow = new Adw.ActionRow({ title: "Title Pattern" });
      const titleEntry = new Gtk.Entry({
        text: rule.title_pattern,
        placeholder_text: "e.g. — (.+?) —",
        valign: Gtk.Align.CENTER,
        hexpand: true,
      });
      titleEntry.connect("changed", () => {
        const current = settings.getRules();
        if (current[index]) {
          current[index].title_pattern = titleEntry.get_text();
          settings.setRules(current);
          row.subtitle = titleEntry.get_text() || "(empty title pattern)";
        }
      });
      this.#addRegexValidation(titleEntry);
      titleRow.add_suffix(titleEntry);
      row.add_row(titleRow);

      const deleteRow = new Adw.ActionRow({ title: "Remove Rule" });
      const deleteBtn = new Gtk.Button({
        icon_name: "edit-delete-symbolic",
        valign: Gtk.Align.CENTER,
        css_classes: ["destructive-action"],
      });
      deleteBtn.connect("clicked", () => {
        const current = settings.getRules();
        current.splice(index, 1);
        settings.setRules(current);
        this.#rebuildRulesList(settings, group);
      });
      deleteRow.add_suffix(deleteBtn);
      row.add_row(deleteRow);

      group.add(row);
      this.#ruleRows.push(row);
    });
  }

  /**
   * @param {Settings} settings
   * @param {AdwPreferencesGroup} group
   */
  #rebuildOverridesList(settings, group) {
    for (const row of this.#overrideRows) group.remove(row);
    this.#overrideRows = [];

    const overrides = settings.getOverrides();
    const keys = Object.keys(overrides);

    if (keys.length === 0) {
      const emptyRow = new Adw.ActionRow({
        title: "No overrides set",
        subtitle: "Right-click a window in the overview to assign a color",
      });
      group.add(emptyRow);
      this.#overrideRows.push(emptyRow);
      return;
    }

    for (const key of keys) {
      const hex = /** @type {string} */ (overrides[key]);
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
        const c = parseHex(hex);
        cr.setSourceRGBA(c.r / 255, c.g / 255, c.b / 255, 1.0);
        cr.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, 2 * Math.PI);
        cr.fill();
      });
      row.add_prefix(swatch);

      const clearBtn = new Gtk.Button({
        icon_name: "edit-clear-symbolic",
        valign: Gtk.Align.CENTER,
      });
      clearBtn.connect("clicked", () => {
        settings.clearOverride(key);
      });
      row.add_suffix(clearBtn);

      group.add(row);
      this.#overrideRows.push(row);
    }
  }

  /** @param {GtkEntry} entry */
  #addRegexValidation(entry) {
    entry.connect("changed", () => {
      const text = entry.get_text();
      if (text === "") {
        entry.remove_css_class("error");
        return;
      }
      try {
        new RegExp(text);
        entry.remove_css_class("error");
      } catch {
        entry.add_css_class("error");
      }
    });
  }
}
