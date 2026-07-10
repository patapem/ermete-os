import { Variable } from "astal"
import { execAsync } from "astal/process"
import { Widget } from "astal/gtk4"

export const firewallState = Variable("unknown").poll(5000, "systemctl is-active firewalld", (out, prev) => {
    return out.trim() === "active" ? "running" : "stopped"
})

export const FirewallToggle = () => Widget.Button({
    css_classes: firewallState((s) => 
        s === "running" ? ["quick-toggle-btn", "firewall", "active"] : ["quick-toggle-btn", "firewall"]
    ),
    hexpand: true,
    label: firewallState((s) => 
        s === "running" ? "🛡️ Firewall • On" : "🛡️ Firewall • Off"
    ),
    onClicked: () => {
        const action = firewallState.get() === "running" ? "stop" : "start"
        // Mostriamo il polkit nativo per i permessi di root
        execAsync(["pkexec", "systemctl", action, "firewalld"])
            .then(() => {
                setTimeout(() => {
                    execAsync(["firewall-cmd", "--state"])
                        .then(out => firewallState.set(out.trim() === "running" ? "running" : "stopped"))
                        .catch(() => firewallState.set("stopped"))
                }, 1000)
            })
            .catch(err => console.error("Firewall toggle error: ", err))
    }
})
