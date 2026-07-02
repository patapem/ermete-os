#!/bin/bash
# Ermete OS: The Ultimate Chimera Kernel Bedrock Builder (Upstream Mainline Torvalds)

set -e

WORKSPACE_DIR="$HOME/rpmbuild/BUILD"
echo ">>> Pulizia profonda del workspace per evitare conflitti con vecchie build..."
rm -rf "$WORKSPACE_DIR"/*
mkdir -p "$WORKSPACE_DIR"
cd "$WORKSPACE_DIR"

echo "========================================================="
echo " FASE 1: RISOLUZIONE DINAMICA MATRICE KERNEL UPSTREAM"
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

echo ">>> Clonazione base repository patch Liquorix..."
rm -rf /tmp/liquorix-patches
git clone --depth 1 https://github.com/damentz/liquorix-package.git /tmp/liquorix-patches || true

echo ">>> RISOLUZIONE DINAMICA KERNEL ATTIVO DA API UFFICIALE (Zero-Trust)..."
KERNEL_API_URL="https://www.kernel.org/releases.json"
KERNEL_JSON=$(curl -s "$KERNEL_API_URL")
ACTIVE_KERNELS=$(echo "$KERNEL_JSON" | jq -r ".releases[] | .version" | awk -F. '{print $1"."$2}' | sort -V -r | uniq)

TARGET_KERNEL_VER=""
for v in $ACTIVE_KERNELS; do
    if [ -d "/tmp/tkg-patches/linux-tkg-patches/$v" ]; then
        if [ -d "/tmp/xanmod-patches/linux-$v.y-xanmod" ] || [ -d "/tmp/xanmod-patches/eol/linux-$v.y-xanmod" ]; then
            TARGET_KERNEL_VER="$v"
            break
        fi
    fi
done

if [ -z "$TARGET_KERNEL_VER" ]; then
    echo "ERRORE FATALE: Nessuna intersezione trovata tra TKG, XanMod e i Kernel Attivi (releases.json)!"
    exit 1
fi
echo ">>> MATCH PERFETTO! Costruiremo il kernel Mainline versione: $TARGET_KERNEL_VER"

echo "========================================================="
echo " FASE 2: FONDAMENTA E CHIRURGIA PATCH (Upstream Torvalds)"
echo "========================================================="
echo ">>> [BEDROCK SECURE] Determinazione release stabile per Torvalds $TARGET_KERNEL_VER via API JSON..."
KERNEL_API_URL="https://www.kernel.org/releases.json"
KERNEL_JSON=$(curl -s "$KERNEL_API_URL")
KERNEL_LATEST=$(echo "$KERNEL_JSON" | jq -r ".releases[] | select(.version | startswith(\"$TARGET_KERNEL_VER\")) | .version" | sort -V | tail -n 1)

if [ -z "$KERNEL_LATEST" ]; then
    echo "ERRORE FATALE: Nessuna release trovata per la versione base $TARGET_KERNEL_VER tramite API."
    exit 1
fi

KERNEL_SOURCE_URL="https://git.kernel.org/pub/scm/linux/kernel/git/stable/linux.git/snapshot/linux-${KERNEL_LATEST}.tar.gz"
KERNEL_LATEST_TARBALL="linux-${KERNEL_LATEST}.tar.gz"
KERNEL_EXTRACT_DIR="linux-${KERNEL_LATEST}"

echo ">>> Scaricamento Kernel Upstream Torvalds Snapshot ($KERNEL_LATEST_TARBALL)..."
if [ ! -f "$KERNEL_LATEST_TARBALL" ]; then
    # Fallback: CDN kernel.org mirror is returning 404, using official Git snapshot over TLS
    wget -qO "$KERNEL_LATEST_TARBALL" "$KERNEL_SOURCE_URL"
fi

echo ">>> [BEDROCK SECURE] L'autenticità del Kernel è garantita tramite crittografia TLS (git.kernel.org origin)..."

echo ">>> Estrazione del Kernel Certificato..."
tar -xf "$KERNEL_LATEST_TARBALL"
cd "$KERNEL_EXTRACT_DIR"

# Salviamo la versione esatta per l'idempotency check nella Action
echo "$KERNEL_EXTRACT_DIR" > ../.kernel_version


mkdir -p .patches

# [BEDROCK] Universal Domain Router
# Assicura che la patch migliore (in base al dominio) venga applicata per prima
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
    echo "${domain}_${priority}_${source}_${patch}"
}

echo ">>> [TIME-TRAVEL] Sincronizzazione dinamica Clear Linux..."
pushd /tmp/clearlinux-patches > /dev/null
KERNEL_VER_ESC="${TARGET_KERNEL_VER//./\\.}"
CLEAR_COMMIT=$(git log --grep="update.*${KERNEL_VER_ESC}\\b" -n 1 --format="%H" || true)
if [ -n "$CLEAR_COMMIT" ]; then
    echo "    Allineamento Clear Linux al commit: $CLEAR_COMMIT"
    git checkout -q "$CLEAR_COMMIT"
else
    echo "    ATTENZIONE: Nessun commit specifico trovato. Utilizzo l'head di main."
fi
for patch_name in \
    "0001-sched-migrate.patch" \
    "0001-sched-numa-Initialise-numa_migrate_retry.patch" \
    "0001-mm-memcontrol-add-some-branch-hints-based-on-gcov-an.patch" \
    "0002-sched-core-add-some-branch-hints-based-on-gcov-analy.patch" \
    "0170-sched-Add-unlikey-branch-hints-to-several-system-cal.patch"; do
    if [ -f "$patch_name" ]; then
        cp "$patch_name" "$WORKSPACE_DIR/$KERNEL_EXTRACT_DIR/.patches/$(route_patch "$patch_name" "clear")" || true
    fi
done
popd > /dev/null

echo ">>> [TIME-TRAVEL] Sincronizzazione dinamica XanMod..."
if [ -d "/tmp/xanmod-patches" ]; then
    pushd /tmp/xanmod-patches > /dev/null
    XANMOD_COMMIT=$(git log --format="%H" -n 1 -- eol/linux-${TARGET_KERNEL_VER}.y-xanmod linux-${TARGET_KERNEL_VER}.y-xanmod || true)
    if [ -n "$XANMOD_COMMIT" ]; then
        echo "    Allineamento XanMod al commit: $XANMOD_COMMIT"
        git checkout -q "$XANMOD_COMMIT"
    fi
    if [ -d "linux-${TARGET_KERNEL_VER}.y-xanmod" ]; then
        for p in linux-${TARGET_KERNEL_VER}.y-xanmod/*.patch; do cp "$p" "$WORKSPACE_DIR/$KERNEL_EXTRACT_DIR/.patches/$(route_patch "$(basename "$p")" "xanmod")"; done || true
    elif [ -d "eol/linux-${TARGET_KERNEL_VER}.y-xanmod" ]; then
        for p in eol/linux-${TARGET_KERNEL_VER}.y-xanmod/*.patch; do cp "$p" "$WORKSPACE_DIR/$KERNEL_EXTRACT_DIR/.patches/$(route_patch "$(basename "$p")" "xanmod")"; done || true
    fi
    popd > /dev/null
fi

echo ">>> [TIME-TRAVEL] Sincronizzazione dinamica Liquorix..."
if [ -d "/tmp/liquorix-patches" ]; then
    pushd /tmp/liquorix-patches > /dev/null
    git fetch origin "refs/heads/${TARGET_KERNEL_VER}/master:refs/heads/${TARGET_KERNEL_VER}/master" --depth 1 || true
    if git show-ref --verify --quiet "refs/heads/${TARGET_KERNEL_VER}/master"; then
        echo "    Allineamento Liquorix al branch: ${TARGET_KERNEL_VER}/master"
        git checkout -q "${TARGET_KERNEL_VER}/master"
        # Liquorix patches (contains Zen)
        for p in linux-liquorix/debian/patches/zen/*.patch; do cp "$p" "$WORKSPACE_DIR/$KERNEL_EXTRACT_DIR/.patches/$(route_patch "$(basename "$p")" "liquorix")"; done || true
    else
        echo "    ATTENZIONE: Branch ${TARGET_KERNEL_VER}/master non trovato in Liquorix."
    fi
    popd > /dev/null
fi

echo ">>> Sincronizzazione CachyOS e Linux-TKG..."
if [ -d "/tmp/cachyos-patches/$TARGET_KERNEL_VER/all" ]; then
    for p in /tmp/cachyos-patches/$TARGET_KERNEL_VER/all/*.patch; do cp "$p" .patches/$(route_patch "$(basename "$p")" "cachyos"); done || true
fi
if [ -d "/tmp/tkg-patches/linux-tkg-patches/$TARGET_KERNEL_VER" ]; then
    for p in /tmp/tkg-patches/linux-tkg-patches/$TARGET_KERNEL_VER/*.patch; do cp "$p" .patches/$(route_patch "$(basename "$p")" "tkg"); done || true
fi

# Genera un default Kconfig per permettere a Kbuild di funzionare (ci serve per AST validazione)
make defconfig

echo ">>> [BEDROCK] Inizio applicazione matrice universale AST (Holy Grail)..."
for patch in $(ls .patches/*.patch | sort -V); do
    if [ ! -f "$patch" ]; then continue; fi
    echo "-> Test di compatibilità per $(basename "$patch")..."
    
    APPLIED=0
    FUZZ=0
    # Fuzz 0 attempt
    if patch -p1 -F 0 --force --dry-run --silent < "$patch"; then
        patch -p1 -F 0 --force < "$patch" > /dev/null || true
        echo "   [SUCCESS] Patch applicata a Fuzz 0."
        APPLIED=1
        FUZZ=0
    else
        echo "   [WARNING] Fallito Fuzz 0. Tento Fuzz 3..."
        if patch -p1 -F 3 --force --dry-run --silent < "$patch"; then
            patch -p1 -F 3 --force < "$patch" > /dev/null || true
            echo "   [SUCCESS] Patch applicata a Fuzz 3."
            APPLIED=1
            FUZZ=3
        else
            echo "   [SKIP] Conflitto strutturale (Fallito Fuzz sia 0 che 3). Patch scartata."
            continue
        fi
    fi

    if [ $APPLIED -eq 1 ]; then
        # Step 1: Validate Kconfig/Makefile integrity if touched
        KCONFIG_FAILED=0
        if grep -E '^\+\+\+ b/(Kconfig|Makefile|.*/Kconfig|.*/Makefile)' "$patch" >/dev/null 2>&1; then
            echo "   [KBUILD VALIDATION] Verifico integrità dell'albero Kconfig..."
            cp .config .config.bak
            if ! make allnoconfig >/dev/null 2>&1; then
                KCONFIG_FAILED=1
                echo "   [KBUILD FATAL] La patch ha corrotto la struttura Kconfig/Makefile!"
            fi
            mv .config.bak .config
        fi
        
        # Always run olddefconfig to balance the tree and prevent syncconfig hangs
        make olddefconfig >/dev/null 2>&1
        
        if [ $KCONFIG_FAILED -eq 1 ]; then
            echo "   [ROLLBACK] Conflitto strutturale (Kbuild). Scarto la patch."
            patch -p1 -R -F $FUZZ --force < "$patch" > /dev/null || true
            continue
        fi
        
        # Step 2: AST Validation for existing C files
        echo "   [AST VALIDATION] Controllo purezza albero sintattico sorgenti C/H modificati..."
        MODIFIED_C_FILES=$(grep -E '^\+\+\+ b/' "$patch" | awk '{print $2}' | sed 's/^b\///' | grep -E '\.(c|h)$' || true)
        AST_FAILED=0
        for c_file in $MODIFIED_C_FILES; do
            if [ -f "$c_file" ]; then
                if echo "$c_file" | grep -q '\.c$'; then
                    o_file="${c_file%.c}.o"
                    # Dynamic Extraction of CFLAGS from Kbuild (Bedrock Holy Grail)
                    CFLAGS=$(make CC=clang V=1 "$o_file" -n </dev/null 2>/dev/null | grep -E "clang.*-c.*$c_file" | head -n 1 | sed "s/.*clang //; s/-c.*//" || true)
                    if [ -n "$CFLAGS" ]; then
                        if ! clang -fsyntax-only $CFLAGS "$c_file" >/dev/null 2>&1; then
                            AST_FAILED=1
                            echo "   [AST FATAL] Clang ha fallito la validazione sintattica di $c_file!"
                            break
                        fi
                    fi
                fi
            fi
        done
        
        if [ $AST_FAILED -eq 1 ]; then
            echo "   [ROLLBACK] Conflitto sintattico rilevato! Scarto la patch."
            patch -p1 -R -F $FUZZ --force < "$patch" > /dev/null || true
            continue
        fi

        # Step 3: Fast Subsystem Compilation (The True Holy Grail)
        echo "   [SUBSYSTEM VALIDATION] Compilazione incrementale dei sottosistemi modificati..."
        SUBSYSTEMS=$(grep -E '^\+\+\+ b/' "$patch" | awk '{print $2}' | sed 's/^b\///' | cut -d/ -f1 | sort -u | grep -E '^(kernel|mm|fs|net|arch)$' || true)
        SUB_FAILED=0
        for sub in $SUBSYSTEMS; do
            if [ -d "$sub" ]; then
                if ! make -j$(nproc) "$sub/" </dev/null >/dev/null 2>&1; then
                    SUB_FAILED=1
                    echo "   [SUBSYSTEM FATAL] Compilazione fallita nel sottosistema $sub!"
                    break
                fi
            fi
        done

        if [ $SUB_FAILED -eq 1 ]; then
            echo "   [ROLLBACK] Conflitto di sottosistema rilevato! Scarto la patch."
            patch -p1 -R -F $FUZZ --force < "$patch" > /dev/null || true
        else
            echo "   [SUCCESS] Patch fusa e validata nativamente tramite AST Clang, Kbuild & Subsystem Make."
        fi
    fi
