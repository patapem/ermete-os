#!/bin/bash
# Ermete OS: The Ultimate Chimera Kernel Bedrock Builder (Fedora Upstream Zero-Trust)

set -e

WORKSPACE_DIR="$HOME/rpmbuild"
echo ">>> Pulizia profonda del workspace per evitare conflitti con vecchie build..."
mkdir -p "$WORKSPACE_DIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
cd "$WORKSPACE_DIR"

echo "========================================================="
echo " FASE 1: RISOLUZIONE DINAMICA KERNEL E PATCH (con NVIDIA Shield)"
echo "========================================================="
echo ">>> Clonazione repository patch CachyOS..."
rm -rf /tmp/cachyos-patches
git clone --depth 1 https://github.com/CachyOS/kernel-patches.git /tmp/cachyos-patches

echo ">>> Clonazione repository patch Clear Linux..."
rm -rf /tmp/clearlinux-patches
git clone --depth 500 https://github.com/clearlinux-pkgs/linux.git /tmp/clearlinux-patches

echo ">>> Clonazione repository patch linux-tkg..."
rm -rf /tmp/tkg-patches
git clone --depth 1 https://github.com/Frogging-Family/linux-tkg.git /tmp/tkg-patches

echo ">>> Clonazione repository patch XanMod (fetch completo per time-travel)..."
rm -rf /tmp/xanmod-patches
git clone --depth 500 https://gitlab.com/xanmod/linux-patches.git /tmp/xanmod-patches || true

echo ">>> Clonazione repository patch Zen Kernel..."
rm -rf /tmp/zen-patches
git clone --depth 1 -b zen https://github.com/zen-kernel/zen-kernel.git /tmp/zen-patches || true

echo ">>> Clonazione repository patch Liquorix..."
rm -rf /tmp/liquorix-patches
git clone --depth 1 https://github.com/damentz/liquorix-package.git /tmp/liquorix-patches || true

echo ">>> Clonazione repository patch Garuda..."
rm -rf /tmp/garuda-patches
git clone --depth 1 https://gitlab.com/garuda-linux/themes-and-settings/settings/garuda-common-settings.git /tmp/garuda-patches

echo ">>> [BEDROCK SECURE] Calcolo dinamico dello Scudo NVIDIA (Dynamic Ceiling)..."
curl -sLo /etc/yum.repos.d/fedora-nvidia.repo https://negativo17.org/repos/fedora-nvidia.repo || true
NVIDIA_VER=$(dnf repoquery --qf '%{VERSION}\n' akmod-nvidia 2>/dev/null | sort -V | tail -n 1 | awk -F. '{print $1}' || true)
MAX_KERNEL="6.18" # Default
if [[ -n "$NVIDIA_VER" ]]; then
    if [[ "$NVIDIA_VER" -ge 615 ]]; then MAX_KERNEL="6.20"; fi
    if [[ "$NVIDIA_VER" -ge 620 ]]; then MAX_KERNEL="7.0"; fi
    if [[ "$NVIDIA_VER" -ge 630 ]]; then MAX_KERNEL="7.2"; fi
fi
echo ">>> NVIDIA Driver rilevato: Serie ${NVIDIA_VER}.xx -> Massima versione kernel consentita: $MAX_KERNEL"

echo ">>> Ricerca della migliore versione kernel supportata (Fedora -> NVIDIA Shield -> CachyOS -> ClearLinux)..."
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
    
    # Estraiamo la versione major.minor (es. 6.14 da kernel-6.14.5-100.fc43.src.rpm)
    F_VER=$(basename "$URL" | sed -E 's/^kernel-([0-9]+\.[0-9]+).*/\1/')
    echo "    Kernel in Fedora $ver: $F_VER"
    
    # [NVIDIA SHIELD DINAMICO]
    if [[ $(printf "%s\n%s" "$F_VER" "$MAX_KERNEL" | sort -V | tail -n 1) != "$MAX_KERNEL" && "$F_VER" != "$MAX_KERNEL" ]]; then
        echo "    [SHIELD] Kernel $F_VER supera il tetto NVIDIA ($MAX_KERNEL). Passo al precedente..."
        continue
    fi
    
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
    echo "ERRORE FATALE: Nessun kernel compatibile trovato incrociando Fedora, NVIDIA Shield, CachyOS e Clear Linux."
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
if [ ! -d "$CACHY_PATCH_DIR" ]; then
    echo "ERRORE FATALE: Discrepanza dinamica. Trovato $KERNEL_VER ma mancano le patch CachyOS!"
    exit 1
