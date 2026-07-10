import { Variable } from "astal"
import { execAsync } from "astal/process"
import { Widget } from "astal/gtk4"

// Controlla lo stato di OSTree ogni 60 secondi
export const updateState = Variable({ pendingReboot: false, statusText: "Controllo..." }).poll(60000, "rpm-ostree status", (out) => {
    // Cerchiamo le righe dei deployment
    const lines = out.split("\n").filter(l => l.trim().startsWith("ostree-") || l.trim().startsWith("● ostree-"))
    
    // Se la riga col pallino "●" (quella attualmente avviata) NON è la prima della lista, 
    // significa che c'è un aggiornamento scaricato e pronto per il reboot.
    const pendingReboot = lines.length > 0 && !lines[0].includes("●")
    
    return {
        pendingReboot,
        statusText: pendingReboot ? "Riavvio Necessario" : "Sistema Aggiornato"
    }
})

export const UpdaterButton = () => Widget.Button({
    css_classes: updateState((s) => 
        s.pendingReboot ? ["quick-toggle-btn", "updater", "active", "warning"] : ["quick-toggle-btn", "updater"]
    ),
    hexpand: true,
    label: updateState((s) => `🚀 OS: ${s.statusText}`),
    onClicked: () => {
        // Se si clicca, apre un terminale per lanciare l'upgrade o mostrare lo status
        execAsync(["foot", "sh", "-c", "echo 'Avvio ricerca aggiornamenti nella Forgia...'; rpm-ostree upgrade; echo ''; read -p 'Premi Invio per uscire...'"])
            .catch(err => console.error(err))
    }
})
