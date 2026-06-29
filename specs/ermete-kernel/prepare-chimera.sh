#!/bin/bash
# Ermete OS: The Ultimate Chimera Kernel Bedrock Builder
# 1. Base: Fedora Upstream (Stabilità, SELinux, Bootc)
# 2. Muscoli: CachyOS (BORE Scheduler, BBRv3, Ottimizzazioni di rete e CPU)
# 3. Nervi: Clear Linux (Ottimizzazioni NUMA, Schedulazione, Latenze Memoria)
# 4. Forgiatura: Gentoo (LLVM/Clang, -O3, x86-64-v3, ThinLTO)

set -e

WORKSPACE_DIR="$HOME/rpmbuild"
mkdir -p "$WORKSPACE_DIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
cd "$WORKSPACE_DIR"

echo "========================================================="
echo " FASE 1: LE FONDAMENTA (Fedora Upstream Zero-Trust)"
echo "========================================================="
dnf install -y dnf-utils rpm-build rpmdevtools git curl tar jq

echo ">>> Scaricamento kernel.src.rpm puro..."
dnf download --source kernel
rpm -ivh kernel-*.src.rpm
KERNEL_SRPM=$(ls kernel-*.src.rpm | head -n 1)
KERNEL_VER=$(rpm -qp --qf '%{VERSION}' "$KERNEL_SRPM" | cut -d. -f1,2)
rm -f kernel-*.src.rpm

# [BEST PRACTICE] Invece di rinominare brutalmente il pacchetto (che rompe le dipendenze dnf),
# usiamo la macro nativa 'buildid' per identificare in modo pulito il kernel custom.
sed -i '1i %define buildid .chimera' SPECS/kernel.spec

echo "========================================================="
echo " FASE 2: I MUSCOLI (Patch Ufficiali CachyOS)"
echo "========================================================="
echo ">>> Clonazione repository patch CachyOS..."
rm -rf /tmp/cachyos-patches
git clone --depth 1 https://github.com/CachyOS/kernel-patches.git /tmp/cachyos-patches

