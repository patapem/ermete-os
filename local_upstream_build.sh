#!/bin/bash
set -e

echo "==================================================="
echo " ERMETE FORGE - LOCAL UPSTREAM MASSIVE BUILD"
echo "==================================================="

# Inizializza ambiente RPM e copia le macro estreme
sudo dnf install -y rpm-build dnf-plugins-core rpmdevtools jq
cp config/rpmmacros ~/.rpmmacros
rpmdev-setuptree

# File contenenti la lista dei pacchetti upstream
LISTS=("config/upstream_core.txt" "config/upstream_cli.txt" "config/upstream_desktop.txt" "config/upstream_media.txt")

for list in "${LISTS[@]}"; do
  if [ ! -f "$list" ]; then continue; fi
  echo ">>> Processando $list..."
  
  # Leggi pacchetti ignorando righe vuote e commenti
  PKGS=$(grep -v '^[[:space:]]*#' "$list" | grep -v '^[[:space:]]*$')
  
  for pkg in $PKGS; do
    echo "---------------------------------------------------"
    echo " Costruzione Upstream (LTO+Ponytail) per: $pkg"
    echo "---------------------------------------------------"
    
    cd ~/rpmbuild/SRPMS
    rm -f *.src.rpm
    
    # Download SRPM
    dnf download --source "$pkg"
    
    # Esegue lo script locale che estrae, applica Ponytail e compila!
    bash /var/home/ermete/GEMINI/ermete/ermete-forge/scripts/build_rolling_local.sh "$pkg"
    
    # Sposta in RPMS_OUT
    mkdir -p /var/home/ermete/GEMINI/ermete/ermete-forge/RPMS_OUT/upstream
    find ~/rpmbuild/RPMS -name "*.rpm" -exec cp {} /var/home/ermete/GEMINI/ermete/ermete-forge/RPMS_OUT/upstream/ \;
  done
done

echo "==================================================="
echo " TUTTI I PACCHETTI UPSTREAM COMPILATI CON SUCCESSO!"
echo " Gli RPM finali ottimizzati si trovano in RPMS_OUT/upstream/"
echo "==================================================="
