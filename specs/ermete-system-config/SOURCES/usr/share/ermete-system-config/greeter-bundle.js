// ermete-forge/specs/ermete-desktop-ui/ags/app.ts
import { App as App2 } from "astal/gtk4";

// ermete-forge/specs/ermete-desktop-ui/ags/greeter.ts
import { App, Astal, Gtk, Widget } from "astal/gtk4";
import { Variable, GLib, bind, execAsync } from "astal";
import Greet from "gi://AstalGreet?version=0.1";
var password = Variable("");
var isAuthenticating = Variable(false);
var errorMessage = Variable("");
var entryWidget = null;
GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, 15, () => {
  App.quit();
  return GLib.SOURCE_REMOVE;
});
var timeState = Variable("00:00").poll(1e3, () => {
  const d = /* @__PURE__ */ new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
});
var dateState = Variable("").poll(1e3, () => {
  const d = /* @__PURE__ */ new Date();
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
});
function doLogin(entry) {
  if (isAuthenticating.get()) return;
  const pass = password.get();
  if (!pass) {
    errorMessage.set("Inserisci la password");
    triggerShake();
    return;
  }
  isAuthenticating.set(true);
  errorMessage.set("Verifica credenziali...");
  const resetUI = (msg = "Password errata. Riprova.") => {
    try {
      const cancel = new Greet.CancelSession();
      cancel.send(() => {
      });
    } catch (e) {
    }
    isAuthenticating.set(false);
    password.set("");
    const w = entry || entryWidget;
    if (w) w.text = "";
    errorMessage.set(msg);
    triggerShake();
  };
  try {
    const preCancel = new Greet.CancelSession();
    preCancel.send(() => {
      startAuthSession();
    });
  } catch (e) {
    startAuthSession();
  }
  function startAuthSession() {
    const req1 = new Greet.CreateSession({ username: "ermete" });
    req1.send((s1, r1) => {
      try {
        const ans1 = req1.send_finish(r1);
        if (ans1 instanceof Greet.Error) {
          resetUI("Errore di sessione. Riprova.");
          return;
        }
        const req2 = new Greet.PostAuthMesssage({ response: pass });
        req2.send((s2, r2) => {
          try {
            const ans2 = req2.send_finish(r2);
            if (ans2 instanceof Greet.Error) {
              resetUI("Password errata. Riprova.");
              return;
            }
            const req3 = new Greet.StartSession({ cmd: ["/etc/greetd/ermete-session"] });
            req3.send((s3, r3) => {
              try {
                const ans3 = req3.send_finish(r3);
                if (ans3 instanceof Greet.Error) {
                  resetUI("Errore avvio sessione.");
                } else {
                  GLib.spawn_command_line_async("killall -9 niri gjs ags");
                }
              } catch (e) {
                resetUI("Errore avvio sessione.");
              }
            });
          } catch (e) {
            resetUI("Password errata. Riprova.");
          }
        });
      } catch (e) {
        resetUI("Errore di sessione. Riprova.");
      }
    });
  }
}
var shakeTimeout = null;
function triggerShake() {
  if (entryWidget) {
    entryWidget.add_css_class("shake-animation");
    if (shakeTimeout) clearTimeout(shakeTimeout);
    shakeTimeout = setTimeout(() => {
      if (entryWidget) entryWidget.remove_css_class("shake-animation");
    }, 500);
  }
}
function PowerMenu() {
  return Widget.Box({
    css_classes: ["power-menu-greeter"],
    halign: Gtk.Align.END,
    valign: Gtk.Align.END,
    spacing: 16,
    children: [
      Widget.Button({
        css_classes: ["power-btn"],
        onClicked: () => execAsync(["systemctl", "reboot"]),
        child: Widget.Image({ icon_name: "system-reboot-symbolic", pixel_size: 24 })
      }),
      Widget.Button({
        css_classes: ["power-btn"],
        onClicked: () => execAsync(["systemctl", "poweroff"]),
        child: Widget.Image({ icon_name: "system-shutdown-symbolic", pixel_size: 24 })
      })
    ]
  });
}
function Clock() {
  return Widget.Box({
    orientation: Gtk.Orientation.VERTICAL,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.START,
    css_classes: ["greeter-clock-box"],
    children: [
      Widget.Label({
        label: bind(timeState),
        css_classes: ["greeter-time"]
      }),
      Widget.Label({
        label: bind(dateState),
        css_classes: ["greeter-date"]
      })
    ]
  });
}
function Greeter() {
  return Widget.Window({
    name: "greeter",
    application: App,
    anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT,
    exclusivity: Astal.Exclusivity.IGNORE,
    keymode: Astal.Keymode.EXCLUSIVE,
    visible: true,
    layer: Astal.Layer.OVERLAY,
    css_classes: ["greeter-bg-blur"],
    child: Widget.Overlay({
      child: Widget.Box({
        expand: true,
        css_classes: ["greeter-container"]
      }),
      overlays: [
        Clock(),
        Widget.CenterBox({
          centerWidget: Widget.Box({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ["greeter-login-box"],
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.CENTER,
            spacing: 24,
            children: [
              Widget.Box({
                css_classes: ["greeter-avatar-box"],
                halign: Gtk.Align.CENTER,
                child: Widget.Image({
                  icon_name: "avatar-default-symbolic",
                  pixel_size: 48,
                  css_classes: ["greeter-avatar"]
                })
              }),
              Widget.Label({
                label: "Ermete",
                css_classes: ["greeter-user"]
              }),
              Widget.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8,
                children: [
                  Widget.Entry({
                    placeholder_text: "Password...",
                    visibility: false,
                    css_classes: ["greeter-entry"],
                    onChanged: (self) => password.set(self.text),
                    onActivate: (self) => doLogin(self),
                    sensitive: bind(isAuthenticating).as((a) => !a),
                    setup: (self) => {
                      entryWidget = self;
                      setTimeout(() => self.grab_focus(), 100);
                    }
                  }),
                  Widget.Label({
                    label: bind(errorMessage),
                    css_classes: ["greeter-error"],
                    visible: bind(errorMessage).as((e) => e.length > 0)
                  })
                ]
              }),
              Widget.Button({
                child: Widget.Image({ icon_name: "go-next-symbolic", pixel_size: 24 }),
                css_classes: ["greeter-submit-btn"],
                halign: Gtk.Align.CENTER,
                onClicked: doLogin,
                sensitive: bind(isAuthenticating).as((a) => !a)
              })
            ]
          })
        }),
        PowerMenu()
      ]
    })
  });
}

// ermete-forge/specs/ermete-desktop-ui/ags/app.ts
import GLib2 from "gi://GLib";
App2.start({
  css: `${GLib2.get_home_dir()}/.config/ags/style.css`,
  main() {
    if (GLib2.getenv("GREETD_SOCK")) {
      Greeter();
      return;
    }
    console.log("Desktop Shell is handled by ermete-shell-rs. AGS is only used for the Greeter here.");
    App2.quit();
  }
});
