#!/usr/bin/env bash
# The NVR of the Athanor kernel derived from the pins: the same one rpmbuild produces
# with `%buildid .azoth` (build.sh) and that publish uses as the tag of the OCI images.
# Usage: nvr.sh [pins.env]
set -euo pipefail
# shellcheck source=pins.env
source "${1:-$(dirname "${BASH_SOURCE[0]}")/pins.env}"
rel=${FEDORA_KERNEL_NVR#*-}
echo "${FEDORA_KERNEL_NVR%%-*}-${rel%%.*}.azoth.${rel#*.}"
