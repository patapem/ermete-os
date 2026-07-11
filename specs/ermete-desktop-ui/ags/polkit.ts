import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { Variable, bind } from "astal"
import Auth from "gi://AstalAuth"
import { PopupWindow } from "./state"

const currentPrompt = Variable("")
const currentAuthId = Variable("")

export function PolkitAgent() {
    try {
        if (!Auth || !(Auth as any).Polkit || typeof (Auth as any).Polkit.get_default !== "function") {
            return
        }
        const auth = (Auth as any).Polkit.get_default()
        auth.connect("request", (agent: any, id: string, msg: string, icon: string) => {
            const win = App.get_window("polkit")
            if (win) {
                currentPrompt.set(msg)
                currentAuthId.set(id)
                win.visible = true
            }
        })
    } catch (e) {
        console.error("No Polkit Authentication Agent backend available in AstalAuth: ", e)
    }
}

export function PolkitModal() {
    return PopupWindow({
        name: "polkit",
        namespace: "polkit",
        application: App,
        anchor: Astal.WindowAnchor.NONE,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        child: Widget.Box({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ["polkit-modal-container"],
            children: [
                Widget.Label({ 
                    label: "🔒 Autenticazione Richiesta", 
                    css_classes: ["polkit-title"] 
                }),
                Widget.Label({ 
                    label: bind(currentPrompt), 
                    css_classes: ["polkit-msg"], 
                    wrap: true 
                }),
                Widget.Entry({
                    visibility: false,
                    placeholder_text: "Password",
                    onActivate: (self) => {
                        const id = currentAuthId.get()
                        if (id) {
                            Auth.Polkit.get_default().reply(id, self.text)
                        }
                        self.text = ""
                        App.get_window("polkit")!.visible = false
                    }
                }),
                Widget.Button({
                    label: "Annulla",
                    css: "margin-top: 1rem;",
                    onClicked: () => {
                        const id = currentAuthId.get()
                        if (id) {
                            // Empty string o null triggera cancellazione
                            Auth.Polkit.get_default().reply(id, "")
                        }
                        App.get_window("polkit")!.visible = false
                    }
                })
            ]
        })
    })
}
