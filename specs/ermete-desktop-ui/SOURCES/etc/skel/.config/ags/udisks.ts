import { Variable } from "astal"
import { execAsync } from "astal/process"

// UDisks Monitor - Intercetta l'inserimento di chiavette USB
export function UDisksMonitor() {
    console.log("Inizializzazione UDisks2 Monitor (AGS Native)...")
    
    Variable("").watch("udisksctl monitor", (out) => {
        // Esempio output: "Added /org/freedesktop/UDisks2/block_devices/sdb1"
        if (out.includes("Added /org/freedesktop/UDisks2/block_devices/") && !out.includes("loop")) {
            const match = out.match(/block_devices\/([a-zA-Z0-9]+)/)
            if (match && match[1]) {
                const dev = match[1]
                
                // Diamo 1 secondo a UDisks per leggere la tabella partizioni
                setTimeout(() => {
                    execAsync(["lsblk", "-J", "-o", "NAME,MOUNTPOINT,TYPE,SIZE", `/dev/${dev}`])
                        .then(res => {
                            try {
                                const parsed = JSON.parse(res)
                                const block = parsed.blockdevices?.[0]
                                
                                // Interveniamo solo se è una partizione non montata
                                if (block && block.type === "part" && !block.mountpoints?.[0] && !block.mountpoint) {
                                    console.log(`Rilevata nuova partizione: ${dev}`)
                                    
                                    // Sfruttiamo notify-send con Azioni (-A). 
                                    // Il demone notifiche nativo di AGS lo intercetterà mostrando i pulsanti!
                                    execAsync([
                                        "notify-send", 
                                        "-A", "mount=Monta", 
                                        "-A", "ignore=Ignora", 
                                        "-u", "normal",
                                        "-i", "drive-removable-media", 
                                        "Nuova Memoria Rilevata", 
                                        `Trovato volume /dev/${dev} (${block.size}).\nVuoi montarlo ora?`
                                    ]).then(action => {
                                        if (action.trim() === "mount") {
                                            execAsync(["udisksctl", "mount", "-b", `/dev/${dev}`])
                                                .then(mountOut => {
                                                    execAsync(["notify-send", "-i", "drive-harddisk", "Volume Montato", mountOut.trim()])
                                                })
                                                .catch(err => {
                                                    execAsync(["notify-send", "-i", "dialog-error", "Errore", "Impossibile montare il volume."])
                                                })
                                        }
                                    }).catch(() => {})
                                }
                            } catch (e) {
                                console.error("Errore nel parsing lsblk: ", e)
                            }
                        }).catch(() => {})
                }, 1000)
            }
        }
        return out
    })
}
