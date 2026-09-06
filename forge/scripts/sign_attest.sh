#!/usr/bin/env bash
# Keyless signature and SPDX attestation of an OCI image with cosign, with bounded
# retries. Every attempt is a round trip to Fulcio, Rekor and the timestamp authority:
# public services whose transient failures (a dropped TCP read, as in runs 34033820792
# selinux and openssl-native) must not fail a package build that is otherwise complete.
# A signature that fails three times in a row is a real error and stops the job.
# cosign must be on PATH (the DAG jobs run this under `nix shell nixpkgs#cosign -c`),
# and the registry login is the caller's business.
#
# Usage: sign_attest.sh IMAGE SBOM.spdx.json
set -euo pipefail

[[ $# -eq 2 ]] || { echo "usage: sign_attest.sh IMAGE SBOM.spdx.json" >&2; exit 2; }
image=$1 sbom=$2
[[ -s $sbom ]] || { echo "SBOM missing or empty: $sbom" >&2; exit 2; }

retry() { # retry COMMAND...: three attempts, 15 s then 30 s apart
  local attempt
  for attempt in 1 2 3; do
    if "$@"; then return 0; fi
    [[ $attempt -lt 3 ]] || return 1
    echo "attempt $attempt failed: retrying in $((attempt * 15)) s" >&2
    sleep $((attempt * 15))
  done
}

retry cosign sign --yes "$image"
retry cosign attest --yes --type spdxjson --predicate "$sbom" "$image"
