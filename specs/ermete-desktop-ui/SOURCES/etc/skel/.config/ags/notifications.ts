import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { Variable, GLib, bind } from "astal"
import AstalNotifd from "gi://AstalNotifd"

const activePopups = new Map<number, Gtk.Widget>()

function NotificationWidget(notif: AstalNotifd.Notification) {
    const icon = notif.image || notif.app_icon || "dialog-information-symbolic"

    return Widget.Box({
        css_classes: ["notification-box"],
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
        children: [
            Widget.Image({
                icon_name: icon,
                pixel_size: 48,
                css_classes: ["notification-icon"]
            }),
            Widget.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                children: [
                    Widget.Label({
                        css_classes: ["notification-summary"],
                        label: notif.summary,
                        xalign: 0,
                        wrap: true,
                        max_width_chars: 40
                    }),
                    Widget.Label({
                        css_classes: ["notification-body"],
                        label: notif.body,
                        xalign: 0,
                        wrap: true,
                        max_width_chars: 40
                    }),
                    Widget.Box({
                        orientation: Gtk.Orientation.HORIZONTAL,
                        spacing: 8,
                        margin_top: 8,
                        children: notif.get_actions().map(a => Widget.Button({
                            label: a.label,
                            hexpand: true,
                            css_classes: ["notification-action-btn"],
                            onClicked: () => {
                                notif.invoke(a.id)
                                notif.dismiss()
                            }
                        }))
                    })
                ]
            })
        ]
    })
}

export function NotificationPopups() {
    const notifd = AstalNotifd.get_default()
    
    const list = Widget.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 10,
        css_classes: ["notification-list"],
        children: []
    })

    const win = Widget.Window({
        name: "notifications",
        namespace: "notifications",
        anchor: Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT,
        exclusivity: Astal.Exclusivity.IGNORE,
        layer: Astal.Layer.OVERLAY,
        margin_top: 60,
        margin_right: 12,
        visible: false,
        child: list
    })

    notifd.connect("notified", (_, id) => {
        const notif = notifd.get_notification(id)
        if (!notif) return

        const widget = NotificationWidget(notif)
        activePopups.set(id, widget)
        list.append(widget)
        
        // Show the window now that it has content
        win.visible = true

        // Remove the widget after 5 seconds visually, without dismissing from the daemon if it hasn't expired
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
            if (activePopups.has(id)) {
                const w = activePopups.get(id)
                if (w) list.remove(w)
                activePopups.delete(id)
                if (activePopups.size === 0) win.visible = false
            }
            return GLib.SOURCE_REMOVE
        })
    })

    notifd.connect("resolved", (_, id) => {
        const widget = activePopups.get(id)
        if (widget) {
            list.remove(widget)
            activePopups.delete(id)
        }
        if (activePopups.size === 0) {
            win.visible = false
        }
    })

    return win
}
