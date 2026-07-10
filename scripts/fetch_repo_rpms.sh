#!/bin/bash
set -euo pipefail

mkdir -p /github/home/repo
export STORAGE_DRIVER=vfs
export BUILDAH_ISOLATION=chroot

OWNER="${1}"

IMAGES=(
  "ermete-forge-kernel"
  "ermete-forge-nvidia"
  "ermete-forge-initramfs"
)

# Fetch package lists dynamically from Single Source of Truth
readarray -t CUSTOM_PKGS < <(jq -r '.custom_packages[]' config/packages.json)

readarray -t AGS_PKGS < <(jq -r '.ags_ecosystem[]' config/packages.json)
readarray -t UPSTREAM_CORE < <(jq -r '.upstream_core[]' config/packages.json)
readarray -t UPSTREAM_DESKTOP < <(jq -r '.upstream_desktop[]' config/packages.json)
readarray -t UPSTREAM_MEDIA < <(jq -r '.upstream_media[]' config/packages.json)
readarray -t UPSTREAM_CLI < <(jq -r '.upstream_cli[]' config/packages.json)

# Custom Packages
for pkg in "${CUSTOM_PKGS[@]}"; do
  IMAGES+=("ermete-forge-$pkg")
done



# AGS Ecosystem
for pkg in "${AGS_PKGS[@]}"; do
  IMAGES+=("ermete-forge-$pkg")
done

# Upstream Packages
for pkg in "${UPSTREAM_CORE[@]}" "${UPSTREAM_DESKTOP[@]}" "${UPSTREAM_MEDIA[@]}" "${UPSTREAM_CLI[@]}"; do
  IMAGES+=("ermete-forge-rolling-$pkg")
done

echo "Pulling RPMs from ${#IMAGES[@]} containers..."

for img in "${IMAGES[@]}"; do
  IMAGE_LOWER=$(echo "ghcr.io/$OWNER/$img:latest" | tr '[:upper:]' '[:lower:]')
  echo ">>> Pulling $IMAGE_LOWER"
  
  # Best effort: se un container manca (es. build fallita), lo skippiamo
  ctr=$(buildah from "$IMAGE_LOWER" || true)
  if [ -n "$ctr" ]; then
    mnt=$(buildah mount $ctr)
    # Copia gli rpm
    cp -a $mnt/*.rpm /github/home/repo/ 2>/dev/null || true
    buildah umount $ctr
    buildah rm $ctr
  else
    echo "    [!] Immagine non trovata o scaricamento fallito per $img"
  fi
done

echo "--- Extracted RPMs ---"
ls -lh /github/home/repo/
