#!/bin/bash
# Ermete OS: The Ultimate Chimera Kernel Bedrock Builder

set -e

WORKSPACE_DIR="$HOME/rpmbuild"
mkdir -p "$WORKSPACE_DIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
cd "$WORKSPACE_DIR"

echo "========================================================="
echo " FASE 1: RISOLUZIONE DINAMICA KERNEL E PATCH"
echo "========================================================="
echo ">>> Clonazione repository patch CachyOS..."
rm -rf /tmp/cachyos-patches
git clone --depth 1 https://github.com/CachyOS/kernel-patches.git /tmp/cachyos-patches

echo ">>> Clonazione repository patch Clear Linux..."
rm -rf /tmp/clearlinux-patches
git clone --depth 500 https://github.com/clearlinux-pkgs/linux.git /tmp/clearlinux-patches

echo ">>> Ricerca della migliore versione kernel supportata (Fedora -> CachyOS -> ClearLinux)..."
TARGET_RELEASEVER=""
TARGET_KERNEL_VER=""

source /etc/os-release
CURRENT_FVER=$VERSION_ID
MIN_FVER=$((CURRENT_FVER - 4))

for (( ver=$CURRENT_FVER; ver>=$MIN_FVER; ver-- )); do
    echo ">>> Analisi Fedora $ver..."
    
    URL=$(dnf download --source kernel --releasever=$ver --url 2>/dev/null | grep -E '\.src\.rpm' | head -n 1 || true)
    if [ -z "$URL" ]; then
        echo "    Nessun kernel sorgente trovato nei repo per Fedora $ver."
        continue
    fi
    
    # Estraiamo la versione major.minor (es. 6.17 da kernel-6.17.10-100.fc41.src.rpm)
    F_VER=$(basename "$URL" | sed -E 's/^kernel-([0-9]+\.[0-9]+).*/\1/')
    echo "    Kernel in Fedora $ver: $F_VER"
    
    # 1. Controllo CachyOS
    if [ ! -d "/tmp/cachyos-patches/$F_VER/all" ]; then
        echo "    CachyOS NON supporta $F_VER. Passo al precedente..."
        continue
    fi
    
    # 2. Controllo Clear Linux
    pushd /tmp/clearlinux-patches > /dev/null
    F_VER_ESC="${F_VER//./\\.}"
    CLEAR_COMMIT=$(git log --grep="update.*${F_VER_ESC}\\b" -n 1 --format="%H" || true)
    popd > /dev/null
    
    if [ -z "$CLEAR_COMMIT" ]; then
        echo "    Clear Linux NON ha patch per $F_VER. Passo al precedente..."
        continue
    fi
    
    echo ">>> MATCH PERFETTO! Fedora $ver fornisce kernel $F_VER, pienamente supportato da CachyOS e ClearLinux."
    TARGET_RELEASEVER=$ver
    TARGET_KERNEL_VER=$F_VER
    break
done

if [ -z "$TARGET_RELEASEVER" ]; then
    echo "ERRORE FATALE: Nessun kernel compatibile trovato incrociando Fedora, CachyOS e Clear Linux."
    exit 1
fi

echo "========================================================="
echo " FASE 2: LE FONDAMENTA (Fedora Upstream Zero-Trust)"
echo "========================================================="
echo ">>> Scaricamento kernel.src.rpm puro (Releasever: $TARGET_RELEASEVER)..."
dnf download --source kernel --releasever=$TARGET_RELEASEVER
rpm -ivh kernel-*.src.rpm
KERNEL_SRPM=$(ls kernel-*.src.rpm | head -n 1)
KERNEL_VER=$(rpm -qp --qf '%{VERSION}' "$KERNEL_SRPM" | cut -d. -f1,2)
rm -f kernel-*.src.rpm

CACHY_PATCH_DIR="/tmp/cachyos-patches/$KERNEL_VER"
if [ ! -d "$CACHY_PATCH_DIR/all" ]; then
    echo "ERRORE FATALE: Discrepanza dinamica. Trovato $KERNEL_VER ma mancano le patch CachyOS!"
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

echo ">>> Sincronizzazione dinamica Clear Linux con Kernel $KERNEL_VER..."
pushd /tmp/clearlinux-patches > /dev/null
KERNEL_VER_ESC="${KERNEL_VER//./\\.}"
CLEAR_COMMIT=$(git log --grep="update.*${KERNEL_VER_ESC}\\b" -n 1 --format="%H" || true)
if [ -n "$CLEAR_COMMIT" ]; then
    echo ">>> Allineamento Clear Linux al commit: $CLEAR_COMMIT"
    git checkout -q "$CLEAR_COMMIT"
else
    echo ">>> ATTENZIONE: Nessun commit specifico trovato per $KERNEL_VER. Utilizzo l'head di main."
fi
popd > /dev/null