fi

# [BEDROCK] Universal Domain Router
route_patch() {
    local patch="$1"
    local source="$2"
    local lower_patch="${patch,,}"
    local domain="99"
    local priority="9"
    
    if [[ "$lower_patch" =~ (bore|sched|eevdf|cfs|cpu|topology) ]]; then
        domain="02"
        case "$source" in cachyos) priority="1" ;; xanmod) priority="2" ;; tkg) priority="3" ;; liquorix) priority="4" ;; *) priority="5" ;; esac
    elif [[ "$lower_patch" =~ (bbr|tcp|net|wireguard|bpf) ]]; then
        domain="04"
        case "$source" in xanmod) priority="1" ;; liquorix) priority="2" ;; cachyos) priority="3" ;; tkg) priority="4" ;; *) priority="5" ;; esac
    elif [[ "$lower_patch" =~ (mglru|mm|lru|zswap|zram|page|memory|vm) ]]; then
        domain="03"
        case "$source" in clear) priority="1" ;; cachyos) priority="2" ;; xanmod) priority="3" ;; tkg) priority="4" ;; *) priority="5" ;; esac
    elif [[ "$lower_patch" =~ (fs|ext4|btrfs|xfs|zfs|io|block|nvme) ]]; then
        domain="05"
        case "$source" in liquorix) priority="1" ;; cachyos) priority="2" ;; xanmod) priority="3" ;; tkg) priority="4" ;; *) priority="5" ;; esac
    else
        domain="99"
        case "$source" in tkg) priority="1" ;; cachyos) priority="2" ;; xanmod) priority="3" ;; liquorix) priority="4" ;; clear) priority="5" ;; esac
    fi
    local clean_patch=$(echo "$patch" | sed -E 's/^[0-9]+-//')
    echo "bedrock-${domain}_${priority}_${source}_${clean_patch}"
}

