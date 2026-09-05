#!/bin/sh
# ==============================================================================
# 🌋 Athanor OS - Initramfs Bootstrapper & PID 1 Transition Engine (Fase 14)
# ==============================================================================
# Executed as initial 'init' in initramfs.
# Responsible for:
#   1. Creating core mount point directories.
#   2. Mounting kernel pseudo-filesystems (/proc, /sys, /dev, and /run).
#   3. Executing a zero-overhead process takeover (`exec`) to hand control to
#      `/usr/bin/athanor-init-oracle` as the true system PID 1.
# ==============================================================================

set -u

echo "[Athanor OS Initramfs] Initializing Phase 14 early boot sequence..."

# 1. Ensure mount points exist
mkdir -p /proc /sys /dev /run /mnt /usr/bin /sbin /bin

# 2. Mount essential kernel pseudo-filesystems
if ! grep -qs '/proc ' /proc/mounts 2>/dev/null; then
    echo "[Athanor OS Initramfs] Mounting /proc (procfs)..."
    mount -t proc proc /proc || echo "[Athanor OS Initramfs] WARNING: Failed to mount /proc"
fi

if ! grep -qs '/sys ' /proc/mounts 2>/dev/null; then
    echo "[Athanor OS Initramfs] Mounting /sys (sysfs)..."
    mount -t sysfs sysfs /sys || echo "[Athanor OS Initramfs] WARNING: Failed to mount /sys"
fi

if ! grep -qs '/dev ' /proc/mounts 2>/dev/null; then
    echo "[Athanor OS Initramfs] Mounting /dev (devtmpfs)..."
    mount -t devtmpfs devtmpfs /dev 2>/dev/null || mount -t tmpfs dev /dev || echo "[Athanor OS Initramfs] WARNING: Failed to mount /dev"
fi

# Optional /run mount (tmpfs)
if ! grep -qs '/run ' /proc/mounts 2>/dev/null; then
    echo "[Athanor OS Initramfs] Mounting /run (tmpfs)..."
    mount -t tmpfs tmpfs /run || echo "[Athanor OS Initramfs] WARNING: Failed to mount /run"
fi

# Mount devpts if dev is mounted and devpts isn't
if [ -d /dev/pts ] && ! grep -qs '/dev/pts ' /proc/mounts 2>/dev/null; then
    mount -t devpts devpts /dev/pts 2>/dev/null || true
fi

echo "[Athanor OS Initramfs] Pseudo-filesystems mounted successfully."

# 3. Target init oracle binary path
ORACLE_BIN="/usr/bin/athanor-init-oracle"

if [ ! -x "$ORACLE_BIN" ]; then
    echo "[Athanor OS Initramfs] ERROR: Target binary '$ORACLE_BIN' not found or not executable!"
    # Search fallback paths if needed
    if [ -x "/bin/athanor-init-oracle" ]; then
        ORACLE_BIN="/bin/athanor-init-oracle"
    elif [ -x "/sbin/athanor-init-oracle" ]; then
        ORACLE_BIN="/sbin/athanor-init-oracle"
    fi
fi

if [ -x "$ORACLE_BIN" ]; then
    echo "[Athanor OS Initramfs] Handing over control to $ORACLE_BIN as PID 1..."
    exec "$ORACLE_BIN" "$@"
else
    echo "[Athanor OS Initramfs] CRITICAL: Could not execute $ORACLE_BIN. Dropping to emergency shell."
    exec /bin/sh
fi
