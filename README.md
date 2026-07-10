# 🌋 Ermete Forge

**The ultimate Zero-Trust, high-performance Micro-Container OCI Artifact Builder for Ermete OS.**

This repository acts as the absolute compiler and forge for Ermete OS. It strictly enforces extreme CachyOS-level compiler flags (`-O3`, `-march=x86-64-v3`, `-flto=auto`, `mold` linker) across all built packages, ensuring that Ermete OS receives binaries executing at the absolute physical limit of modern silicon.

## 🏗️ Architecture: Micro-Container OCI (The Golden Rule)
Ermete Forge does **not** rely on legacy HTTP YUM repositories (COPR), nor does it rely on monolithic artifact generation. 
It follows the strict **Micro-Container OCI Architecture** pattern.

### 📜 The Immutable Directive
**Every single package, tool, or component MUST have its own fully isolated job in the CI/CD pipeline and MUST produce its own dedicated `scratch` OCI image.**

* **❌ PROHIBITED:** Grouping multiple packages (e.g., all Rust tools) into a single job or pushing them to a single monolithic `ermete-forge:latest` image.
* **✅ REQUIRED:** Granular jobs pushing to granular containers (`ghcr.io/patapem/ermete-forge-*`).

**Why?**
1. **Total Failure Isolation**: If one tool fails to compile, all other containers are still successfully built, cached, and pushed.
2. **Individual History**: We maintain a perfect, untangled chronological timeline for every single tool.
3. **Absolute RPM Encapsulation**: All configurations, shell scripts, and UI tweaks MUST be compiled as native RPMs. Zero "raw files" are allowed in the OS filesystem.

## 🦅 Il Kernel Agnostico (BORE Nativo)
Allo stato attuale, l'architettura del Kernel Ermete deve rimanere rigorosamente **agnostica e pulita**. 
Ogni tentazione di implementare scheduler eBPF in user-space (come `scx`) è stata sradicata e considerata un anti-pattern prestazionale.
* **BORE Scheduler Integrato**: Ci affidiamo esclusivamente allo scheduler BORE (Burst-Oriented Response Enhancer) integrato nativamente a livello Ring 0, garantendo latenze minime senza sovrastrutture eBPF in user-space. Qualsiasi patch kernel futura (es. CachyOS o TKG) dovrà sottostare alla Matrice di Validazione Universale per preservare l'agnosticismo del sistema base.

## 🧠 Intelligent Cryptographic Caching (Hashing Dinamico)
To reach the technical extreme, the pipeline does not compile blindly.
Before executing `rpmbuild`, `dynamic-matrix.sh` interrogates `skopeo` and GitHub Container Registry. 
* **Patch Text Hashing (Kernel)**: Invece di controllare l'hash globale di un repository upstream (che causa false positive rebuilds), l'orchestratore esegue l'hash *esclusivamente del testo fisico delle patch* (es. `0001-sched-migrate.patch`). Se le patch non cambiano, il kernel restituisce un `CACHE_HIT` immediato, saltando ore di build.

## 🚀 Extreme Optimizations (The Bedrock)
All RPMs built here inherit the global `config/rpmmacros`:
- **C/C++**: `-O3 -march=x86-64-v3 -flto=auto -fuse-ld=mold`
- **Linker**: `-Wl,--as-needed -Wl,--sort-common -Wl,-O2`
- **Rust**: `-C target-cpu=x86-64-v3 -C opt-level=3 -C lto=thin`

## 📦 Assembly Lines (GitHub Actions Orchestrator)
La Forgia sfrutta un Orchestratore Dinamico (`ermete-forge-orchestrator.yml`) che analizza le dipendenze in parallelo (Core, AGS Ecosystem, Desktop, CLI).
Ogni componente estratto viene trasformato istantaneamente in un'immagine `scratch` su GHCR con nomi atomici.

## ⚖️ Le Leggi della Forgia (Project Rules per i Manutentori)
Queste direttive generali garantiscono il mantenimento corretto dell'ecosistema nel tempo.

### 🟢 COSA DEVE ESSERE FATTO (The "Musts")
- **PIPELINE:** Ogni componente o personalizzazione deve essere isolato nel proprio pacchetto RPM nativo e generare un micro-container OCI indipendente.
- **KERNEL:** Se un modulo fallisce, si aggiunge una flag di esclusione `%_without_[nome]` al file `.rpmmacros`. Non si usano patch custom per risolvere conflitti locali del kernel.
- **FRONTEND UI (La Morte di JavaScript):** Il frontend monolitico JS/AGS è stato completamente eliminato a favore di **ermete-shell-rs**. La UI deve essere sviluppata esclusivamente come applicazione GTK4 Layer Shell in puro **Rust nativo**, garantendo zero overhead, immunità al garbage collection e interazione diretta con Wayland tramite GLib. Systemd-User orchestra l'ecosistema.

### 🔴 COSA NON DEVE ESSERE MAI FATTO (The "Never Do's")
- **PIPELINE:** Creare build monolitiche o inserire più progetti non correlati all'interno della stessa pipeline (rompendo la granularità OCI).
- **PIPELINE:** Affidarsi a repository esterni (es. COPR) o scaricare binari pre-compilati non verificati. La Forgia compila nativamente dal sorgente.
- **USERSPACE / FIXING:** Iniettare script bash crudi, file di configurazione non tracciati o applicare "cerotti" applicativi. Qualsiasi deviazione o crash si risolve alla radice (livello Bedrock), rimuovendo i moduli difettosi, mai mascherandoli.

## 🔗 Horizontal Rolling Automation (Zero-Maintenance CI/CD)
Tramite repository dispatches in `trigger-ermete-os.yml`, la Forgia orchestra l'intero ciclo di vita OCI in totale automazione (Ring 0 -> Ring 3). Update a spec -> Auto-rebuild OS.
