#!/bin/bash
set -e
echo "=== INIZIALIZZAZIONE AMBIENTE BEDROCK ==="
dnf install -y rpm-build rpmdevtools curl wget dnf-plugins-core gcc gcc-c++ cmake ninja-build make rust cargo golang meson dbus-devel glib2-devel gobject-introspection-devel gjs-devel lua-devel gtk4-devel gtk3-devel gtk-layer-shell-devel
cp config/rpmmacros ~/.rpmmacros
rpmdev-setuptree

build_and_install() {
    local spec_path=$1
    echo "========================================"
    echo "=== COMPILAZIONE: $spec_path ==="
    echo "========================================"
    spectool -g -R "$spec_path"
    dnf builddep -y "$spec_path"
    rpmbuild -bb "$spec_path"
    echo "=== INSTALLAZIONE PACCHETTO COMPILATO ==="
    # Installa i pacchetti appena creati per soddisfare le dipendenze dei successivi
    find /root/rpmbuild/RPMS -name "*.rpm" -exec dnf install -y {} +
}

# 1. Ananicy-cpp
build_and_install "specs/ermete-ananicy/ananicy-cpp.spec"

# 2. Ecosistema Astal (Ordine Rigido di Dipendenza)
ASTAL_PKGS="appmenu-glib-translator astal-io astal astal-libs astal-gjs astal-gtk4 astal-lua aylurs-gtk-shell2"
for pkg in $ASTAL_PKGS; do
    build_and_install "specs/ermete-astal/$pkg/$pkg.spec"
done

# 3. Matugen
build_and_install "specs/ermete-matugen/ermete-matugen.spec"

echo "=================================================="
echo "🎯 TUTTI I PACCHETTI COMPILATI CON SUCCESSO! 🎯"
echo "=================================================="
