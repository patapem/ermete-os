#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Uso: $0 <nome-pacchetto>"
    echo "Esempio: $0 niri"
    exit 1
fi

PACKAGE=$1

echo "========================================"
echo "=== INIZIALIZZAZIONE AMBIENTE BEDROCK =="
echo "========================================"
dnf install -y rpm-build dnf-plugins-core rpmdevtools
cp config/rpmmacros ~/.rpmmacros
rpmdev-setuptree

echo "========================================"
echo "=== PREPARAZIONE REPOSITORIES (RPMFusion) ==="
echo "========================================"
dnf install -y https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-43.noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-43.noarch.rpm || true

echo "========================================"
echo "=== DOWNLOAD SORGENTI ==="
echo "========================================"
cd ~/rpmbuild/SRPMS
dnf download --source $PACKAGE

echo "========================================"
echo "=== INSTALLAZIONE DIPENDENZE E FIX ==="
echo "========================================"
dnf builddep -y *.src.rpm

# BEDROCK HACK: Fedora spesso omette i README.md nei pacchetti rust-*-devel per risparmiare spazio,
# ma alcuni crate usano include_str!("../README.md") che causa il fallimento della build.
# Creiamo file README.md vuoti per tutti i crate estratti.
find /usr/share/cargo/registry/ -maxdepth 1 -mindepth 1 -type d -exec touch {}/README.md \;

echo "========================================"
echo "=== COMPILAZIONE ESTREMA (ROLLING) ==="
echo "========================================"
rpmbuild --rebuild *.src.rpm

echo "=================================================="
echo "🎯 PACCHETTO ROLLING '$PACKAGE' COMPILATO CON SUCCESSO! 🎯"
echo "I file RPM generati si trovano in ~/rpmbuild/RPMS/"
find ~/rpmbuild/RPMS -name "*.rpm"

# Esportazione sulla macchina Host (se /work è montato)
if [ -d "/work" ]; then
    mkdir -p /work/output/$PACKAGE
    cp ~/rpmbuild/RPMS/*/*.rpm /work/output/$PACKAGE/
    echo "RPMs esportati in /work/output/$PACKAGE/"
fi
echo "=================================================="
