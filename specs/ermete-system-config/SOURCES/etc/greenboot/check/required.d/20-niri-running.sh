#!/bin/bash
set -e

if pgrep -x "niri" > /dev/null || { shopt -s nullglob; socks=(/run/user/*/wayland-*); [ ${#socks[@]} -gt 0 ]; }; then
    echo "Greenboot check: niri or Wayland socket found."
    exit 0
else
    echo "Greenboot check: niri is NOT running."
    exit 1
fi
