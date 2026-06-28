# Ermete Kernel (Chimera)

Questa directory contiene l'infrastruttura per generare il Kernel di Ermete OS.
In accordo alla roadmap "Vista da Corvo fino alla Bedrock", l'obiettivo è costruire una **Chimera Prestazionale** isolata in un micro-container OCI.

## Architettura della Chimera
- **Base/Scheduler**: CachyOS (BORE Scheduler, BBRv3, mitigazioni ottimizzate).
- **Patch/Power**: Clear Linux (Boot ultra-veloce, gestione energetica, P-States).
- **Compilazione**: Gentoo-Style (`clang`, `ld.lld`, `-O3`, `-march=x86-64-v3`, `ThinLTO`).

## Flusso della Pipeline (Micro-Container OCI)
1. GitHub Actions lancia `build-kernel.yml`.
2. Esegue `prepare-chimera.sh` per clonare i sorgenti, scaricare le patch e settare le flag LLVM.
3. Compila gli RPM tramite `rpmbuild`.
4. Invia un'immagine `scratch` contenente esclusivamente i file RPM a `ghcr.io/patapem/ermete-forge-kernel:latest`.
5. Ermete OS `Containerfile` assorbirà nativamente il nuovo Kernel senza inquinare lo stato di build del sistema.
