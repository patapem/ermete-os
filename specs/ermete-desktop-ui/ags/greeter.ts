import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { Variable, GLib, bind, execAsync } from "astal"
import Greet from "gi://AstalGreet?version=0.1"

const password = Variable("")
const isAuthenticating = Variable(false)
const errorMessage = Variable("")

let entryWidget: any = null

GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
    App.quit()
    return GLib.SOURCE_REMOVE
})

function doLogin(entry?: any) {
    if (isAuthenticating.get()) return
    const pass = password.get()
    if (!pass) {
        errorMessage.set("Inserisci la password")
        return
    }

    isAuthenticating.set(true)
    errorMessage.set("Verifica credenziali...")

    const resetUI = (msg = "Password errata. Riprova.") => {
        try {
            const cancel = new Greet.CancelSession()
            cancel.send(() => {})
        } catch (e) {}

        isAuthenticating.set(false)
        password.set("")
        const w = entry || entryWidget
        if (w) w.text = ""
        errorMessage.set(msg)
    }

    try {
        const preCancel = new Greet.CancelSession()
        preCancel.send(() => {
            startAuthSession()
        })
    } catch (e) {
        startAuthSession()
    }

    function startAuthSession() {
        const req1 = new Greet.CreateSession({ username: "ermete" })
        req1.send((s1, r1) => {
            try {
                const ans1 = req1.send_finish(r1)
                if (ans1 instanceof Greet.Error) {
                    resetUI("Errore di sessione. Riprova.")
                    return
                }
                const req2 = new Greet.PostAuthMesssage({ response: pass })
                req2.send((s2, r2) => {
                    try {
                        const ans2 = req2.send_finish(r2)
                        if (ans2 instanceof Greet.Error) {
                            resetUI("Password errata. Riprova.")
                            return
                        }
                        const req3 = new Greet.StartSession({ cmd: ["/etc/greetd/ermete-session"] })
                        req3.send((s3, r3) => {
                            try {
                                const ans3 = req3.send_finish(r3)
                                if (ans3 instanceof Greet.Error) {
                                    resetUI("Errore avvio sessione.")
                                } else {
                                    GLib.spawn_command_line_async("killall -9 niri gjs ags")
                                }
                            } catch (e) {
                                resetUI("Errore avvio sessione.")
                            }
                        })
                    } catch (e) {
                        resetUI("Password errata. Riprova.")
                    }
                })
            } catch (e) {
                resetUI("Errore di sessione. Riprova.")
            }
        })
    }
}

export function Greeter() {
    return Widget.Window({
        name: "greeter",
        application: App,
        anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: true,
        layer: Astal.Layer.OVERLAY,
        css_classes: ["greeter-bg"],
        child: Widget.CenterBox({
            centerWidget: Widget.Box({
                orientation: Gtk.Orientation.VERTICAL,
                css_classes: ["greeter-box"],
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                children: [
                    Widget.Label({
                        label: "Ermete OS",
                        css_classes: ["greeter-title"]
                    }),
                    Widget.Label({
                        label: "Ermete",
                        css_classes: ["greeter-user"]
                    }),
                    Widget.Entry({
                        placeholder_text: "Password di accesso...",
                        visibility: false,
                        onChanged: (self) => password.set(self.text),
                        onActivate: (self) => doLogin(self),
                        sensitive: bind(isAuthenticating).as(a => !a),
                        setup: (self) => {
                            entryWidget = self
                            self.grab_focus()
                        }
                    }),
                    Widget.Label({
                        label: bind(errorMessage),
                        css_classes: ["greeter-error"],
                        visible: bind(errorMessage).as(e => e.length > 0)
                    }),
                    Widget.Button({
                        label: bind(isAuthenticating).as(a => a ? "Autenticazione in corso..." : "Accedi"),
                        onClicked: doLogin,
                        css_classes: ["greeter-login-btn"],
                        sensitive: bind(isAuthenticating).as(a => !a)
                    })
                ]
            })
        })
    })
}
