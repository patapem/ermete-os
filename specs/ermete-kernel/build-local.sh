#!/bin/bash
# Ermete OS: The Ultimate Chimera Kernel Bedrock Local Builder
# Riproduce in bit-perfect il workflow di GitHub Actions all'interno di un micro-container OCI locale

set -e

echo ">>> [BEDROCK] Inizializzazione Ambiente di Build Isolato Locale (Fedora 43 OCI)"

# Otteniamo la directory radice del repository
FORGE_DIR=$(git rev-parse --show-toplevel)
CACHE_DIR="$FORGE_DIR/.ccache_local"
mkdir -p "$CACHE_DIR"

echo ">>> [BEDROCK] Esecuzione Container Fedora 43 (Privileged)..."
# Eseguiamo il container mappando la Forgia in /forge
# Nota: La cartella ~/rpmbuild sarà creata internamente al container effimero,
# ma noi mappiamo la ccache all'esterno per preservare i vantaggi di velocità tra le run.
docker run --rm -i \
  --privileged \
  --security-opt label=disable \
  -v "$FORGE_DIR":/forge \
  -w /forge \
  -e GITHUB_WORKSPACE=/forge \
  registry.fedoraproject.org/fedora:43 \
  /bin/bash -c "
    echo '>>> Configurazione DNF (Identica alla CI)...'
    echo 'zchunk=False' >> /etc/dnf/dnf.conf
    echo 'fastestmirror=True' >> /etc/dnf/dnf.conf
    echo 'install_weak_deps=False' >> /etc/dnf/dnf.conf
    
    echo '>>> Installazione Architettura di Compilazione...'
    dnf install -y rpm-build rpmdevtools gcc gcc-c++ make cmake flex bison ncurses-devel elfutils-libelf-devel openssl-devel bc rsync tar wget curl cpio perl zstd git llvm clang lld ccache qemu-kvm stress-ng iperf3 jq gnupg2 hostname skopeo elfutils-devel dwarves openssl
    
    echo '>>> Esecuzione prepare-chimera.sh...'
    bash specs/ermete-kernel/prepare-chimera.sh
    
    KERNEL_DIR=\$(cat ~/rpmbuild/BUILD/.kernel_version)
    cd ~/rpmbuild/BUILD/\$KERNEL_DIR
    
    echo '>>> [BEDROCK] Build Veloce (No PGO) per Sviluppo Locale...'
    ./scripts/config --disable GCOV_KERNEL
    ./scripts/config --disable GCOV_PROFILE_ALL
    
    make olddefconfig
    
    echo '>>> Configurazione CCACHE locale persistente...'
    export PATH=\"/usr/lib64/ccache:/usr/lib/ccache:\$PATH\"
    export CCACHE_DIR=/forge/.ccache_local
    export CCACHE_COMPRESS=1
    export CCACHE_MAXSIZE=10G
    ccache -z
    
    echo '>>> [BEDROCK] Compilazione RPM NATIVA...'
    make -j\$(nproc) binrpm-pkg
    ccache -s
    
    echo '========================================================='
    echo ' BUILD LOCALE COMPLETATA CON SUCCESSO.'
    echo '========================================================='
    echo 'I pacchetti RPM sono disponibili nel container in ~/rpmbuild/RPMS/'
    ls -lh ~/rpmbuild/BUILD/\$KERNEL_DIR/rpmbuild/RPMS/x86_64/
    
    echo \"Copia degli RPM sulla Forgia...\"
    mkdir -p /forge/RPMS_OUT
    cp ~/rpmbuild/BUILD/\$KERNEL_DIR/rpmbuild/RPMS/x86_64/*.rpm /forge/RPMS_OUT/
    echo 'Troverai i file finali in ermete-forge/RPMS_OUT/'
"
