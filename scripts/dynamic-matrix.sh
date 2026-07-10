#!/bin/bash
set -euo pipefail

REGISTRY="ghcr.io"
OWNER="${GITHUB_REPOSITORY_OWNER:-patapem}"

# Fetch arrays dynamically from Single Source of Truth
readarray -t CUSTOM_PKGS < <(jq -r '.custom_packages[]' config/packages.json)
readarray -t CACHYOS_PKGS < <(jq -r '.cachyos_addons[]' config/packages.json)
readarray -t AGS_PKGS < <(jq -r '.ags_ecosystem[]' config/packages.json)
readarray -t UPSTREAM_CORE < <(jq -r '.upstream_core[]' config/packages.json)
readarray -t UPSTREAM_DESKTOP < <(jq -r '.upstream_desktop[]' config/packages.json)
readarray -t UPSTREAM_MEDIA < <(jq -r '.upstream_media[]' config/packages.json)
readarray -t UPSTREAM_CLI < <(jq -r '.upstream_cli[]' config/packages.json)

if ! command -v skopeo >/dev/null 2>&1; then
  sudo apt-get update && sudo apt-get install -y skopeo
fi

process_array() {
  local prefix=$1
  shift
  local pkgs=("$@")
  
  local active_pkgs=()
  
  for pkg in "${pkgs[@]}"; do
    pkg=$(echo "$pkg" | tr -d ',')
    [[ -z "$pkg" ]] && continue
    
    # Compute hash dynamically (simulate ags logic for ags ecosystem)
    if [[ "$prefix" == "ags-" ]]; then
      local dir="specs/ermete-astal/${pkg}"
      if [[ -d "$dir" ]]; then
        local content_hash=$({
          find "$dir" -type f -name "*.spec" | sort | while read -r f; do
            cat "$f"
          done
          if [[ -f "config/rpmmacros" ]]; then
            cat "config/rpmmacros"
          fi
        } | sha256sum | awk '{print $1}')
      else
        local content_hash="000"
      fi
      local image_name="ermete-forge-${pkg}"
      local out
      if skopeo inspect "docker://${REGISTRY}/${OWNER}/${image_name}:${content_hash}" >/dev/null 2>&1; then
        out="CACHE_HIT=true"
      else
        out="CACHE_HIT=false"
      fi
    else
      local image_name="ermete-forge-${prefix}${pkg}"
      local out
      out=$(bash scripts/check_idempotency.sh --package "$pkg" --registry "$REGISTRY" --owner "$OWNER" --image-name "$image_name" 2>/dev/null)
    fi
    
    if echo "$out" | grep -q "CACHE_HIT=false"; then
      active_pkgs+=("\"$pkg\"")
      echo "  -> MISS (will build: $pkg)" >&2
    else
      echo "  -> HIT (skip: $pkg)" >&2
    fi
  done
  
  local json="[$(IFS=,; echo "${active_pkgs[*]}")]"
  echo "$json"
}

echo "Evaluating custom_packages..." >&2
J_CUSTOM=$(process_array "" "${CUSTOM_PKGS[@]}")

echo "Evaluating cachyos_addons..." >&2
J_CACHY=$(process_array "" "${CACHYOS_PKGS[@]}")

echo "Evaluating ags_ecosystem..." >&2
J_AGS=$(process_array "ags-" "${AGS_PKGS[@]}")

echo "Evaluating upstream_core..." >&2
J_U_CORE=$(process_array "rolling-" "${UPSTREAM_CORE[@]}")

echo "Evaluating upstream_desktop..." >&2
J_U_DESK=$(process_array "rolling-" "${UPSTREAM_DESKTOP[@]}")

echo "Evaluating upstream_media..." >&2
J_U_MEDIA=$(process_array "rolling-" "${UPSTREAM_MEDIA[@]}")

echo "Evaluating upstream_cli..." >&2
J_U_CLI=$(process_array "rolling-" "${UPSTREAM_CLI[@]}")

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "custom_packages=${J_CUSTOM}" >> "$GITHUB_OUTPUT"
  echo "cachyos_addons=${J_CACHY}" >> "$GITHUB_OUTPUT"
  echo "ags_ecosystem=${J_AGS}" >> "$GITHUB_OUTPUT"
  echo "upstream_core=${J_U_CORE}" >> "$GITHUB_OUTPUT"
  echo "upstream_desktop=${J_U_DESK}" >> "$GITHUB_OUTPUT"
  echo "upstream_media=${J_U_MEDIA}" >> "$GITHUB_OUTPUT"
  echo "upstream_cli=${J_U_CLI}" >> "$GITHUB_OUTPUT"
fi

echo "JSON Outputs:"
echo "custom_packages=${J_CUSTOM}"
echo "cachyos_addons=${J_CACHY}"
echo "ags_ecosystem=${J_AGS}"
echo "upstream_core=${J_U_CORE}"
echo "upstream_desktop=${J_U_DESK}"
echo "upstream_media=${J_U_MEDIA}"
echo "upstream_cli=${J_U_CLI}"
