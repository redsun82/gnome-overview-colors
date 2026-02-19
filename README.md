# Overview colors

A GNOME Shell extension that adds colored shades to window thumbnails in the
overview, helping you quickly identify windows at a glance.

## Features

* **Rule-based matching** — define regex rules on `WM_CLASS` and window title to
  select which windows get colored
* **Deterministic colors** — colors are assigned by hashing a stable identity
  extracted from the window title (e.g. the VS Code workspace name), so the same
  window always gets the same color
* **Persistent across sessions** — hash-based, no state needed
* **Manual overrides** — right-click a window in the overview to pick a color
  from a palette; overrides are saved in GSettings

## Installation

```sh
make install    # symlinks into ~/.local/share/gnome-shell/extensions/
make schema     # compiles GSettings schema
```

Then restart GNOME Shell (`Alt+F2` → `r` on X11, or log out/in on Wayland) and
enable the extension:

```sh
gnome-extensions enable gnome-overview-colors@redsun82.github.io
```

## Configuration

Open the extension preferences to add window-matching rules:

```sh
gnome-extensions prefs gnome-overview-colors@redsun82.github.io
```

Each rule has:
- **WM_CLASS pattern** — regex matched against `WM_CLASS` (e.g. `^code$` for
  VS Code)
- **Title pattern** — regex with a **capture group**; the captured text becomes
  the identity used for color hashing (e.g. `— (.+?) —` captures the workspace
  name from a VS Code title like `file.ts — MyProject — Visual Studio Code`)

## License

GPL-3.0
