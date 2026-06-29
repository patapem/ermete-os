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
echo "=== DOWNLOAD SRPM PER: $PACKAGE ==="
echo "========================================"
cd ~/rpmbuild/SRPMS
dnf download --source $PACKAGE

echo "========================================"
echo "=== INSTALLAZIONE DIPENDENZE ==="
echo "========================================"
dnf builddep -y *.src.rpm

echo "========================================"
echo "=== COMPILAZIONE ESTREMA (ROLLING) ==="
echo "========================================"
rpmbuild --rebuild *.src.rpm

echo "=================================================="
echo "🎯 PACCHETTO ROLLING '$PACKAGE' COMPILATO CON SUCCESSO! 🎯"
echo "I file RPM generati si trovano in ~/rpmbuild/RPMS/"
find ~/rpmbuild/RPMS -name "*.rpm"
echo "=================================================="
