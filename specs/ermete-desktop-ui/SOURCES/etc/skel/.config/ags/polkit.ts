import { App, Astal, Gtk, Gdk } from "astal/gtk4"
import { Variable, bind } from "astal"
import Auth from "gi://AstalAuth"
import { PopupWindow } from "./state"

export function PolkitAgent() {
    const auth = Auth.Polkit.get_default()

    auth.connect("request", (agent, id, msg, icon) => {
        const win = App.get_window("polkit")
        if (win) {
            // Update UI with the prompt message
            currentPrompt.set(msg)
            currentAuthId.set(id)
            win.visible = true
        }
    })
    
    // We would need to handle authentication via auth.reply(id, password)
}

const currentPrompt = Variable("")
const currentAuthId = Variable("")

export function PolkitModal() {
    return PopupWindow({
        name: "polkit",
        child: <box vertical={true} cssClasses={["modal-container"]} css="min-width: 300px; padding: 20px;">
            <label label="Authentication Required" cssClasses={["title"]} css="font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem;" />
            <label label={bind(currentPrompt)} css="margin-bottom: 1rem;" wrap={true} />
            <entry 
                visibility={false}
                placeholderText="Password"
                onActivate={(self) => {
                    const id = currentAuthId.get()
                    if (id) {
                        Auth.Polkit.get_default().reply(id, self.text)
                    }
                    self.text = ""
                    App.get_window("polkit")?.hide()
                }}
            />
        </box>
    })
}
