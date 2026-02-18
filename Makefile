UUID = gnome-colorer@redsun82.github.io
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SOURCES = metadata.json extension.js colorManager.js overlay.js contextMenu.js prefs.js \
          schemas/org.gnome.shell.extensions.gnome-colorer.gschema.xml

.PHONY: install uninstall schema pack dev-install clean

# Normal install: pack a zip and use gnome-extensions install (no restart needed)
install: pack
	gnome-extensions install --force $(UUID).zip

# Dev install: symlink for live editing (requires GNOME Shell restart)
dev-install: schema
	rm -rf $(INSTALL_DIR)
	mkdir -p $(dir $(INSTALL_DIR))
	ln -sfT $(CURDIR) $(INSTALL_DIR)

uninstall:
	gnome-extensions uninstall $(UUID)

pack: schema
	rm -f $(UUID).zip
	zip $(UUID).zip $(SOURCES) schemas/gschemas.compiled

schema:
	glib-compile-schemas schemas/

clean:
	rm -f $(UUID).zip
