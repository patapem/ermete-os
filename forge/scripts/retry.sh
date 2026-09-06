#!/usr/bin/env bash
# Run a command up to three times, 15 s then 30 s apart, for operations whose
# failures are transient by nature: a registry push that the server aborts with a
# stalled chunked upload (run 34051055291, builder push, HTTP 400 after 16 minutes),
# a network read that drops. A command that fails three times in a row is a real
# error and the caller sees its exit status. Same policy as sign_attest.sh.
#
# Usage: retry.sh COMMAND [ARG...]
set -euo pipefail

[[ $# -ge 1 ]] || { echo "usage: retry.sh COMMAND [ARG...]" >&2; exit 2; }

attempt=1
until "$@"; do
  status=$?
  if [[ $attempt -ge 3 ]]; then
    echo "retry.sh: '$1' failed ${attempt} times, giving up (exit ${status})" >&2
    exit "$status"
  fi
  echo "retry.sh: '$1' failed (exit ${status}), attempt ${attempt} of 3: retrying in $((attempt * 15)) s" >&2
  sleep $((attempt * 15))
  attempt=$((attempt + 1))
done