echo ">>> Scansione e smistamento delle patch in SOURCES/ con Universal Domain Router..."
if [ -d "$CACHY_PATCH_DIR" ]; then
    for patch in "$CACHY_PATCH_DIR"/*.patch; do
        cp "$patch" "SOURCES/$(route_patch "$(basename "$patch")" "cachyos")"
    done
fi

for repo in xanmod liquorix zen garuda tkg; do
    if [ -d "/tmp/${repo}-patches" ]; then
        search_dir="/tmp/${repo}-patches"
        if [ -n "$(find "$search_dir" -maxdepth 2 -type d -name "*${KERNEL_VER}*" | head -n 1)" ]; then
            search_dirs=$(find "$search_dir" -maxdepth 2 -type d -name "*${KERNEL_VER}*")
            for s_dir in $search_dirs; do
                find "$s_dir" -name "*.patch" -type f | while read patch_file; do
                    cp -f "$patch_file" "SOURCES/$(route_patch "$(basename "$patch_file")" "$repo")"
                done
            done
        elif [ -n "$(find "$search_dir" -maxdepth 2 -type d -name "*[0-9]\.[0-9]*" | head -n 1)" ]; then
            echo "    [SHIELD] Il repository $repo è organizzato per versioni ma non ha una cartella per il kernel $KERNEL_VER. Salto per evitare incompatibilità."
        else
            find "$search_dir" -name "*.patch" -type f | while read patch_file; do
                cp -f "$patch_file" "SOURCES/$(route_patch "$(basename "$patch_file")" "$repo")"
            done
        fi
    fi
done

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

echo ">>> Pulizia patch obsolete (ntsync è upstream in 6.14)..."
rm -f SOURCES/*ntsync*.patch || true

echo ">>> Aggiunta patch chirurgiche Clear Linux..."
for patch_name in \
    "0001-sched-migrate.patch" \
    "0001-sched-numa-Initialise-numa_migrate_retry.patch" \
    "0001-mm-memcontrol-add-some-branch-hints-based-on-gcov-an.patch" \
    "0002-sched-core-add-some-branch-hints-based-on-gcov-analy.patch" \
    "0170-sched-Add-unlikey-branch-hints-to-several-system-cal.patch"; do
    
    if [ -f "/tmp/clearlinux-patches/$patch_name" ]; then
        cp "/tmp/clearlinux-patches/$patch_name" "SOURCES/$(route_patch "$patch_name" "clear")"
    fi
done

echo ">>> Scrittura script di applicazione e validazione AST/Kbuild in /tmp/patch_apply.txt..."
> /tmp/patch_apply.txt
cat << 'EOF' >> /tmp/patch_apply.txt
echo ">>> [BEDROCK] Inizio applicazione matrice universale Kbuild/AST per le patch..."
export LLVM=1
export MAKEFLAGS="LLVM=1 LLVM_IAS=1"
CONF_FILE=$(ls %{_sourcedir}/kernel-x86_64*.config 2>/dev/null | head -n 1 || ls /root/rpmbuild/SOURCES/kernel-x86_64*.config 2>/dev/null | head -n 1 || ls configs/kernel-x86_64*.config 2>/dev/null | head -n 1)
if [ -n "$CONF_FILE" ] && [ -f "$CONF_FILE" ]; then
    cp "$CONF_FILE" .config
else
    echo "ERRORE CRITICO: File di configurazione kernel-x86_64*.config non trovato!"
    exit 1
fi
make LLVM=1 LLVM_IAS=1 olddefconfig
make LLVM=1 LLVM_IAS=1 prepare

for patch in %{_sourcedir}/bedrock-*.patch; do
    if [ ! -f "$patch" ]; then continue; fi
    patch_name=$(basename "$patch")
    echo "-> Test di compatibilità per $patch_name..."
    
    TOUCHED_FILES=$(grep -E '^\+\+\+ b/' "$patch" | awk '{print $2}' | sed 's/^b\///' || true)
    for t_file in $TOUCHED_FILES; do
        if [ -f "$t_file" ]; then cp -p "$t_file" "${t_file}.bedrock_bak"; fi
    done
    
    APPLIED=0
    FUZZ_VAL=0
    NON_C_FILES=""
    for f in 0 1 2 3; do
        if [ $f -eq 3 ]; then
            NON_C_FILES=$(grep -E '^\+\+\+ b/' "$patch" | awk '{print $2}' | sed 's/^b\///' | grep -v '\.c$' || true)
            if [ -n "$NON_C_FILES" ]; then
                 echo "   [SKIP] La patch richiede Fuzz 3 e tocca file non-C. Impossibile validare con AST. Scartata."
                 break
            fi
        fi
        if patch -p1 -F $f --force --dry-run --silent < "$patch"; then
            patch -p1 -F $f --force < "$patch" > /dev/null || true
            APPLIED=1
            FUZZ_VAL=$f
            break
        fi
    done
    if [ $APPLIED -eq 0 ]; then
        if [ -z "$NON_C_FILES" ]; then
            echo "   [SKIP] Conflitto strutturale (Falliti Fuzz 0, 1, 2 e 3). Patch scartata."
        fi
        for t_file in $TOUCHED_FILES; do rm -f "${t_file}.bedrock_bak" "${t_file}.orig" "${t_file}.rej"; done
    fi

    if [ $APPLIED -eq 1 ]; then
        MODIFIED_C_FILES=$(grep -E '^\+\+\+ b/' "$patch" | awk '{print $2}' | sed 's/^b\///' | grep '\.c$' || true)
        if [ -n "$MODIFIED_C_FILES" ]; then
            make LLVM=1 LLVM_IAS=1 olddefconfig </dev/null >/dev/null 2>&1 || true
            echo "   [AST VALIDATION (Fuzz $FUZZ_VAL)] Controllo purezza albero sintattico per $patch_name..."
            AST_FAILED=0
            for c_file in $MODIFIED_C_FILES; do
                if [ -f "$c_file" ]; then
                    target_o="${c_file%.c}.o"
                    # Estrazione dinamica dei flag di compilazione (AST Surgery)
                    COMPILE_CMD=$(make LLVM=1 LLVM_IAS=1 --dry-run "$target_o" </dev/null 2>/dev/null | grep -E '\b(gcc|clang)\b' | grep "$c_file" | head -n 1 || true)
                    if [ -n "$COMPILE_CMD" ]; then
                        # Sostituisce il compilatore con clang -fsyntax-only e rimuove l'output file (-o ...)
                        CLANG_CMD=$(echo "$COMPILE_CMD" | sed -E 's/^(.*)\b(gcc|clang)\b(.*)-o[[:space:]]+[^[:space:]]+(.*)$/clang -fsyntax-only \3\4/')
                        if ! eval "$CLANG_CMD" >/dev/null 2>&1; then
                            AST_FAILED=1
                            echo "   [AST FATAL] Clang ha fallito la validazione sintattica pura di $c_file!"
                            break
                        fi
                    else
                        # Fallback se non riusciamo a estrarre i flag
                        if ! make LLVM=1 LLVM_IAS=1 "$target_o" </dev/null >/dev/null 2>&1; then
                            AST_FAILED=1
                            echo "   [AST FATAL] Kbuild ha fallito la compilazione AST (fallback) di $c_file!"
                            break
                        fi
                    fi
                fi
            done
            if [ $AST_FAILED -eq 1 ]; then
                echo "   [ROLLBACK ATOMICO] Conflitto sintattico rilevato in $patch_name! Ripristino chirurgico dei file modificati..."
                for t_file in $TOUCHED_FILES; do
                    rm -f "${t_file}.orig" "${t_file}.rej"
                    if [ -f "${t_file}.bedrock_bak" ]; then
                        mv -f "${t_file}.bedrock_bak" "$t_file"
                    else
                        rm -f "$t_file"
                    fi
                done
            else
                echo "   [SUCCESS] Patch fusa e validata tramite AST: $patch_name"
                for t_file in $TOUCHED_FILES; do rm -f "${t_file}.bedrock_bak" "${t_file}.orig" "${t_file}.rej"; done
            fi
        else
            echo "   [SUCCESS] Patch fusa (Fuzz $FUZZ_VAL - Non-C Fast Track): $patch_name"
            for t_file in $TOUCHED_FILES; do rm -f "${t_file}.bedrock_bak" "${t_file}.orig" "${t_file}.rej"; done
        fi
    fi
done

make LLVM=1 LLVM_IAS=1 olddefconfig </dev/null >/dev/null 2>&1 || true

echo ">>> [BEDROCK PGO FIX] Filtering PGO flags from EFI libstub and boot Makefiles..."
echo 'KBUILD_CFLAGS := $(filter-out -fprofile-use=% -fprofile-correction -Wno-missing-profile -fgraphite-identity -floop-nest-optimize, $(KBUILD_CFLAGS))' >> drivers/firmware/efi/libstub/Makefile
echo 'KBUILD_CFLAGS := $(filter-out -fprofile-use=% -fprofile-correction -Wno-missing-profile -fgraphite-identity -floop-nest-optimize, $(KBUILD_CFLAGS))' >> arch/x86/boot/Makefile
echo 'KBUILD_CFLAGS := $(filter-out -fprofile-use=% -fprofile-correction -Wno-missing-profile -fgraphite-identity -floop-nest-optimize, $(KBUILD_CFLAGS))' >> arch/x86/boot/compressed/Makefile
echo ">>> [BEDROCK WERROR SHIELD] Disabling -Werror globally across all kernel subsystems..."
echo 'KBUILD_CFLAGS += -Wno-error' >> Makefile
find drivers arch fs kernel mm net -name "Makefile" -exec sed -i 's/-Werror/-Wno-error/g' {} + 2>/dev/null || true
EOF

awk '/# END OF PATCH APPLICATIONS/{system("cat /tmp/patch_apply.txt")}1' SPECS/kernel.spec > SPECS/kernel.spec.new
mv SPECS/kernel.spec.new SPECS/kernel.spec

echo "========================================================="
echo " FASE 3: TUNING KCONFIG (Bedrock Naturale Dinamico)"
echo "========================================================="
for conf in SOURCES/kernel-x86_64*.config; do
    sed -i -E '/^(# )?CONFIG_(.*WERROR.*|HZ|HZ_1000|HZ_300|HZ_250|HZ_100|DEFAULT_BBR|TCP_CONG_BBR|DEFAULT_CUBIC|SCHED_BORE|MODULE_COMPRESS_ZSTD|MODULE_COMPRESS_XZ|LRU_GEN|LRU_GEN_ENABLED|GENERIC_CPU|GENERIC_CPU3|X86_64_VERSION|CC_OPTIMIZE_FOR_PERFORMANCE_O3|LTO_CLANG_THIN|DEBUG_INFO|DEBUG_INFO_NONE|DEBUG_INFO_DWARF_TOOLCHAIN_DEFAULT|NTSYNC|RUST|VIRTIO_PCI|VIRTIO_CONSOLE|NET_9P|NET_9P_VIRTIO|9P_FS|HIBERNATION|CRASH_DUMP|COREDUMP|KEXEC|KEXEC_FILE|PROC_KCORE|COMPAT_VDSO|BINFMT_MISC|SLAB_FREELIST_RANDOM|SLAB_FREELIST_HARDENED|HARDENED_USERCOPY|HARDENED_USERCOPY_FALLBACK|FORTIFY_SOURCE|INIT_ON_ALLOC_DEFAULT_ON|INIT_ON_FREE_DEFAULT_ON|RANDOMIZE_BASE|RANDOMIZE_MEMORY|PAGE_TABLE_ISOLATION|BPF_UNPRIV_DEFAULT_OFF|SECURITY_DMESG_RESTRICT|USERFAULTFD|MODIFY_LDT_SYSCALL|LEGACY_VSYSCALL_NONE|LEGACY_VSYSCALL_EMULATE|LEGACY_VSYSCALL_XONLY|STRICT_DEVMEM|IO_STRICT_DEVMEM|DEVKMEM|ACPI_CUSTOM_METHOD|BUG_ON_DATA_CORRUPTION|SCHED_STACK_END_CHECK|PANIC_ON_OOPS|SECURITY_YAMA|SECURITY_LOCKDOWN_LSM|SECURITY_LOCKDOWN_LSM_EARLY|DRM_NOUVEAU)( |=)/d' "$conf"

    cat << 'EOF' >> "$conf"
# --- ERMETE FORGE: ZEN/LIQUORIX TUNING ---
CONFIG_HZ_1000=y
CONFIG_HZ=1000
# CONFIG_HZ_300 is not set
# CONFIG_HZ_250 is not set
# CONFIG_HZ_100 is not set

CONFIG_DEFAULT_BBR=y
CONFIG_TCP_CONG_BBR=y
# CONFIG_DEFAULT_CUBIC is not set

CONFIG_SCHED_BORE=y

CONFIG_MODULE_COMPRESS_ZSTD=y
# CONFIG_MODULE_COMPRESS_XZ is not set

CONFIG_LRU_GEN=y
CONFIG_LRU_GEN_ENABLED=y

CONFIG_GENERIC_CPU=y
CONFIG_CC_OPTIMIZE_FOR_PERFORMANCE_O3=y
CONFIG_LTO_CLANG_THIN=y
CONFIG_LTO_CLANG=y
CONFIG_LTO=y

CONFIG_DEBUG_INFO=n
CONFIG_DEBUG_INFO_NONE=y

CONFIG_NTSYNC=y
# CONFIG_RUST is not set
# CONFIG_WERROR is not set
# CONFIG_DRM_WERROR is not set
# CONFIG_DRM_I915_WERROR is not set
# CONFIG_DRM_XE_WERROR is not set
# CONFIG_DRM_AMDGPU_WERROR is not set
# CONFIG_KVM_WERROR is not set
# CONFIG_PPC_WERROR is not set

# --- ERMETE FORGE: PGO QEMU 9PFS BOOT ---
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_CONSOLE=y
CONFIG_NET_9P=y
CONFIG_NET_9P_VIRTIO=y
CONFIG_9P_FS=y
# CONFIG_DRM_NOUVEAU is not set

# --- ERMETE FORGE: TAILS OS AMNESIA & ANTI-FORENSICS ---
# CONFIG_HIBERNATION is not set
# CONFIG_CRASH_DUMP is not set
# CONFIG_COREDUMP is not set
# CONFIG_KEXEC is not set
# CONFIG_KEXEC_FILE is not set
# CONFIG_PROC_KCORE is not set
# CONFIG_COMPAT_VDSO is not set
# CONFIG_BINFMT_MISC is not set

# --- ERMETE FORGE: 64 PILASTRI KSPP HARDENING ---
CONFIG_SLAB_FREELIST_RANDOM=y
CONFIG_SLAB_FREELIST_HARDENED=y
CONFIG_HARDENED_USERCOPY=y
# CONFIG_HARDENED_USERCOPY_FALLBACK is not set
CONFIG_FORTIFY_SOURCE=y
CONFIG_INIT_ON_ALLOC_DEFAULT_ON=y
CONFIG_INIT_ON_FREE_DEFAULT_ON=y
CONFIG_RANDOMIZE_BASE=y
CONFIG_RANDOMIZE_MEMORY=y
CONFIG_PAGE_TABLE_ISOLATION=y
CONFIG_BPF_UNPRIV_DEFAULT_OFF=y
CONFIG_SECURITY_DMESG_RESTRICT=y
# CONFIG_USERFAULTFD is not set
# CONFIG_MODIFY_LDT_SYSCALL is not set
CONFIG_LEGACY_VSYSCALL_NONE=y
# CONFIG_LEGACY_VSYSCALL_EMULATE is not set
# CONFIG_LEGACY_VSYSCALL_XONLY is not set
CONFIG_STRICT_DEVMEM=y
CONFIG_IO_STRICT_DEVMEM=y
# CONFIG_DEVKMEM is not set
# CONFIG_ACPI_CUSTOM_METHOD is not set
CONFIG_BUG_ON_DATA_CORRUPTION=y
CONFIG_SCHED_STACK_END_CHECK=y
CONFIG_PANIC_ON_OOPS=y
CONFIG_SECURITY_YAMA=y
CONFIG_SECURITY_LOCKDOWN_LSM=y
CONFIG_SECURITY_LOCKDOWN_LSM_EARLY=y
EOF
done

echo ">>> Generazione ~/.rpmmacros locale esclusivo per KERNEL..."
if [ -f ../../config/rpmmacros ]; then
    cat ../../config/rpmmacros > ~/.rpmmacros
elif [ -f config/rpmmacros ]; then
    cat config/rpmmacros > ~/.rpmmacros
fi

cat << 'EOF' >> ~/.rpmmacros
%_with_vanilla 1
%buildid .chimera
%toolchain clang
%_ld ld.lld
%_ldflags -Wl,-O2 -Wl,--as-needed -Wl,--sort-common -Wl,-z,now -Wl,-z,relro -fuse-ld=lld
%optflags %{__global_compiler_flags} -march=x86-64-v3 -pipe -Wno-error -fuse-ld=lld
%kcflags -march=x86-64-v3 -pipe -Wno-error -fuse-ld=lld

%_without_selftests 1
%_without_tools 1
%_without_perf 1
%_without_libperf 1
%_without_ynl 1
%_without_bpftool 1
%_without_debug 1
%_without_debuginfo 1
%_without_doc 1
%_binary_payload w1.zstdio
%_source_payload w1.zstdio
EOF

echo "========================================================="
echo " FASE 4: PREPARAZIONE ALBERO SORGENTE (%prep)"
echo "========================================================="
echo ">>> Esecuzione rpmbuild -bp per scompattare, applicare patch e validare l'albero..."
spectool -g -R SPECS/kernel.spec
dnf builddep -y SPECS/kernel.spec
export LLVM=1
export MAKEFLAGS="LLVM=1 LLVM_IAS=1"
rpmbuild -bp SPECS/kernel.spec --target x86_64

echo ">>> Rilevamento della directory di build del kernel preparata..."
KERNEL_BUILD_DIR=$(find "$WORKSPACE_DIR/BUILD" -maxdepth 6 -name "Makefile" -exec grep -l "^VERSION =" {} + 2>/dev/null | head -n 1 | xargs -r dirname)
if [ -z "$KERNEL_BUILD_DIR" ]; then
    echo "ERRORE FATALE: Directory di build del kernel non trovata dopo rpmbuild -bp!"
    exit 1
fi
REL_DIR=$(realpath --relative-to="$WORKSPACE_DIR/BUILD" "$KERNEL_BUILD_DIR")
echo "$REL_DIR" > "$WORKSPACE_DIR/BUILD/.kernel_version"
echo ">>> Albero del kernel preparato e registrato in BUILD/.kernel_version: $REL_DIR"

echo "========================================================="
echo " PREPARAZIONE CHIMERA COMPLETATA."
echo "========================================================="
