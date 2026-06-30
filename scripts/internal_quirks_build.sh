#!/bin/bash
set -e

echo "================================================================"
echo " INIZIALIZZAZIONE AMBIENTE CONTAINER UNICO PER QUIRKS"
echo "================================================================"
dnf install -y rpm-build dnf-plugins-core rpmdevtools
rpmdev-setuptree

echo "================================================================"
echo " PREPARAZIONE REPOSITORIES (RPMFusion) "
echo "================================================================"
dnf install -y https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-43.noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-43.noarch.rpm || true

mkdir -p /work/output
echo "" > /work/output/build_quirks_results.txt

PACKAGES="libvirt bpftool"

for PKG in $PACKAGES; do
    echo "================================================================"
    echo ">>> TEST COMPILAZIONE CON QUIRKS: $PKG"
    echo "================================================================"
    
    # Ripristina sempre la macro pulita e applica le cure per il pacchetto corrente
    cp /work/config/rpmmacros ~/.rpmmacros
    bash /work/config/apply-quirks.sh "$PKG"
    
    cd ~/rpmbuild/SRPMS
    rm -f *.src.rpm
    rm -f ~/rpmbuild/SPECS/*
    
    # Per FFMPEG abilitiamo i sorgenti di RPMFusion
    dnf config-manager --set-enabled rpmfusion-free-source rpmfusion-nonfree-source || true
    
    if ! dnf download --source "$PKG"; then
        echo "!!! ERRORE DOWNLOAD SORGENTE: $PKG !!!"
        echo "[FAILED DOWNLOAD] $PKG" >> /work/output/build_quirks_results.txt
        continue
    fi
    
    # BEDROCK FIX: DNF5 ha un bug su Fedora 43 con le dipendenze dinamiche degli SRPM.
    # Dobbiamo prima estrarre il .spec e far leggere a dnf il file spec vero e proprio!
    rpm -ivh *.src.rpm || true
    
    if ! dnf builddep -y ~/rpmbuild/SPECS/*.spec; then
        echo "!!! ERRORE RISOLUZIONE DIPENDENZE: $PKG !!!"
        echo "[FAILED BUILDDEP] $PKG" >> /work/output/build_quirks_results.txt
        continue
    fi
    
    # BEDROCK HACK per README rust mancanti
    find /usr/share/cargo/registry/ -maxdepth 1 -mindepth 1 -type d -exec touch {}/README.md \; || true
    
    # BEDROCK HACK: Rimozione --locked per compatibilità RPM Rust
    sed -i 's/--locked//g' /usr/lib/rpm/macros.d/macros.cargo || true

    if ! rpmbuild --rebuild --nocheck *.src.rpm; then
        if ls ~/rpmbuild/SRPMS/*.buildreqs.nosrc.rpm >/dev/null 2>&1; then
            echo "--- Installazione Dipendenze Dinamiche (%generate_buildrequires) ---"
            dnf install -y ~/rpmbuild/SRPMS/*.buildreqs.nosrc.rpm
            echo "--- Secondo tentativo di Ricompilazione Estrema ---"
            if rpmbuild --rebuild --nocheck *.src.rpm; then
                echo ">>> SUCCESSO (al 2^ tentativo): $PKG"
                echo "[OK] $PKG" >> /work/output/build_quirks_results.txt
                rm -rf ~/rpmbuild/BUILD/*
                rm -rf ~/rpmbuild/RPMS/*
                rm -rf ~/rpmbuild/SPECS/*
            else
                echo "!!! ERRORE NELLA BUILD DI $PKG !!!"
                echo "[FAILED BUILD] $PKG" >> /work/output/build_quirks_results.txt
            fi
        else
            echo "!!! ERRORE NELLA BUILD DI $PKG !!!"
            echo "[FAILED BUILD] $PKG" >> /work/output/build_quirks_results.txt
        fi
    else
        echo ">>> SUCCESSO: $PKG"
        echo "[OK] $PKG" >> /work/output/build_quirks_results.txt
        rm -rf ~/rpmbuild/BUILD/*
        rm -rf ~/rpmbuild/RPMS/*
        rm -rf ~/rpmbuild/SPECS/*
    fi
done

echo "================================================================"
echo " REPORT FINALE QUIRKS DRY-RUN: "
cat /work/output/build_quirks_results.txt
echo "================================================================"
