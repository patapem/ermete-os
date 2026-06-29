# 🦅 Ermete Chimera Kernel - Documentazione Architetturale Definitiva

Questa documentazione rappresenta il "Testo Sacro" del kernel di Ermete OS. Ogni scelta tecnica, dall'astrazione ad alto livello fino alla singola macro di compilazione (filosofia *"Vista da Corvo fino alla Bedrock"*), è esplicitata, spiegata e motivata per garantire una manutenibilità assoluta.

---

## 1. Visione Olistica e Architettura a Micro-Container
Il kernel non è un monolite statico agganciato all'OS, ma un modulo ibrido isolato. L'intera compilazione avviene tramite la pipeline `ermete-forge`, che impacchetta i binari generati (RPM) all'interno di un'immagine container `scratch` purissima inviata a GHCR (GitHub Container Registry). 
* **Vantaggio**: Zero inquinamento dell'host build. `ermete-os` può ingerire i binari del kernel pullando semplicemente i file nativi, mantenendo una cronologia individuale per la cache e il deployment.
* **Agnosticismo Driver**: Il kernel base è privo di codice proprietario. Il modulo NVIDIA (Akmods, ecc.) viene mantenuto all'esterno dell'albero del kernel, in un modulo/layer separato.

---

## 2. Il Paradigma della "Chimera" (Base Fedora + CachyOS + Clear Linux)
Al posto di ricompilare ciecamente il kernel vanilla, Ermete usa il kernel base di Fedora (Rawhide/Branched) come solida intelaiatura di sistema, su cui applichiamo dinamicamente in tempo di build un arsenale di patch ad alte prestazioni estrapolate dai migliori progetti del mondo Linux.

### CachyOS (Prestazioni Brute e Responsività)
* **Scheduler BORE (Burst-Oriented Response Enhancer)**: Sostituisce la latenza del CFS standard, bilanciando in modo aggressivo compiti interattivi (Desktop/Gaming) rispetto a processi di calcolo in background.
* **BBRv3**: L'algoritmo di congestione TCP di ultimissima generazione per massimizzare il throughput di rete.

### Clear Linux (Ottimizzazioni Branch/Scheduler)
* **Branch Hints basati su gcov**: Patch chirurgiche per aggiungere `likely/unlikely` hints in chiamate di sistema critiche e core dello scheduler, ottimizzando le predizioni di salto della CPU.
* *(Nota Storica)*: Inizialmente avevamo previsto patch su P-State e fastboot, ma per mantenere la purezza della codebase (Fuzz 0) ci siamo concentrati solo su hint dello scheduler.

---

## 3. Gestione Difensiva delle Patch (Bedrock Patching)
Le patch vengono applicate tramite lo script `prepare-chimera.sh` con una logica draconiana.
* **Strict Fuzz 0**: Non sono ammesse patch fuzzy (che si applicano a offset sballati rischiando di corrompere l'AST C inserendo frammenti di codice all'interno di commenti, causando errori `Error: expected identifier`).
* **Dry-run Evaluation**: Ogni patch di Clear Linux o CachyOS viene prima validata con `patch --dry-run`. Se non matcha perfettamente la versione del kernel, viene ignorata per non compromettere la build. (Attualmente, per via di `Fuzz 0`, una larga percentuale di patch CachyOS e 4 su 5 patch di Clear Linux vengono scartate).
* *Roadmap Futura (Il Santo Graal)*: Verrà implementato il "Fuzzing con Validazione Sintattica AST", dove si tenta l'applicazione fuzzy, si genera un check sintattico con `clang -fsyntax-only` e se l'Albero Sintattico C risulta puro e inviolato, la patch viene consolidata.

---

## 4. Toolchain Estrema (Gentoo-Style)
In Fedora il kernel è storicamente compilato con GCC. Noi lo sradichiamo e forziamo l'intero albero (incluso l'assembler) su **LLVM/Clang** iniettando macro globali `~/.rpmmacros`.

