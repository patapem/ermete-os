#!/bin/bash
set -e

echo "==================================================="
echo " ERMETE FORGE - LOCAL MASSIVE BUILD SCRIPT"
echo "==================================================="

# Inizializza ambiente RPM e copia le macro estreme
sudo dnf install -y rpm-build dnf-plugins-core rpmdevtools spectool
cp config/rpmmacros ~/.rpmmacros
rpmdev-setuptree

# Lista dei pacchetti da buildare.
# L'ordine è critico per Astal a causa del suo DAG di dipendenze.
SPECS=(
  "specs/ermete-selinux/ermete-selinux.spec"
  "specs/ermete-starship/ermete-starship.spec"
  "specs/ermete-matugen/ermete-matugen.spec"
  "specs/ermete-bibata/ermete-bibata.spec"
  "specs/ermete-ananicy/ananicy-cpp.spec"
  "specs/ermete-base-config/ermete-base-config.spec"
  "specs/ermete-bat/bat.spec"
  "specs/ermete-ags-config/ermete-ags-config.spec"
  "specs/ermete-niri-session/ermete-niri-session.spec"
  "specs/ermete-ide-bootstrap/ermete-ide-bootstrap.spec"
  "specs/ermete-system-services/ermete-system-services.spec"
  "specs/ermete-nix-support/ermete-nix-support.spec"
  "specs/ermete-system-config/ermete-system-config.spec"
  "specs/ermete-system-tweaks/ermete-system-tweaks.spec"
  # ASTAL DAG (Strict Order)
  "specs/ermete-astal/appmenu-glib-translator/appmenu-glib-translator.spec"
  "specs/ermete-astal/astal-io/astal-io.spec"
  "specs/ermete-astal/astal/astal.spec"
  "specs/ermete-astal/astal-libs/astal-libs.spec"
  "specs/ermete-astal/astal-gjs/astal-gjs.spec"
  "specs/ermete-astal/astal-gtk4/astal-gtk4.spec"
  "specs/ermete-astal/astal-lua/astal-lua.spec"
  "specs/ermete-astal/aylurs-gtk-shell2/aylurs-gtk-shell2.spec"
  "specs/ermete-astal/hyprpanel/hyprpanel.spec"
)

mkdir -p RPMS_OUT/custom

for spec in "${SPECS[@]}"; do
  echo "---------------------------------------------------"
  echo ">>> Costruzione di $spec"
  echo "---------------------------------------------------"
  
  # Scarica i sorgenti
  spectool -g -R "$spec"
  
  # Installa le dipendenze di build
  sudo dnf builddep -y "$spec"
  
  # Compila il pacchetto applicando le global rpmmacros
  rpmbuild -bb --nocheck "$spec"
  
  # Per soddisfare le dipendenze locali (ad es. di Astal),
  # installiamo immediatamente l'RPM appena generato nell'ambiente locale.
  # Troviamo l'ultimo RPM generato per questo pacchetto.
  PKG_NAME=$(rpm -q --specfile "$spec" --queryformat '%{NAME}\n' | head -n 1)
  
  # Sposta e Installa
  find ~/rpmbuild/RPMS -name "${PKG_NAME}*.rpm" -exec cp {} RPMS_OUT/custom/ \;
  sudo dnf install -y ~/rpmbuild/RPMS/*/${PKG_NAME}*.rpm || true
done

echo "==================================================="
echo " TUTTI I PACCHETTI COMPILATI CON SUCCESSO!"
echo " Gli RPM finali ottimizzati si trovano in RPMS_OUT/custom/"
echo "==================================================="
