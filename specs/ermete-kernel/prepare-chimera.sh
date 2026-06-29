#!/bin/bash
# Ermete OS: The Ultimate Chimera Kernel Bedrock Builder

set -e

WORKSPACE_DIR="$HOME/rpmbuild"
mkdir -p "$WORKSPACE_DIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
cd "$WORKSPACE_DIR"

echo "========================================================="
echo " FASE 1: LE FONDAMENTA (Fedora Upstream Zero-Trust)"
echo "========================================================="
# [BEST PRACTICE] Lavoriamo con il kernel.spec nativo al 100%, ZERO comandi "sed".
echo ">>> Scaricamento kernel.src.rpm puro..."
dnf download --source kernel
rpm -ivh kernel-*.src.rpm
KERNEL_SRPM=$(ls kernel-*.src.rpm | head -n 1)
KERNEL_VER=$(rpm -qp --qf '%{VERSION}' "$KERNEL_SRPM" | cut -d. -f1,2)
rm -f kernel-*.src.rpm

echo "========================================================="
echo " FASE 2: I MUSCOLI E I NERVI (Scarico Patch)"
echo "========================================================="
echo ">>> Clonazione repository patch CachyOS..."
rm -rf /tmp/cachyos-patches
git clone --depth 1 https://github.com/CachyOS/kernel-patches.git /tmp/cachyos-patches

CACHY_PATCH_DIR="/tmp/cachyos-patches/$KERNEL_VER"
if [ ! -d "$CACHY_PATCH_DIR/all" ]; then
    echo "ATTENZIONE: Patch CachyOS per $KERNEL_VER non trovate. Fallback..."
    CACHY_PATCH_DIR=$(ls -d /tmp/cachyos-patches/[0-9].* | sort -V | tail -n 1)
fi

echo ">>> Creazione del master patch file per RPM (linux-kernel-test.patch)..."
# [BEST PRACTICE] Fedora kernel.spec include per design un hook "Patch999999: linux-kernel-test.patch"
# che viene applicato automaticamente da ApplyOptionalPatch in %prep.
# Sfruttiamo questa interfaccia nativa concatenando tutte le nostre patch dentro quel file.
# In questo modo lo spec originale rimane immacolato e bit-perfect.
> SOURCES/linux-kernel-test.patch

if [ -d "$CACHY_PATCH_DIR/all" ]; then
    for patch in "$CACHY_PATCH_DIR"/all/*.patch; do
        cat "$patch" >> SOURCES/linux-kernel-test.patch
        echo "" >> SOURCES/linux-kernel-test.patch
    done
fi

# [BEST PRACTICE] Niente "|| true". Se il curl fallisce, la build si ferma garantendo sicurezza.
echo ">>> Aggiunta patch chirurgiche Clear Linux..."
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-sched-migrate.patch >> SOURCES/linux-kernel-test.patch
echo "" >> SOURCES/linux-kernel-test.patch
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-sched-numa-Initialise-numa_migrate_retry.patch >> SOURCES/linux-kernel-test.patch
echo "" >> SOURCES/linux-kernel-test.patch
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-mm-memcontrol-add-some-branch-hints-based-on-gcov-an.patch >> SOURCES/linux-kernel-test.patch
echo "" >> SOURCES/linux-kernel-test.patch
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0002-sched-core-add-some-branch-hints-based-on-gcov-analy.patch >> SOURCES/linux-kernel-test.patch
echo "" >> SOURCES/linux-kernel-test.patch
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0170-sched-Add-unlikey-branch-hints-to-several-system-cal.patch >> SOURCES/linux-kernel-test.patch
echo "" >> SOURCES/linux-kernel-test.patch

echo "========================================================="
echo " FASE 3: TUNING KCONFIG E MACROS (Bedrock Naturale)"
echo "========================================================="
echo ">>> Creazione kernel-local..."
# [BEST PRACTICE] L'uso di kernel-local è il metodo ufficiale supportato da Fedora
cat << 'EOF' > SOURCES/kernel-local
# --- ERMETE FORGE: ZEN/LIQUORIX TUNING ---
CONFIG_HZ_1000=y
CONFIG_HZ=1000
# CONFIG_HZ_300 is not set
# CONFIG_HZ_250 is not set

CONFIG_PREEMPT=y
CONFIG_PREEMPT_BUILD=y
CONFIG_PREEMPT_DYNAMIC=y

CONFIG_RCU_EXPERT=y
CONFIG_RCU_BOOST=y
CONFIG_RCU_BOOST_DELAY=500

CONFIG_TCP_CONG_BBR=y
CONFIG_DEFAULT_BBR=y

CONFIG_SCHED_BORE=y

# Mitigations Off
# CONFIG_SPECULATION_MITIGATIONS is not set

# ZSTD Estrema
CONFIG_MODULE_COMPRESS_ZSTD=y
CONFIG_MODULE_COMPRESS_ZSTD_LEVEL=19

# NTSYNC / FSYNC
CONFIG_NTSYNC=y
# -----------------------------------------
EOF

echo ">>> Generazione ~/.rpmmacros globale per la compilazione..."
# [BEST PRACTICE] Zero modifiche al file kernel.spec. Tutte le macro e i flag del
# compilatore (LLVM, LTO, identificatore OS) vengono iniettati tramite rpmmacros 
# in modo nativo per rpmbuild.
cat << 'EOF' > ~/.rpmmacros
%buildid .chimera
%toolchain clang
%use_lto 1
%_lto_cflags -flto=thin
%optflags %{__global_compiler_flags} -O3 -march=x86-64-v3 -pipe -Wno-error -g
%kcflags -O3 -march=x86-64-v3 -pipe -Wno-error
EOF

echo "========================================================="
echo " PREPARAZIONE COMPLETATA."
echo " Zero 'sed' eseguiti. Il file .spec e' intatto."
echo " Tutte le flags LLVM/Gentoo sono passate in runtime tramite ~/.rpmmacros."
echo "========================================================="
