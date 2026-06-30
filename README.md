# 🌋 Ermete Forge

**The ultimate Zero-Trust, high-performance Micro-Container OCI Artifact Builder for Ermete OS.**

This repository acts as the absolute compiler and forge for Ermete OS. It strictly enforces extreme CachyOS-level compiler flags (`-O3`, `-march=x86-64-v3`, `-flto=auto`, `mold` linker) across all built packages, ensuring that Ermete OS receives binaries executing at the absolute physical limit of modern silicon.

## 🏗️ Architecture: Micro-Container OCI (The Golden Rule)
Ermete Forge does **not** rely on legacy HTTP YUM repositories (COPR), nor does it rely on monolithic artifact generation. 
It follows the strict **Micro-Container OCI Architecture** pattern.

### 📜 The Immutable Directive
**Every single package, tool, or component MUST have its own fully isolated job in the CI/CD pipeline and MUST produce its own dedicated `scratch` OCI image.**

* **❌ PROHIBITED:** Grouping multiple packages (e.g., all Rust tools) into a single job or pushing them to a single monolithic `ermete-forge:latest` image.
* **✅ REQUIRED:** Granular jobs (e.g., `build-starship`, `build-matugen`) pushing to granular containers (`ghcr.io/patapem/ermete-forge-starship:latest`).

**Why?**
1. **Total Failure Isolation**: If one tool fails to compile due to experimental flags, all other containers are still successfully built, cached, and pushed.
2. **Individual History**: We maintain a perfect, untangled chronological timeline for every single tool.
3. **Granular Consumption**: `ermete os` can selectively `COPY --from=...` only the exact dependencies it needs dynamically, discarding the rest.
4. **Absolute RPM Encapsulation**: All configurations, shell scripts, and UI tweaks MUST be compiled as native RPMs. Zero "raw files" are allowed in the OS filesystem.

## 🌡️ Kernel PGO (Profile-Guided Optimization) Manifesto
The Trismegistus Kernel is compiled using an advanced empirical profiling pipeline (PGO).
1. **Instrumentation**: The kernel is initially compiled with GCOV sensors (`CONFIG_GCOV_KERNEL`).
2. **QEMU Agnostic Stress**: This "spy" kernel boots in a QEMU virtual machine. To bypass the lack of an initramfs, it uses **9pfs** to natively mount the host container's filesystem (`rootfstype=9p rootflags=trans=virtio`). A stress script (`qemu_init_stress.sh`) running as PID 1 inflames the Scheduler, VFS, and Net Stack using `stress-ng` and `iperf3`.
3. **Extraction**: The `.gcda` thermal maps are dumped from `/sys/kernel/debug/gcov` via the 9pfs shared folder.
4. **Crystallization**: GCOV is disabled, and the final kernel is packaged natively (`make binrpm-pkg`) by instructing GCC to use the extracted thermal map (`-fprofile-use`). This produces a binary that is perfectly tailored to real-world extreme loads.

## 🧠 Intelligent Cryptographic Caching
To reach the technical extreme, the pipeline does not compile blindly.
Before executing `rpmbuild`, each job calculates a SHA-256 hash of its `specs/` directory, `rpmmacros`, or queries the upstream CachyOS kernel version. 
If the hash matches the previous run, compilation is bypassed entirely, and RPMs are restored from cache. This reduces CI time from minutes to seconds.

## 🚀 Extreme Optimizations (The Bedrock)
All RPMs built here inherit the global `config/rpmmacros`:
- **C/C++**: `-O3 -march=x86-64-v3 -flto=auto -fuse-ld=mold`
- **Linker**: `-Wl,--as-needed -Wl,--sort-common -Wl,-O2`
- **Rust**: `-C target-cpu=x86-64-v3 -C opt-level=3 -C lto=thin`
- **AGS**: Built dynamically via LLVM/Clang with Polly optimizations (`-mllvm -polly`) and `mimalloc`.

## 📦 Assembly Lines (The Orchestrator)
Invece di script isolati per ogni pacchetto, la Forgia sfrutta un **Orchestratore Topologico Locale** (`bedrock_forge_local.sh`). Questo script analizza un DAG (Directed Acyclic Graph) delle dipendenze per compilare prima i core (come `astal-io`, `astal-gjs`) e poi i layer superiori (`hyprpanel`, `aylurs-gtk-shell`).

Ogni componente estratto viene trasformato istantaneamente in un'immagine `scratch` su GHCR con nomi atomici e standardizzati, senza prefissi ridondanti:
- `ghcr.io/patapem/ermete-forge/astal-*`: Binding nativi per lo sviluppo UI
- `ghcr.io/patapem/ermete-forge/hyprpanel`: Pannello ultra-reattivo forzato via RPM overriding
- `ghcr.io/patapem/ermete-forge/ermete-kernel`: Il Kernel Trismegistus PGO
- `ghcr.io/patapem/ermete-forge/ermete-niri-session`: Configurazione e sessione di Window Management incapsulata in `.spec`

*(Maintainers: Qualsiasi nuova directory aggiunta in `specs/` verrà processata e pushato dinamicamente in base alla priorità dichiarata nel Makefile/Orchestratore).*
