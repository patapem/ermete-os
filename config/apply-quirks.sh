#!/bin/bash
PKG=$1
BASE_DIR="$(dirname "$0")/.."
echo "--- Applicazione Quirks per $PKG ---"

# Disabilitazione Globale LTO / MOLD per pacchetti non compatibili
case "$PKG" in
    mesa-dri-drivers|mesa-vulkan-drivers|qemu-kvm|libvirt|sysstat|x264-libs|nodejs|npm|bpftool)
        echo "Disattivazione totale LTO e MOLD per $PKG (Rust/C/C++ Ribelle)..."
        # 1. Rimuovi LTO da C/C++
        sed -i '/%_lto_cflags/d' ~/.rpmmacros
        echo '%_lto_cflags %{nil}' >> ~/.rpmmacros
        sed -i 's/-flto=auto//g' ~/.rpmmacros
        sed -i 's/-fuse-ld=mold//g' ~/.rpmmacros
        
        # 2. Rimuovi LTO e linker da Rust
        sed -i 's/-C lto=thin//g' ~/.rpmmacros
        sed -i 's/-C codegen-units=1//g' ~/.rpmmacros
        sed -i 's/-C link-arg=-fuse-ld=mold//g' ~/.rpmmacros
        
        # 3. Patch chirurgiche specifiche
        if [ "$PKG" == "libvirt" ]; then
            echo "%_without_wireshark 1" >> ~/.rpmmacros
        fi
        
        if [ "$PKG" == "bpftool" ]; then
            echo "Applicazione Quirk Chirurgico per BPFTOOL tramite patch..."
            echo "%_without_clang 1" >> ~/.rpmmacros
            cp "$BASE_DIR/specs/bpftool/bpftool-vprintk.patch" ~/rpmbuild/SOURCES/
            echo "%__spec_prep_post %{___build_post} \\" >> ~/.rpmmacros
            echo "patch -p0 < %{_sourcedir}/bpftool-vprintk.patch" >> ~/.rpmmacros
        fi
        ;;
    bat)
        # Bat is now statically built via ermete-bat spec, no quirks needed here.
        echo "Nessun quirk dinamico necessario per BAT, usa spec canonico in ermete-bat."
        ;;
    *)
        echo "Nessun quirk necessario per $PKG."
        ;;
esac