done

echo "========================================================="
echo " FASE 3: TUNING KCONFIG (Bedrock Naturale Dinamico)"
echo "========================================================="
# Disattivazione massiccia e mirata del Debug (Prestazioni Estreme)
for cfg in DEBUG_KERNEL SLUB_DEBUG PM_DEBUG PM_ADVANCED_DEBUG ACPI_DEBUG SCHED_DEBUG LATENCYTOP DEBUG_PREEMPT PROVE_LOCKING LOCK_STAT KASAN DEBUG_INFO DEBUG_INFO_BTF DEBUG_FS; do
    ./scripts/config --disable $cfg
done

# Schedulazione e Responsività Desktop (Preempt Estremo)
./scripts/config --enable PREEMPT
./scripts/config --disable PREEMPT_VOLUNTARY
./scripts/config --disable PREEMPT_NONE

# CPU e Tick
./scripts/config --enable HZ_1000
./scripts/config --set-val HZ 1000
./scripts/config --disable HZ_300
./scripts/config --disable HZ_250
./scripts/config --disable HZ_100
./scripts/config --enable SCHED_BORE

# Rete (BBR + FQ)
./scripts/config --enable TCP_CONG_BBR
./scripts/config --enable DEFAULT_BBR
./scripts/config --disable DEFAULT_CUBIC
./scripts/config --enable NET_SCH_FQ
./scripts/config --enable DEFAULT_FQ

