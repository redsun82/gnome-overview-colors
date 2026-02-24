type MetaWindow = import("gi://Meta").default.Window;
type GioSettings = import("gi://Gio").default.Settings;
type StWidget = import("gi://St").default.Widget;
type ClutterActor = import("gi://Clutter").default.Actor;
type ClutterEvent = import("gi://Clutter").default.Event;
type WindowPreview =
  import("resource:///org/gnome/shell/ui/windowPreview.js").WindowPreview;
type PopupMenu =
  import("resource:///org/gnome/shell/ui/popupMenu.js").PopupMenu;

type AdwPreferencesGroup = import("gi://Adw").default.PreferencesGroup;
type AdwPreferencesWindow = import("gi://Adw").default.PreferencesWindow;
type GtkEntry = import("gi://Gtk").default.Entry;
type GtkWidget = import("gi://Gtk").default.Widget;
type AdwPreferencesRow = import("gi://Adw").default.PreferencesRow;

type Settings = import("./settings.js").Settings;

interface Rule {
  wm_class: string;
  title_pattern: string;
}

/** Duck-typed Alt+Tab switcher item (unstable GNOME Shell internals). */
interface SwitcherItem {
  window?: MetaWindow;
  metaWindow?: MetaWindow;
  _window?: MetaWindow;
  app?: { get_windows?(): MetaWindow[] };
  _app?: { get_windows?(): MetaWindow[] };
  set_style?: (style: string) => void;
  actor?: { set_style?: (style: string) => void };
}

/** Duck-typed Alt+Tab switcher popup (unstable GNOME Shell internals). */
interface SwitcherPopup {
  _items?: SwitcherItem[];
  _appIcons?: SwitcherItem[];
  _windowIcons?: SwitcherItem[];
  _switcherList?: { _items?: SwitcherItem[] };
}
