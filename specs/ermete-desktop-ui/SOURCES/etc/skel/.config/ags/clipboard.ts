import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { Variable, bind } from "astal"
import { execAsync } from "astal/process"
import { PopupWindow, toggleExclusiveModal } from "./state"

// Variabile reattiva che interroga la clipboard
export const clipboardItems = Variable<string[]>([]).poll(1000, ["/home/ermete/.local/bin/cliphist", "list"], (out) => {
    return out.split("\n").filter(l => l.trim() !== "")
})

export function ClipboardModal() {
    return PopupWindow({
        name: "clipboard",
        namespace: "clipboard",
        child: Widget.Box({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ["clipboard-modal-container"],
            children: [
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    margin_bottom: 16,
                    children: [
                        Widget.Label({
                            label: "📋 Cronologia Appunti",
                            css_classes: ["clipboard-title"],
                            hexpand: true,
                            xalign: 0
                        }),
                        Widget.Button({
                            label: "🗑️ Pulisci",
                            css_classes: ["clipboard-wipe-btn"],
                            onClicked: () => {
                                execAsync(["/home/ermete/.local/bin/cliphist", "wipe"]).catch(err => console.error(err))
                            }
                        })
                    ]
                }),
                (() => {
                    const scroll = new Gtk.ScrolledWindow({
                        vexpand: true,
                        css_classes: ["clipboard-scroll"],
                        hscrollbar_policy: Gtk.PolicyType.NEVER,
                        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                    });
                    const innerBox = Widget.Box({
                        orientation: Gtk.Orientation.VERTICAL,
                        spacing: 8,
                        children: bind(clipboardItems).as(items => {
                            if (items.length === 0) {
                                return [Widget.Label({ 
                                    label: "Nessun elemento copiato.", 
                                    css_classes: ["clipboard-empty-msg"]
                                })]
                            }
                            return items.map(item => {
                                // cliphist list restituisce: "123\tTesto copiato..."
                                const parts = item.split("\t")
                                const preview = parts.slice(1).join("\t") || "Oggetto binario / Immagine"
                                
                                return Widget.Button({
                                    css_classes: ["clipboard-item-btn"],
                                    child: Widget.Label({
                                        label: preview,
                                        truncate: true,
                                        max_width_chars: 50,
                                        xalign: 0
                                    }),
                                    onClicked: () => {
                                        // Sfuggiamo gli apici singoli per la shell
                                        const safeItem = item.replace(/'/g, "'\\''")
                                        execAsync(["sh", "-c", `echo -n '${safeItem}' | /home/ermete/.local/bin/cliphist decode | wl-copy`])
                                            .then(() => toggleExclusiveModal("clipboard"))
                                            .catch(err => console.error("Errore decodifica: ", err))
                                    }
                                })
                            })
                        })
                    })
                    scroll.set_child(innerBox)
                    return scroll
                })()
            ]
        })
    })
}