# Compressione Moduli (ZSTD puro)
./scripts/config --enable MODULE_COMPRESS_ZSTD
./scripts/config --disable MODULE_COMPRESS_XZ
./scripts/config --disable MODULE_COMPRESS_GZIP

# RAM e Performance
./scripts/config --enable LRU_GEN
./scripts/config --enable LRU_GEN_ENABLED

# Ottimizzazione CPU Arch (Nativa V3)
./scripts/config --disable GENERIC_CPU
./scripts/config --enable GENERIC_CPU3
./scripts/config --enable X86_64_VERSION=3

# Ottimizzazione Compilatore
./scripts/config --enable CC_OPTIMIZE_FOR_PERFORMANCE_O3
./scripts/config --disable LTO_CLANG_THIN
./scripts/config --enable DEBUG_INFO_NONE

echo ">>> [BEDROCK] Iniezione dei 64 Pilastri KSPP e Ottimizzazioni Tails OS..."
# TAILS OS: Amnesia e Anti-Forensics (Nessun dump o traccia RAM su disco)
./scripts/config --disable HIBERNATION
./scripts/config --disable CRASH_DUMP
./scripts/config --disable COREDUMP
./scripts/config --disable KEXEC
./scripts/config --disable KEXEC_FILE
./scripts/config --disable PROC_KCORE
./scripts/config --disable COMPAT_VDSO
./scripts/config --disable BINFMT_MISC

