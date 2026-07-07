import { App, Astal, Gtk, Gdk } from "astal/gtk4"
import { Variable, GLib, bind, execAsync } from "astal"
import { PopupWindow } from "./state"

export const clipboardHistory = Variable<string[]>([])

export function loadClipboard() {
    execAsync("cliphist list").then(out => {
        clipboardHistory.set(out.split('\n').filter(Boolean))
    }).catch(console.error)
}

function selectItem(item: string) {
    execAsync(["sh", "-c", `echo "${item}" | cliphist decode | wl-copy`]).then(() => {
        App.get_window("clipboard")?.hide()
    }).catch(console.error)
}

export function ClipboardModal() {
    return PopupWindow({
        name: "clipboard",
        child: <box vertical={true} cssClasses={["modal-container"]} css="min-width: 400px; min-height: 500px;">
            <label label="Clipboard History" cssClasses={["title"]} css="font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem;" />
            <scrollwindow hexpand={true} vexpand={true}>
                <box vertical={true} spacing={5}>
                    {bind(clipboardHistory).as(items => items.map(item => (
                        <button
                            onClicked={() => selectItem(item)}
                            cssClasses={["app-btn"]}
                            css="text-align: left; padding: 10px;"
                        >
                            <label label={item.length > 50 ? item.substring(0, 50) + "..." : item} truncate={true} xalign={0} />
                        </button>
                    )))}
                </box>
            </scrollwindow>
        </box>
    })
}
