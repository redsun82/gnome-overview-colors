UUID = gnome-colorer@redsun82.github.io
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: install uninstall schema

install: schema
	mkdir -p $(INSTALL_DIR)
	ln -sfT $(CURDIR) $(INSTALL_DIR)

uninstall:
	rm -f $(INSTALL_DIR)

schema:
	glib-compile-schemas schemas/
