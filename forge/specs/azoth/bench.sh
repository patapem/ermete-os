#!/usr/bin/env bash
# Trend benchmark of the kernel (docs/architecture/doc_kernel_build.md, section 7, gate 5;
# phase K7). Boots the kernel-core in QEMU/KVM with a test initramfs that carries
# hackbench, schbench, fio and netperf (bench/init runs them in sequence and prints one
# `K7 <metric> <value> <unit>` line for each), then collects the lines into
# OUT/results.json and OUT/summary.md. Runs in the boot/Containerfile image and needs
# /dev/kvm: with TCG the numbers would measure the emulator. Not a gate: it is the number
# that decided -O2 and decides every future option, compared across weeks
# (bench-report.py) or between two kernels in the same run (--label).
#
# Usage: bench.sh --rpms DIR --out DIR [--label NAME] [--seconds N] [--cpus N] [--mem MiB]
#                 [--accel kvm|tcg]
#   --rpms     directory holding kernel-core-*.rpm
#   --out      results.json, summary.md, serial log
#   --label    name of the kernel in the result (default: the kver)
#   --seconds  duration of each test (default 30: five tests, under five minutes)
#   --accel    kvm (default) or tcg: only to exercise the initramfs, the numbers are void
set -euo pipefail

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RPMS='' OUT='' LABEL='' SECONDS_PER_TEST=30 CPUS=4 MEM=4096 ACCEL=kvm
while [[ $# -gt 0 ]]; do
  case $1 in
    --rpms) RPMS=$2; shift 2 ;;
    --out) OUT=$2; shift 2 ;;
    --label) LABEL=$2; shift 2 ;;
    --seconds) SECONDS_PER_TEST=$2; shift 2 ;;
    --cpus) CPUS=$2; shift 2 ;;
    --mem) MEM=$2; shift 2 ;;
    --accel) ACCEL=$2; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ $RPMS && $OUT ]] || { echo "usage: bench.sh --rpms DIR --out DIR [--label NAME] [--seconds N] [--cpus N] [--mem MiB] [--accel kvm|tcg]" >&2; exit 2; }
[[ $ACCEL == kvm && ! -w /dev/kvm ]] && { echo "/dev/kvm not accessible: without KVM the benchmark measures the emulator (--accel tcg only to exercise it)" >&2; exit 2; }
CPU=host; [[ $ACCEL == tcg ]] && CPU=max

die() { echo "error: $*" >&2; exit 1; }
step() { echo; echo "== $*"; }

mapfile -t CORE < <(find "$RPMS" -name 'kernel-core-*.rpm')
[[ ${#CORE[@]} -eq 1 ]] || die "expected exactly one kernel-core-*.rpm in $RPMS, found ${#CORE[@]}"
KVER=$(rpm -qp --qf '%{VERSION}-%{RELEASE}.%{ARCH}' "${CORE[0]}")
LABEL=${LABEL:-$KVER}
WORK=$(mktemp -d)
mkdir -p "$OUT"

step "kernel $KVER from ${CORE[0]##*/}"
mkdir -p "$WORK/rpm" && (cd "$WORK/rpm" && rpm2cpio "${CORE[0]}" | cpio -idm --quiet "./lib/modules/$KVER/vmlinuz")
VMLINUZ="$WORK/rpm/lib/modules/$KVER/vmlinuz"
[[ -s $VMLINUZ ]] || die "vmlinuz missing from the kernel-core"

step "initramfs with the tools"
R="$WORK/initramfs"
mkdir -p "$R"/{bin,dev,proc,sys,tmp,usr/bin}
install -m 755 /usr/sbin/busybox "$R/bin/busybox"
for applet in $(/usr/sbin/busybox --list); do ln -s busybox "$R/bin/$applet"; done
# The executables with their libraries in /lib64 (the guest has no ld.so.cache).
for tool in hackbench schbench fio netperf netserver; do
  path=$(command -v "$tool") || die "$tool not found in the image"
  install -m 755 "$path" "$R/usr/bin/$tool"
  ldd "$path" | awk '/=> \//{print $3} /^\s*\/lib64\/ld-linux/{print $1}' \
    | while read -r lib; do [[ -e "$R/lib64/${lib##*/}" ]] || install -D "$lib" "$R/lib64/${lib##*/}"; done
done
install -m 755 "$HERE/bench/init" "$R/init"
(cd "$R" && find . | cpio -o -H newc --quiet | zstd -q -T0 -19 -o "$WORK/initramfs.img")

step "QEMU ($ACCEL): $CPUS vCPU, $MEM MiB, $SECONDS_PER_TEST s per test"
LOG="$OUT/serial.log"
timeout $(( SECONDS_PER_TEST * 8 + 300 )) qemu-system-x86_64 -machine q35 -accel "$ACCEL" -cpu "$CPU" -smp "$CPUS" -m "$MEM" \
  -display none -monitor none -serial "file:$LOG" -no-reboot -device virtio-rng-pci \
  -kernel "$VMLINUZ" -initrd "$WORK/initramfs.img" \
  -append "console=ttyS0,115200 panic=-1 quiet k7.seconds=$SECONDS_PER_TEST" || echo "qemu: exit $?"
grep -q '^K7 RESULT ok' "$LOG" || { grep -E '^K7 ' "$LOG" || tail -n 30 "$LOG"; die "the benchmark did not end with K7 RESULT ok"; }

step "results"
host_cpu=$(awk -F': ' '/^model name/ { print $2; exit }' /proc/cpuinfo)
python3 - "$LOG" "$OUT/results.json" "$LABEL" "$KVER" "$host_cpu" "$CPUS" "$MEM" "$SECONDS_PER_TEST" <<'PY'
import json, re, sys, datetime
log, out, label, kver, cpu, cpus, mem, seconds = sys.argv[1:]
metrics, failed = {}, []
for line in open(log, errors="replace"):
    m = re.match(r"^K7 (\S+) (.+) (\S+)$", line.strip())
    if not m or m.group(1) in ("START", "RESULT"):
        continue
    try:
        value = float(m.group(2))
    except ValueError:
        value = float("nan")
    if value != value:  # nan: the test produced no number (the text is in the serial log)
        failed.append(m.group(1))
    else:
        metrics[m.group(1)] = {"value": value, "unit": m.group(3)}
result = {"label": label, "kver": kver, "date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
          "host_cpu": cpu, "vcpus": int(cpus), "mem_mib": int(mem), "seconds_per_test": int(seconds), "metrics": metrics}
json.dump(result, open(out, "w"), indent=2)
lines = [f"## Benchmark {label} ({kver})", "", f"QEMU/KVM {cpus} vCPU, {mem} MiB, {seconds} s per test, host `{cpu}`", "",
         "| metric | value | unit |", "| --- | --- | --- |"]
lines += [f"| {k} | {v['value']:g} | {v['unit']} |" for k, v in metrics.items()]
lines += [f"| {k} | n/a | |" for k in failed]
open(out.replace("results.json", "summary.md"), "w").write("\n".join(lines) + "\n")
print("\n".join(lines))
if failed:
    sys.exit("tests without a number: " + ", ".join(failed))
PY
