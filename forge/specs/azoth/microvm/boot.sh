#!/usr/bin/env bash
# Gate of the guest kernel (docs/architecture/doc_kernel_build.md, section 9 and phase K6):
# the vmlinux of the azoth-microvm package boots in Firecracker with a test rootfs (ext4
# with busybox and microvm/init) and ends with `K6 RESULT ok` on the serial console, after
# the assertions of init (uname, root on virtio-blk, BTF, file systems, dm-verity, no
# modules, kCFI, clean dmesg). Runs in the boot/Containerfile image and needs /dev/kvm:
# Firecracker has no emulated mode.
#
# Usage: microvm/boot.sh --rpms DIR --out DIR
#   --rpms  directory to search for azoth-microvm-*.rpm (the out of build.sh)
#   --out   serial log and summary
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RPMS='' OUT=''
while [[ $# -gt 0 ]]; do
  case $1 in
    --rpms) RPMS=$2; shift 2 ;;
    --out) OUT=$2; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ $RPMS && $OUT ]] || { echo "usage: microvm/boot.sh --rpms DIR --out DIR" >&2; exit 2; }
[[ -w /dev/kvm ]] || { echo "/dev/kvm not accessible: Firecracker has KVM only" >&2; exit 2; }

die() { echo "error: $*" >&2; exit 1; }
step() { echo; echo "== $*"; }

mapfile -t RPM < <(find "$RPMS" -name 'azoth-microvm-*.rpm')
[[ ${#RPM[@]} -eq 1 ]] || die "expected exactly one azoth-microvm-*.rpm in $RPMS, found ${#RPM[@]}"
WORK=$(mktemp -d)
mkdir -p "$OUT"

step "vmlinux from ${RPM[0]##*/}"
(cd "$WORK" && rpm2cpio "${RPM[0]}" | cpio -idm --quiet)
DIR=$WORK/usr/lib/athanor/microvm
[[ -s $DIR/vmlinux && -s $DIR/release ]] || die "vmlinux or release missing from the package"
RELEASE=$(< "$DIR/release")
echo "kernel $RELEASE, vmlinux $(du -h "$DIR/vmlinux" | cut -f1), bzImage $(du -h "$DIR/bzImage" | cut -f1)"

step "test rootfs (ext4, busybox, microvm/init)"
R=$WORK/rootfs
mkdir -p "$R"/{bin,dev,proc,sys,tmp}
install -m 755 /usr/sbin/busybox "$R/bin/busybox"
for applet in $(/usr/sbin/busybox --list); do ln -s busybox "$R/bin/$applet"; done
install -m 755 "$HERE/init" "$R/init"
truncate -s 64M "$WORK/rootfs.ext4"
mkfs.ext4 -q -F -d "$R" "$WORK/rootfs.ext4"

step "Firecracker ($(firecracker --version | head -n 1))"
# Command line as Firecracker documents it: serial as console, reboot via i8042 (that is
# how the guest makes Firecracker exit), no PCI, root on virtio-blk.
cat > "$WORK/vm.json" <<JSON
{
  "boot-source": {
    "kernel_image_path": "$DIR/vmlinux",
    "boot_args": "console=ttyS0 reboot=k panic=1 pci=off root=/dev/vda rw init=/init k6.release=$RELEASE"
  },
  "drives": [
    { "drive_id": "rootfs", "path_on_host": "$WORK/rootfs.ext4", "is_root_device": true, "is_read_only": false }
  ],
  "machine-config": { "vcpu_count": 2, "mem_size_mib": 512 }
}
JSON
LOG=$OUT/firecracker.log
timeout 180 firecracker --no-api --config-file "$WORK/vm.json" > "$LOG" 2>&1 || echo "firecracker: exit $?"

{
  echo "## MicroVM $RELEASE in Firecracker"; echo; echo "| case | result |"; echo "| --- | --- |"
  if grep -q '^K6 RESULT ok' "$LOG"; then echo "| firecracker | ok |"; else echo "| firecracker | FAIL |"; fi
} > "$OUT/summary.md"
step "summary"; cat "$OUT/summary.md"
grep -q '^K6 RESULT ok' "$LOG" || { grep -E '^K6 (FAIL|RESULT)' "$LOG" || tail -n 30 "$LOG"; die "the guest kernel did not end with K6 RESULT ok"; }