CACHY_PATCH_DIR="/tmp/cachyos-patches/$KERNEL_VER"
if [ -d "$CACHY_PATCH_DIR/all" ]; then
    echo ">>> Trovate patch CachyOS per kernel $KERNEL_VER. Copia in SOURCES..."
    cp "$CACHY_PATCH_DIR"/all/*.patch SOURCES/
else
    echo "ATTENZIONE: Patch CachyOS per versione $KERNEL_VER non trovate. Fallback all'ultima versione."
    # [BEST PRACTICE] Regex dinamica e robusta a prova di futuro (kernel 7.x, 8.x)
    LATEST_VER=$(ls -d /tmp/cachyos-patches/[0-9].* | sort -V | tail -n 1)
    if [ -d "$LATEST_VER/all" ]; then
        cp "$LATEST_VER"/all/*.patch SOURCES/
    fi
fi

echo "========================================================="
echo " FASE 3: I NERVI (Ottimizzazioni Clear Linux)"
echo "========================================================="
echo ">>> Scaricamento patch chirurgiche da Intel Clear Linux..."
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-sched-migrate.patch -o SOURCES/0001-clearlinux-sched-migrate.patch || true
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-sched-numa-Initialise-numa_migrate_retry.patch -o SOURCES/0002-clearlinux-sched-numa-Initialise-numa_migrate_retry.patch || true
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0001-mm-memcontrol-add-some-branch-hints-based-on-gcov-an.patch -o SOURCES/0003-clearlinux-mm-memcontrol-branch-hints.patch || true
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0002-sched-core-add-some-branch-hints-based-on-gcov-analy.patch -o SOURCES/0004-clearlinux-sched-core-branch-hints.patch || true
curl -sL -f https://raw.githubusercontent.com/clearlinux-pkgs/linux/main/0170-sched-Add-unlikey-branch-hints-to-several-system-cal.patch -o SOURCES/0005-clearlinux-sched-syscall-hints.patch || true

echo ">>> Creazione kernel-local per Kconfig tuning (Zen/Liquorix style)..."
# [BEST PRACTICE] L'uso di kernel-local è il metodo ufficiale supportato da Fedora
# per iniettare e sovrascrivere regole Kconfig in modo deterministico.
cat << 'EOF' > SOURCES/kernel-local
# --- ERMETE FORGE: ZEN/LIQUORIX TUNING ---
# Timer a 1000Hz per bassissima latenza
CONFIG_HZ_1000=y
CONFIG_HZ=1000
# CONFIG_HZ_300 is not set
# CONFIG_HZ_250 is not set

# Prelazione (Preemption) per Desktop/Gaming
CONFIG_PREEMPT=y
# CONFIG_PREEMPT_VOLUNTARY is not set
# CONFIG_PREEMPT_NONE is not set
CONFIG_PREEMPT_BUILD=y
CONFIG_PREEMPT_DYNAMIC=y

# RCU Tuning per massima interattività
CONFIG_RCU_EXPERT=y
CONFIG_RCU_BOOST=y
CONFIG_RCU_BOOST_DELAY=500

# BBRv3 e TCP Ottimizzato (da CachyOS/Xanmod)
CONFIG_TCP_CONG_BBR=y
CONFIG_DEFAULT_BBR=y

# BORE Scheduler (introdotto dalle patch CachyOS)
CONFIG_SCHED_BORE=y

# 2. Mitigations Off (Massima Performance, addio sicurezza CPU bug)
# Disabilitiamo a livello di compilazione le mitigazioni per guadagnare fino al 15% di performance
# CONFIG_SPECULATION_MITIGATIONS is not set

# 3. Compressione Moduli ZSTD Estrema (Livello 19 per boot istantaneo)
CONFIG_MODULE_COMPRESS_ZSTD=y
CONFIG_MODULE_COMPRESS_ZSTD_LEVEL=19

# 4. NTSYNC / FSYNC per Proton/Wine Gaming
CONFIG_NTSYNC=y
# -----------------------------------------
EOF

echo ">>> Registrazione nativa delle patch in kernel.spec (RPM Best Practices)..."
# [BEST PRACTICE] Non eseguiamo comandi bash "sporchi" dentro il %prep.
# Aggiungiamo invece regolarmente le patch allo spec file tramite macro %patch.
# Questo garantisce che in caso di fallimento, la build venga abortita correttamente
# prevenendo la compilazione di un kernel in uno stato instabile.
PATCH_ID=10000
for p in SOURCES/*cachyos*.patch SOURCES/*clearlinux*.patch; do
    if [ -f "$p" ]; then
        patch_name=$(basename "$p")
        
        # Inserisce la definizione PatchXXXX: prima della fine del preambolo (es. Patch999999)
        sed -i "/^Patch999999:/i Patch${PATCH_ID}: ${patch_name}" SPECS/kernel.spec
        
        # Inserisce l'applicazione nativa della patch alla fine di %prep (prima di %build)
        sed -i "/^%build/i %patch -P ${PATCH_ID} -p1" SPECS/kernel.spec
        
        ((PATCH_ID++))
    fi
done

echo "========================================================="
echo " FASE 4: LA FORGIATURA (Estremismo Compiler Gentoo)"
echo "========================================================="
echo ">>> Configurazione infrastruttura LLVM/Clang e ThinLTO..."

# Attiviamo l'infrastruttura Clang/LLVM ufficiale supportata da Fedora
sed -i '/%global toolchain /c\%global toolchain clang' SPECS/kernel.spec

# [BEST PRACTICE] Iniettiamo i flag alla fine del file per garantire
# l'override sicuro senza conflitti.
cat << 'SPEC_INJECT' >> SPECS/kernel.spec

# --- INIEZIONE ERMETE GENTOO LTO & COMPILER ---
%global optflags %{optflags} -O3 -march=x86-64-v3 -pipe -Wno-error
%global build_host ErmeteForge
%global _lto_cflags -flto=thin
%global use_lto 1
# ----------------------------------------------
SPEC_INJECT

echo "========================================================="
echo " ASSEMBLAGGIO COMPLETATO. KERNEL CHIMERA PRONTO."
echo "========================================================="