* **`%_with_toolchain_clang 1`**: L'intero codice è parsato da Clang. Genera oltre 3000 *warning* di inizializzazione costanti non sicure (es. `-Wdefault-const-init-var-unsafe`), che abbiamo silenziato (non fatali) ignorandoli deliberatamente per conformità.
* **LTO Abilitato (`%_with_clang_lto 1`)**: Link-Time Optimization. Il linker di LLVM (lld) analizza globalmente l'intero codice binario eliminando codice morto e ottimizzando chiamate tra funzioni tra moduli distanti, una manovra che incrementa visibilmente l'IPC (Instructions Per Clock).
* **Architettura `-march=x86-64-v3`**: Non supportiamo hardware obsoleto. L'intera suite di binari (compresi tutti i Makefile del kernel, sovrascritti via `%optflags`) utilizza set di istruzioni AVX/AVX2 nativi per architetture moderne come il Ryzen 5800X3D.

---

## 5. Decisioni di Esclusione e Ablazione Moduli (Debloat)
Per garantire stabilità "Bedrock" e dimezzare i tempi di build (da 3 ore a pochi minuti su hardware locale tramite GitHub Runner), intere sezioni del kernel sono state piallate:

### 5.1 Rimozione di Rust (`CONFIG_RUST is not set`)
* **Problema Causa Reale**: Tentando di fondere il toolchain LLVM nativo con il supporto Rust nel kernel, `rustc` andava in crash per l'assenza del supporto alla flag `-Z no-jump-tables` (necessaria al compilatore del kernel) sulla toolchain stabile di Fedora.
* **Scelta Bedrock**: Non si applicano fix alla cieca. Per Ermete OS, l'implementazione Rust nel kernel attualmente è considerata acerba (nessun modulo essenziale vi si affida). Rimuoverla ha annichilito i tempi di compilazione e reso l'albero di build titanicamente più stabile.

### 5.2 Estirpazione Tools e Documentazione
Le seguenti macro sono state iniettate in RPM per evitare di scaricare montagne di dipendenze user-space (come `asciidoc` o `python-sphinx`) e disattivare la compilazione di moduli non necessari al boot del sistema operativo:
* `%_without_tools 1`
* `%_without_perf 1` e `%_without_libperf 1`
* `%_without_ynl 1` e `%_without_bpftool 1`
* `%_without_selftests 1`
* **L'effetto**: Questo spegne la fase `install_doc` di Make che in precedenza schiantava l'intera pipeline richiedendo parser XML arcaici per costruire le pagine di manuale.

### 5.3 Azzeramento Debug
* `%_without_debug 1`, `%_without_debuginfo 1`, `CONFIG_DEBUG_INFO_NONE=y`
* Il kernel DWARF debug bloat può pesare fino a svariati Gigabyte. Trattandosi di un'immagine Desktop OS/Gaming prodotta via OCI, ogni forma di simbolo di debug è stata letteralmente bruciata via per comprimere la grandezza finale del file `.rpm`.

---

## 6. Il Lifecycle RPM
Nel nostro `kernel.spec`, anche la fase di packaging è stata hackerata per scopi prestazionali.
Dovendo inserire gli RPM dentro un micro-container Docker, impiegare tempo CPU (Single-Thread spesso) per comprimere il file RPM con XZ o ZSTD era stupido e ridondante, visto che il demone OCI (Docker/Podman) effettua già una sua compressione layer gzip. Per questo motivo l'RPM payload è impostato al volo su `w0.gzdio` (nessuna compressione RPM reale).

## 7. Mantenimento Futuro
Se una build del kernel dovesse fallire al rilascio di un nuovo Fedora Branch:
1. Controlla prima il log dei task in `prepare-chimera.sh` (fallimento patch).
2. Usa l'ecoscandaglio: Se un modulo fallisce (es. uno script in python o ruby, in `tools/`), individua la flag `%_without_[nome]` corrispondente nel file `.spec` e spegnila dal nostro script bash aggiungendola al file `~/.rpmmacros`.
3. Non compromettere l'integrità del kernel con workaround locali. La soluzione giusta è sempre a livello di configurazione (Bedrock), mai applicando "cerotti" applicativi.
