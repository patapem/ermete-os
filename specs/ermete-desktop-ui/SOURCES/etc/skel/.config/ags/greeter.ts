import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { Variable, GLib, bind } from "astal"
import Greet from "gi://AstalGreet?version=0.1"

const password = Variable("")
const isAuthenticating = Variable(false)
const errorMessage = Variable("")

function doLogin() {
    isAuthenticating.set(true)
    errorMessage.set("")
    
    Greet.login("ermete", password.get(), "niri-session", (source, res) => {
        try {
            Greet.login_finish(res)
            // It succeeded, session will start, greetd will replace us
        } catch (e) {
            isAuthenticating.set(false)
            errorMessage.set("Password errata o errore di login.")
            password.set("")
        }
    })
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
                        label: "Bentornato, ermete",
                        css_classes: ["greeter-user"]
                    }),
                    Widget.Entry({
                        placeholder_text: "Password...",
                        visibility: false, // Hide typed text
                        text: bind(password),
                        onChanged: (self) => password.set(self.text),
                        onActivate: doLogin,
                        sensitive: bind(isAuthenticating).as(a => !a)
                    }),
                    Widget.Label({
                        label: bind(errorMessage),
                        css_classes: ["greeter-error"],
                        visible: bind(errorMessage).as(e => e.length > 0)
                    }),
                    Widget.Button({
                        label: "Accedi",
                        onClicked: doLogin,
                        css_classes: ["greeter-login-btn"],
                        sensitive: bind(isAuthenticating).as(a => !a)
                    })
                ]
            })
        })
    })
}