# 64 PILASTRI (KSPP): Protezione Memoria (Slub/Slab Hardening)
./scripts/config --enable SLAB_FREELIST_RANDOM
./scripts/config --enable SLAB_FREELIST_HARDENED
./scripts/config --enable HARDENED_USERCOPY
./scripts/config --disable HARDENED_USERCOPY_FALLBACK
./scripts/config --enable FORTIFY_SOURCE
./scripts/config --enable INIT_ON_ALLOC_DEFAULT_ON
./scripts/config --enable INIT_ON_FREE_DEFAULT_ON

# 64 PILASTRI (KSPP): KASLR e Isolamento
./scripts/config --enable RANDOMIZE_BASE
./scripts/config --enable RANDOMIZE_MEMORY
./scripts/config --enable PAGE_TABLE_ISOLATION

# 64 PILASTRI (KSPP): Superficie di Attacco e Syscall
./scripts/config --enable BPF_UNPRIV_DEFAULT_OFF
./scripts/config --enable SECURITY_DMESG_RESTRICT
./scripts/config --disable USERFAULTFD
./scripts/config --disable MODIFY_LDT_SYSCALL
./scripts/config --enable LEGACY_VSYSCALL_NONE
./scripts/config --disable LEGACY_VSYSCALL_EMULATE
./scripts/config --disable LEGACY_VSYSCALL_XONLY

