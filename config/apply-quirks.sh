#!/bin/bash
PKG=$1
echo "--- Applicazione Quirks per $PKG ---"

# Disabilitazione Globale LTO / MOLD per pacchetti non compatibili
case "$PKG" in
    mesa-dri-drivers|mesa-vulkan-drivers|qemu-kvm|libvirt|sysstat|x264-libs|nodejs|npm|bpftool|nushell|bat)
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
            echo "%__spec_prep_post %{___build_post}" >> ~/.rpmmacros
            echo "find . -type f -name bpf_helpers.h -exec sed -i 's/bpf_stream_vprintk(int stream_id, const char \\\\*fmt__str, const void \\\\*args,/bpf_stream_vprintk(int stream_id, const char \\\\*fmt__str, const void \\\\*args, u32 len__sz,/g' {} \\; || true" >> ~/.rpmmacros
        fi
        ;;
    *)
        echo "Nessun quirk necessario per $PKG."
        ;;
esac
