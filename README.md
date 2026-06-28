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

## 📦 Assembly Lines (Current Micro-Containers)
All containers are pushed as `scratch` images (containing only `.rpm` files in the root directory) to `ghcr.io/patapem/`:
1. `ermete-forge-selinux:latest` - Custom security policies.
2. `ermete-forge-nvidia:latest` - KMODs compiled against the latest CachyOS kernel.
3. `ermete-forge-ags:latest` - Ring 3 UX shell.
4. `ermete-forge-starship:latest` - Rust-based shell prompt.
5. `ermete-forge-matugen:latest` - Rust-based color generation.
6. `ermete-forge-bibata:latest` - Cursor tarballs converted to RPMs.

*(Maintainers: When adding a new package, duplicate an existing job, update the hashes, and push to a NEW dedicated image name using native Fedora OCI `buildah` logic).*
