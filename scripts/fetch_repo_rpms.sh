#!/bin/bash
set -euo pipefail

mkdir -p /github/home/repo \
         /github/home/repo-tier0 \
         /github/home/repo-tier1 \
         /github/home/repo-tier2 \
         /github/home/repo-tier3

export STORAGE_DRIVER=vfs
export BUILDAH_ISOLATION=chroot

OWNER="${1:-patapem}"

# Fetch package lists dynamically from Single Source of Truth
readarray -t UPSTREAM_CORE < <(jq -r '.upstream_core[]' config/packages.json)
readarray -t UPSTREAM_DESKTOP < <(jq -r '.upstream_desktop[]' config/packages.json)
readarray -t UPSTREAM_MEDIA < <(jq -r '.upstream_media[]' config/packages.json)
readarray -t UPSTREAM_CLI < <(jq -r '.upstream_cli[]' config/packages.json)

# Define per-Tier micro-container images
TIER0_IMAGES=(
  "ermete-forge-kernel"
  "ermete-forge-nvidia"
  "ermete-forge-initramfs"
  "ermete-forge-base-config"
  "ermete-forge-selinux"
  "ermete-forge-nix-support"
)
for pkg in "${UPSTREAM_CORE[@]}" "${UPSTREAM_MEDIA[@]}"; do
  [[ -n "$pkg" ]] && TIER0_IMAGES+=("ermete-forge-rolling-$pkg")
done

TIER1_IMAGES=(
  "ermete-forge-starship"
  "ermete-forge-bat"
  "ermete-forge-ananicy"
  "ermete-forge-cliphist"
  "ermete-forge-ide-bootstrap"
  "ermete-forge-system-tweaks"
)
for pkg in "${UPSTREAM_DESKTOP[@]}" "${UPSTREAM_CLI[@]}"; do
  [[ -n "$pkg" ]] && TIER1_IMAGES+=("ermete-forge-rolling-$pkg")
done

TIER2_IMAGES=(
  "ermete-forge-bibata"
  "ermete-forge-matugen"
  "ermete-forge-dart-sass"
)

TIER3_IMAGES=(
  "ermete-forge-shell-rs"
  "ermete-forge-settings-rs"
  "ermete-forge-daemon-rs"
  "ermete-forge-store-rs"
  "ermete-forge-doctor"
  "ermete-forge-system-services"
  "ermete-forge-desktop-ui"
  "ermete-forge-system-config"
)

pull_and_extract() {
  local img="$1"
  local target_dir="$2"
  local IMAGE_LOWER=$(echo "ghcr.io/$OWNER/$img:latest" | tr '[:upper:]' '[:lower:]')
  echo ">>> Pulling $IMAGE_LOWER into $target_dir"
  
  # Best effort: se un container manca (es. build fallita), lo skippiamo
  local ctr
  ctr=$(buildah from "$IMAGE_LOWER" || true)
  if [ -n "$ctr" ]; then
    local mnt
    mnt=$(buildah mount "$ctr")
    cp -a "$mnt"/*.rpm "$target_dir/" 2>/dev/null || true
    cp -a "$mnt"/*.rpm "/github/home/repo/" 2>/dev/null || true
    buildah umount "$ctr"
    buildah rm "$ctr"
  else
    echo "    [!] Immagine non trovata o scaricamento fallito per $img"
  fi
}

echo "=== Extracting Tier 0 RPMs ==="
for img in "${TIER0_IMAGES[@]}"; do
  pull_and_extract "$img" "/github/home/repo-tier0"
done

echo "=== Extracting Tier 1 RPMs ==="
for img in "${TIER1_IMAGES[@]}"; do
  pull_and_extract "$img" "/github/home/repo-tier1"
done

echo "=== Extracting Tier 2 RPMs ==="
for img in "${TIER2_IMAGES[@]}"; do
  pull_and_extract "$img" "/github/home/repo-tier2"
done

echo "=== Extracting Tier 3 RPMs ==="
for img in "${TIER3_IMAGES[@]}"; do
  pull_and_extract "$img" "/github/home/repo-tier3"
done

echo "--- Extracted RPMs Summary ---"
echo "Tier 0 count: $(ls -1 /github/home/repo-tier0/*.rpm 2>/dev/null | wc -l || echo 0)"
echo "Tier 1 count: $(ls -1 /github/home/repo-tier1/*.rpm 2>/dev/null | wc -l || echo 0)"
echo "Tier 2 count: $(ls -1 /github/home/repo-tier2/*.rpm 2>/dev/null | wc -l || echo 0)"
echo "Tier 3 count: $(ls -1 /github/home/repo-tier3/*.rpm 2>/dev/null | wc -l || echo 0)"
echo "Total repo count: $(ls -1 /github/home/repo/*.rpm 2>/dev/null | wc -l || echo 0)"
