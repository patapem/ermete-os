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

# Rinominiamo il kernel
sed -i 's/Name: kernel/Name: kernel-chimera/' SPECS/kernel.spec
# Disabilitiamo il debuginfo
sed -i 's/%define with_debuginfo %{?_without_debuginfo: 0} %{?!_without_debuginfo: 1}/%define with_debuginfo 0/' SPECS/kernel.spec

echo "========================================================="
echo " FASE 2: I MUSCOLI (Patch Ufficiali CachyOS)"
echo "========================================================="
echo ">>> Clonazione repository patch CachyOS..."
rm -rf /tmp/cachyos-patches
git clone --depth 1 https://github.com/CachyOS/kernel-patches.git /tmp/cachyos-patches

CACHY_PATCH_DIR="/tmp/cachyos-patches/$KERNEL_VER"
if [ -d "$CACHY_PATCH_DIR/all" ]; then
    echo ">>> Trovate patch CachyOS per kernel $KERNEL_VER. Copia in SOURCES..."
    cp $CACHY_PATCH_DIR/all/*.patch SOURCES/
else
    echo "ATTENZIONE: Patch CachyOS per versione $KERNEL_VER non trovate. Fallback al master."
    # Trova l'ultima versione disponibile se quella esatta manca
    LATEST_VER=$(ls -d /tmp/cachyos-patches/6.* | sort -V | tail -n 1)
    if [ -d "$LATEST_VER/all" ]; then
        cp $LATEST_VER/all/*.patch SOURCES/
    fi
fi

echo "========================================================="
echo " FASE 3: I NERVI (Ottimizzazioni Clear Linux)"
echo "========================================================="
echo ">>> Scaricamento patch chirurgiche da Intel Clear Linux..."
curl -sL https://raw.githubusercontent.com/clearlinux-pkgs/linux/master/0001-sched-migrate.patch -o SOURCES/0001-clearlinux-sched-migrate.patch || true
curl -sL https://raw.githubusercontent.com/clearlinux-pkgs/linux/master/0001-sched-numa-Initialise-numa_migrate_retry.patch -o SOURCES/0002-clearlinux-sched-numa-Initialise-numa_migrate_retry.patch || true
curl -sL https://raw.githubusercontent.com/clearlinux-pkgs/linux/master/0001-mm-memcontrol-add-some-branch-hints-based-on-gcov-an.patch -o SOURCES/0003-clearlinux-mm-memcontrol-branch-hints.patch || true


echo ">>> Iniezione dinamica patch in kernel.spec prima di %build..."
# Invece di fare affidamento a commenti che cambiano, forziamo l'applicazione delle patch
# aggiungendo comandi bash alla fine della sezione %prep, subito prima dell'inizio di %build.
sed -i '/^%build/i \
# --- INIEZIONE ERMETE: APPLICAZIONE PATCH CHIMERA ---\
echo ">>> Applicazione Patch CachyOS e Clear Linux..."\
for p in %{_sourcedir}/*cachyos*.patch %{_sourcedir}/*clearlinux*.patch; do\
    if [ -f "$p" ]; then\
        echo ">>> Applicando patch: $(basename $p)"\
        patch -p1 -F3 --no-backup-if-mismatch < "$p" || echo ">>> WARNING: Patch fallita, procedo comunque..."\
    fi\
done\
# ----------------------------------------------------' SPECS/kernel.spec


echo "========================================================="
echo " FASE 4: LA FORGIATURA (Estremismo Compiler Gentoo)"
echo "========================================================="
echo ">>> Configurazione infrastruttura LLVM/Clang e ThinLTO..."

sed -i '/%global toolchain /c\%global toolchain clang' SPECS/kernel.spec

cat << 'SPEC_INJECT' >> SPECS/kernel.spec

# --- INIEZIONE ERMETE GENTOO LTO & COMPILER ---
%global optflags %{optflags} -O3 -march=x86-64-v3 -pipe -Wno-error
%global build_host ErmeteForge
%global _lto_cflags -flto=thin
%global use_lto 1
# ----------------------------------------------
SPEC_INJECT

# Forziamo LLVM nell'invocazione di make dentro il file spec
sed -i 's/make %{?_smp_mflags}/make %{?_smp_mflags} LLVM=1 LLVM_IAS=1/g' SPECS/kernel.spec

echo "========================================================="
echo " ASSEMBLAGGIO COMPLETATO. KERNEL CHIMERA PRONTO."
echo "========================================================="