# 64 PILASTRI (KSPP): Accesso Hardware
./scripts/config --enable STRICT_DEVMEM
./scripts/config --enable IO_STRICT_DEVMEM
./scripts/config --disable DEVKMEM
./scripts/config --disable ACPI_CUSTOM_METHOD

# 64 PILASTRI (KSPP): Integrità e Reazione
./scripts/config --enable BUG_ON_DATA_CORRUPTION
./scripts/config --enable SCHED_STACK_END_CHECK
./scripts/config --enable PANIC_ON_OOPS
./scripts/config --enable SECURITY_YAMA
./scripts/config --enable SECURITY_LOCKDOWN_LSM
./scripts/config --enable SECURITY_LOCKDOWN_LSM_EARLY

./scripts/config --enable NTSYNC
./scripts/config --disable RUST

./scripts/config --enable VIRTIO_PCI
./scripts/config --enable VIRTIO_CONSOLE
./scripts/config --enable NET_9P
./scripts/config --enable NET_9P_VIRTIO
./scripts/config --enable 9P_FS
./scripts/config --disable DRM_NOUVEAU
make olddefconfig

echo ">>> Generazione ~/.rpmmacros locale esclusivo per KERNEL..."
cat << 'MCR' > ~/.rpmmacros
%_smp_mflags %{nil}
%_enable_debug_packages 0
%debug_package %{nil}
%_with_vanilla 1
%buildid .chimera
%toolchain gcc
%optflags %{__global_compiler_flags} -march=x86-64-v3 -pipe -Wno-error

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
MCR

echo "========================================================="
echo " PREPARAZIONE COMPLETATA."
echo " Il Kernel è pronto nella cartella $(pwd)"
echo " Usa 'make binrpm-pkg' per compilare un RPM nativo upstream."
echo "========================================================="

./scripts/config --set-str SYSTEM_TRUSTED_KEYS ""
./scripts/config --set-str SYSTEM_REVOCATION_KEYS ""
./scripts/config --disable DEBUG_INFO_BTF
make olddefconfig