echo ">>> Aggiunta patch chirurgiche Clear Linux..."
for patch_name in \
    "0001-sched-migrate.patch" \
    "0001-sched-numa-Initialise-numa_migrate_retry.patch" \
    "0001-mm-memcontrol-add-some-branch-hints-based-on-gcov-an.patch" \
    "0002-sched-core-add-some-branch-hints-based-on-gcov-analy.patch" \
    "0170-sched-Add-unlikey-branch-hints-to-several-system-cal.patch"; do
    
    if [ -f "/tmp/clearlinux-patches/$patch_name" ]; then
        cp "/tmp/clearlinux-patches/$patch_name" "SOURCES/clearlinux-$patch_name"
        sed -i "/^Patch999999:/i Patch${PATCH_ID}: clearlinux-${patch_name}" SPECS/kernel.spec
        echo "%patch -P ${PATCH_ID} -p1" >> /tmp/patch_apply.txt
        ((PATCH_ID++))
    else
        echo ">>> ATTENZIONE: Patch $patch_name non trovata nel repo Clear Linux. Skippata."
    fi
done

# Applicazione cronologica corretta ed esatta delle patch (risolve bug ordine inverso)
# Match esatto di ^%build$ per evitare conflitti con ^%buildroot_save_unstripped
awk '/^%build$/{system("cat /tmp/patch_apply.txt")}1' SPECS/kernel.spec > SPECS/kernel.spec.new
mv SPECS/kernel.spec.new SPECS/kernel.spec

echo "========================================================="
echo " FASE 3: TUNING KCONFIG E MACROS (Bedrock Naturale)"
echo "========================================================="
echo ">>> Iniezione chirurgica del tuning SOLO nei config x86_64..."
# Evitiamo di rompere le build arm64/powerpc iniettando MZEN3 globalmente.
# Applichiamo i Kconfig direttamente alle configurazioni x86_64 di base.

for conf in SOURCES/kernel-x86_64*.config; do
    # Pulizia chirurgica delle chiavi esistenti per evitare warning di override in Kconfig
    sed -i -E '/^(# )?CONFIG_(HZ|HZ_1000|HZ_300|HZ_250|HZ_100|DEFAULT_BBR|TCP_CONG_BBR|DEFAULT_CUBIC|SCHED_BORE|MODULE_COMPRESS_ZSTD|MODULE_COMPRESS_XZ|LRU_GEN|LRU_GEN_ENABLED|GENERIC_CPU|CC_OPTIMIZE_FOR_PERFORMANCE_O3|LTO_CLANG_THIN|DEBUG_INFO|DEBUG_INFO_NONE|DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT|NTSYNC)( |=)/d' "$conf"

    cat << 'EOF' >> "$conf"
# --- ERMETE FORGE: ZEN/LIQUORIX TUNING ---
CONFIG_HZ_1000=y
CONFIG_HZ=1000
# CONFIG_HZ_300 is not set
# CONFIG_HZ_250 is not set
# CONFIG_HZ_100 is not set

# Lasciamo che CachyOS gestisca nativamente il PREEMPT per evitare conflitti Kconfig
# Lasciamo a Kconfig i default di RCU per non innescare il validatore su RCU_EXPERT

CONFIG_DEFAULT_BBR=y
CONFIG_TCP_CONG_BBR=y
# CONFIG_DEFAULT_CUBIC is not set

CONFIG_SCHED_BORE=y

# ZSTD Rapida per Moduli (Ottimizza Tempo di Compilazione)
CONFIG_MODULE_COMPRESS_ZSTD=y
# CONFIG_MODULE_COMPRESS_XZ is not set

# Ottimizzazione MGLRU (Multi-Gen LRU) attiva per default (Ottimo per 32GB RAM)
CONFIG_LRU_GEN=y
CONFIG_LRU_GEN_ENABLED=y

# Ottimizzazione CPU: Moderna Universale (x86-64-v3 / AVX2)
# Rende il kernel compatibile con tutti gli Intel/AMD dal 2015 in poi
CONFIG_GENERIC_CPU=y

# Ottimizzazione Nativa Bedrock (Demandare a Kbuild, NO Macro RPM)
CONFIG_CC_OPTIMIZE_FOR_PERFORMANCE_O3=y
CONFIG_LTO_CLANG_THIN=y

# Ottimizzazione Tempi di Compilazione (Nessun Simbolo di Debug)
CONFIG_DEBUG_INFO=n
CONFIG_DEBUG_INFO_NONE=y
# CONFIG_DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT is not set

# NT Sync per Gaming
CONFIG_NTSYNC=y
# -----------------------------------------
EOF
done

echo ">>> Generazione ~/.rpmmacros globale per la compilazione..."
# [BEST PRACTICE] Zero modifiche al file kernel.spec. Tutte le macro e i flag del
# compilatore (LLVM, LTO, identificatore OS) vengono iniettati tramite rpmmacros 
# in modo nativo per rpmbuild.
cat << 'EOF' > ~/.rpmmacros
%buildid .chimera
%toolchain clang
%optflags %{__global_compiler_flags} -march=x86-64-v3 -pipe -Wno-error
%kcflags -march=x86-64-v3 -pipe -Wno-error

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
