import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { Variable, GLib, bind } from "astal"
import Gio from "gi://Gio"
import { PopupWindow } from "./state"

// Stato per la richiesta attiva
export const geoclueRequest = Variable<{ app: string, level: number, invocation: Gio.DBusMethodInvocation } | null>(null)

export function initGeoclueAgent() {
    const xml = `
    <node>
      <interface name="org.freedesktop.GeoClue2.Agent">
        <method name="AuthorizeApp">
          <arg type="s" name="desktop_id" direction="in"/>
          <arg type="u" name="req_level" direction="in"/>
          <arg type="b" name="authorized" direction="out"/>
        </method>
        <property name="MaxAccuracyLevel" type="u" access="read"/>
      </interface>
    </node>`;

    const nodeInfo = Gio.DBusNodeInfo.new_for_xml(xml);
    if (!nodeInfo || nodeInfo.interfaces.length === 0) {
        console.error("[Geoclue] Failed to parse XML");
        return;
    }
    const interfaceInfo = nodeInfo.interfaces[0];

    Gio.bus_get(Gio.BusType.SYSTEM, null, (source, res) => {
        try {
            const conn = Gio.bus_get_finish(res);

            conn.register_object(
                "/org/freedesktop/GeoClue2/Agent",
                interfaceInfo,
                // Method call handler
                (conn, sender, objectPath, interfaceName, methodName, parameters, invocation) => {
                    if (methodName === "AuthorizeApp") {
                        const [desktopId, reqLevel] = parameters.deep_unpack();
                        console.log(`[Geoclue] App ${desktopId} requests location (level ${reqLevel})`);
                        
                        geoclueRequest.set({ app: desktopId, level: reqLevel, invocation });
                        
                        const win = App.get_window("geoclue-modal");
                        if (win) win.visible = true;
                    }
                },
                // Get Property handler
                (conn, sender, objectPath, interfaceName, propertyName) => {
                    if (propertyName === "MaxAccuracyLevel") {
                        return new GLib.Variant("u", 4); // 4 = Exact accuracy
                    }
                    return null;
                },
                // Set Property handler
                null
            );

            // Fingiamo di essere il geoclue-demo-agent per bypassare la whitelist hardcoded di sistema
            conn.call(
                "org.freedesktop.GeoClue2",
                "/org/freedesktop/GeoClue2/Manager",
                "org.freedesktop.GeoClue2.Manager",
                "AddAgent",
                new GLib.Variant("(s)", ["geoclue-demo-agent"]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (conn, res) => {
                    try {
                        conn.call_finish(res);
                        console.log("[Geoclue] Agent natively integrated in AGS!");
                    } catch (e) {
                        console.error("[Geoclue] AddAgent failed (whitelist issue?): " + e);
                    }
                }
            );
        } catch(e) {
            console.error("[Geoclue] Bus connection error: " + e);
        }
    });
}

export function GeoclueModal() {
    return PopupWindow({
        name: "geoclue-modal",
        child: Widget.Box({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ["polkit-modal-container"], 
            children: [
                Widget.Label({ 
                    label: "📍 Geolocalizzazione", 
                    css_classes: ["polkit-title"] 
                }),
                Widget.Label({ 
                    label: bind(geoclueRequest).as(req => 
                        req ? `L'applicazione "${req.app}" sta richiedendo l'accesso alla tua posizione geografica.\nConsenti questa azione?` : "Nessuna richiesta attiva."
                    ), 
                    css_classes: ["polkit-msg"], 
                    wrap: true 
                }),
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 12,
                    margin_top: 10,
                    children: [
                        Widget.Button({
                            label: "❌ Rifiuta",
                            hexpand: true,
                            css_classes: ["geoclue-btn-deny"],
                            onClicked: () => {
                                const req = geoclueRequest.get();
                                if (req && req.invocation) {
                                    req.invocation.return_value(new GLib.Variant("(b)", [false]));
                                    geoclueRequest.set(null);
                                }
                                const win = App.get_window("geoclue-modal");
                                if (win) win.visible = false;
                            }
                        }),
                        Widget.Button({
                            label: "✅ Consenti",
                            hexpand: true,
                            css_classes: ["geoclue-btn-allow"],
                            onClicked: () => {
                                const req = geoclueRequest.get();
                                if (req && req.invocation) {
                                    req.invocation.return_value(new GLib.Variant("(b)", [true]));
                                    geoclueRequest.set(null);
                                }
                                const win = App.get_window("geoclue-modal");
                                if (win) win.visible = false;
                            }
                        })
                    ]
                })
            ]
        })
    })
}
