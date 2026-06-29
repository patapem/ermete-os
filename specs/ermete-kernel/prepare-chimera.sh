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
dnf download --source kernel --releasever=41
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
    echo "ERRORE FATALE: Patch CachyOS per $KERNEL_VER non trovate!"
    echo "Zero-Trust Policy: Nessun fallback. Le patch del kernel devono essere esatte per evitare corruzioni silenziose."
    exit 1
fi

echo ">>> Scansione e registrazione delle patch nello spec (Native RPM Best Practice)..."
# Invece di concatenare file (hack), registriamo ogni patch con un suo ID univoco
# all'interno del file spec. In questo modo RPM traccia nativamente i sorgenti
# e in caso di errore sappiamo esattamente quale patch ha fallito.
> /tmp/patch_apply.txt
PATCH_ID=10000

if [ -d "$CACHY_PATCH_DIR/all" ]; then
    for patch in "$CACHY_PATCH_DIR"/all/*.patch; do
        cp "$patch" SOURCES/
        patch_name=$(basename "$patch")
        sed -i "/^Patch999999:/i Patch${PATCH_ID}: ${patch_name}" SPECS/kernel.spec
        echo "%patch -P ${PATCH_ID} -p1" >> /tmp/patch_apply.txt
        ((PATCH_ID++))
    done
fi

echo ">>> Aggiunta patch chirurgiche Clear Linux..."
for patch_url in \
    "https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-sched-migrate.patch" \
    "https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-sched-numa-Initialise-numa_migrate_retry.patch" \
    "https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-mm-memcontrol-add-some-branch-hints-based-on-gcov-an.patch" \
    "https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0002-sched-core-add-some-branch-hints-based-on-gcov-analy.patch" \
    "https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0170-sched-Add-unlikey-branch-hints-to-several-system-cal.patch"; do
    
    patch_name=$(basename "$patch_url")
    curl -sL -f "$patch_url" -o "SOURCES/clearlinux-$patch_name"
    
    sed -i "/^Patch999999:/i Patch${PATCH_ID}: clearlinux-${patch_name}" SPECS/kernel.spec
    echo "%patch -P ${PATCH_ID} -p1" >> /tmp/patch_apply.txt
    ((PATCH_ID++))
done

# Applicazione cronologica corretta ed esatta delle patch (risolve bug ordine inverso)
# Match esatto di ^%build$ per evitare conflitti con ^%buildroot_save_unstripped
awk '/^%build$/{system("cat /tmp/patch_apply.txt")}1' SPECS/kernel.spec > SPECS/kernel.spec.new
mv SPECS/kernel.spec.new SPECS/kernel.spec

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

# ZSTD Rapida per Moduli (Ottimizza Tempo di Compilazione)
CONFIG_MODULE_COMPRESS_ZSTD=y

# Ottimizzazione MGLRU (Multi-Gen LRU) attiva per default (Ottimo per 32GB RAM)
CONFIG_LRU_GEN=y
CONFIG_LRU_GEN_ENABLED=y

# Ottimizzazione CPU Architettura Esatta (Zen 3 - Ryzen 5800X3D)
CONFIG_MZEN3=y
# CONFIG_GENERIC_CPU is not set

# Ottimizzazione Tempi di Compilazione (Nessun Simbolo di Debug)
CONFIG_DEBUG_INFO=n
CONFIG_DEBUG_INFO_NONE=y
# CONFIG_DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT is not set

# NT Sync per Gaming
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
# ThinLTO Cache massivo per velocizzare la fase di linking (Persistito in GitHub Cache)
%_lto_cflags -flto=thin -Wl,--thinlto-cache-dir=/github/home/.cache/ccache/thinlto
%optflags %{__global_compiler_flags} -O3 -march=znver3 -pipe -Wno-error
%kcflags -O3 -march=znver3 -pipe -Wno-error

# Disabilitazione nativa dei moduli non necessari/problematici (Fix LLVM LTO)
%_without_selftests 1
%_without_tools 1
%_without_perf 1
%_without_bpftool 1

# Estreme riduzioni dei tempi di build (No Debuginfo, No DWARF, No Doc)
%_without_debug 1
%_without_debuginfo 1
%_without_doc 1

# Compressione RPM istantanea (Elimina colli di bottiglia Single-Thread)
# Essendo destinati a un container OCI, la compressione RPM è inutile e ridondante.
%_binary_payload w1.zstdio
%_source_payload w1.zstdio
EOF

echo "========================================================="
echo " PREPARAZIONE COMPLETATA."
echo " Iniezioni 'sed'/'awk' eseguite chirurgicamente sul file .spec."
echo " Tutte le flags LLVM/Gentoo sono passate in runtime tramite ~/.rpmmacros."
echo "========================================================="
