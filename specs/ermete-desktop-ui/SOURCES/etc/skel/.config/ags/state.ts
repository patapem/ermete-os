import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { Variable, GLib } from "astal"
import { execAsync } from "astal/process"
import AstalApps from "gi://AstalApps"


export function PopupWindow(args: any) {
    const { name, anchor, child, marginTop = 0, marginRight = 0, marginLeft = 0, marginBottom = 0 } = args;
    const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor;
    
    let halign = Gtk.Align.CENTER;
    let valign = Gtk.Align.CENTER;
    
    if (anchor & LEFT) halign = Gtk.Align.START;
    else if (anchor & RIGHT) halign = Gtk.Align.END;
    
    if (anchor & TOP) valign = Gtk.Align.START;
    else if (anchor & BOTTOM) valign = Gtk.Align.END;
    
    let clickedInside = false;
    
    return Widget.Window({
        name,
        namespace: name,
        application: App,
        anchor: TOP | BOTTOM | LEFT | RIGHT,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        layer: Astal.Layer.TOP,
        child: Widget.Overlay({
            child: Widget.Box({
                expand: true,
                css_classes: ["modal-bg-barrier"],
                setup: (self) => {
                    const click = new Gtk.GestureClick()
                    click.connect("released", () => {
                        if (!clickedInside) {
                            const win = App.get_window(name)
                            if (win && win.visible) win.visible = false
                        }
                        clickedInside = false; // reset
                    })
                    self.add_controller(click)
                }
            }),
            setup: (self) => {
                const innerBox = Widget.Box({
                    halign,
                    valign,
                    marginTop,
                    marginRight,
                    marginLeft,
                    marginBottom,
                    setup: (inner) => {
                        const innerClick = new Gtk.GestureClick()
                        innerClick.connect("pressed", () => {
                            clickedInside = true;
                        })
                        inner.add_controller(innerClick)
                    },
                    child: child
                })
                self.add_overlay(innerBox)
            }
        })
    });
}

// --- REACTIVE STATE VARIABLES ---
export const timeState = Variable("00:00")
export const dateState = Variable("Dom 1 Gen")
export const uptimeState = Variable("0h 0m")
export const cpuUsage = Variable("0%")
export const ramUsage = Variable("0%")
export const caffeineState = Variable(false)

export const wifiState = Variable("Scansione...")
export const btState = Variable("Off")

export const isPlaying = Variable(false)
export const mediaTrack = Variable("Nessun media")
export const niriWorkspaces = Variable("[]")

export const volState = Variable("VOL • 80%")
export const volVal = Variable(80).poll(2000, () => {
    const out = execSync("wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null")
    if (!out) return 80
    if (out.includes("[MUTED]")) return 0
    const match = out.match(/Volume:\s+([0-9.]+)/)
    return match ? Math.round(parseFloat(match[1]) * 100) : 80
})
export const micVal = Variable(70).poll(3000, () => {
    const out = execSync("wpctl get-volume @DEFAULT_AUDIO_SOURCE@ 2>/dev/null")
    if (!out) return 70
    if (out.includes("[MUTED]")) return 0
    const match = out.match(/Volume:\s+([0-9.]+)/)
    return match ? Math.round(parseFloat(match[1]) * 100) : 70
})
export const brightVal = Variable(90)
export const battState = Variable("PWR • 95%")
export const mediaArtist = Variable("Ermete Media")
export const diskUsage = Variable("45 GB")

// --- INTERACTIVE LISTS & AUDIO MIXER STATE ---
export const wifiExpanded = Variable(true)
export const btExpanded = Variable(true)
export const wifiList = Variable<{ ssid: string; signal: string; sec: string; active: boolean }[]>([])
export const btList = Variable<{ mac: string; name: string; connected: boolean }[]>([])

export const audioSinks = Variable<{ id: string; name: string; desc: string; active: boolean }[]>([])
export const audioSources = Variable<{ id: string; name: string; desc: string; active: boolean }[]>([])
export const appStreams = Variable<{ id: string; name: string; vol: number; mute: boolean }[]>([])

export const decoder = new TextDecoder()
export function execSync(cmd: string): string {
    try {
        const escapedCmd = cmd.replace(/'/g, "'\\''");
        const res = GLib.spawn_command_line_sync(`sh -c '${escapedCmd}'`)
        if (res[0] && res[1]) {
            return decoder.decode(res[1]).trim()
        }
    } catch {}
    return ""
}

// --- MODAL MANAGEMENT (EXCLUSIVE OPEN) ---
export const allModals = ["wifi-modal", "bt-modal", "audio-modal", "quick-settings", "sys-monitor", "media-player", "calendar", "launcher", "powermenu", "spotlight", "clipboard"]
export let lastFocusLoss = 0

export function toggleExclusiveModal(name: string) {
    if (Date.now() - lastFocusLoss < 150) return

    const win = App.get_window(name)
    if (win && win.visible) {
        win.visible = false
    } else {
        allModals.forEach(m => {
            if (m !== name) {
                const w = App.get_window(m)
                if (w && w.visible) w.visible = false
            }
        })
        if (win) win.visible = true
    }
}

// --- SYSTEM TELEMETRY POLLING ---
// Migrated to async commands or intervals to prevent GTK thread blocking!

// Time and Date (Fast and lightweight)
setInterval(() => {
    timeState.set(GLib.DateTime.new_now_local().format("%H:%M") || "00:00")
}, 1000)

setInterval(() => {
    dateState.set(GLib.DateTime.new_now_local().format("%a %d %b") || "")
}, 60000)

// Uptime (Async Shell)
setInterval(() => {
    execAsync("uptime -p").then(out => uptimeState.set(out.replace("up ", "UP ") || "UP Active")).catch(() => {})
}, 60000)

// CPU Usage (Async Shell)
setInterval(() => {
    execAsync(["sh", "-c", "top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'"]).then(out => {
        cpuUsage.set(`${Math.round(parseFloat(out))}%`)
    }).catch(() => {})
}, 3000)

// RAM Usage (Async Shell)
setInterval(() => {
    execAsync(["sh", "-c", "free -m | grep Mem | awk '{print $3}'"]).then(out => {
        const gb = (parseInt(out) / 1024).toFixed(1)
        ramUsage.set(!isNaN(parseFloat(gb)) ? `${gb} GB` : "3.2 GB")
    }).catch(() => {})
}, 5000)

// Disk Usage (Async Shell)
setInterval(() => {
    execAsync(["sh", "-c", "df -h / | tail -1 | awk '{print $4}'"]).then(out => {
        diskUsage.set(out || "40 GB")
    }).catch(() => {})
}, 30000)

// Battery (Async read)
setInterval(() => {
    execAsync(["cat", "/sys/class/power_supply/BAT0/capacity"]).then(cap => {
        execAsync(["cat", "/sys/class/power_supply/BAT0/status"]).then(stat => {
            const icon = stat.trim() === "Charging" ? "CHR" : "PWR"
            battState.set(`${icon} • ${cap.trim()}%`)
        }).catch(() => battState.set(`PWR • ${cap.trim()}%`))
    }).catch(() => battState.set("PWR • AC"))
}, 10000)

// Wi-Fi (Async Shell)
setInterval(() => {
    execAsync(["sh", "-c", "nmcli -t -f WIFI g"]).then(out => {
        wifiState.set(out.trim() === "enabled" ? "Wi-Fi • On" : "Wi-Fi • Off")
    }).catch(() => {})
}, 7000)

// Bluetooth (Async Shell)
setInterval(() => {
    execAsync(["sh", "-c", "rfkill list bluetooth | grep 'Soft blocked: yes'"]).then(out => {
        btState.set(out ? "BT • Off" : "BT • On")
    }).catch(() => btState.set("BT • On"))
}, 8000)


// Niri Workspaces (Async Shell)
setInterval(() => {
    execAsync(["sh", "-c", "niri msg -j workspaces"]).then(out => {
        niriWorkspaces.set(out.trim() || "[]")
    }).catch(() => {})
}, 500)

// Wireplumber (AstalWp)
import AstalWp from "gi://AstalWp"
try {
    const wp = AstalWp.get_default()?.audio
    if (wp) {
        if (wp.default_speaker) {
            wp.default_speaker.connect("notify::volume", () => volVal.set(Math.round(wp.default_speaker.volume * 100)))
            wp.default_speaker.connect("notify::mute", () => volVal.set(wp.default_speaker.mute ? 0 : Math.round(wp.default_speaker.volume * 100)))
        }
        if (wp.default_microphone) {
            wp.default_microphone.connect("notify::volume", () => micVal.set(Math.round(wp.default_microphone.volume * 100)))
            wp.default_microphone.connect("notify::mute", () => micVal.set(wp.default_microphone.mute ? 0 : Math.round(wp.default_microphone.volume * 100)))
        }
    }
} catch (e) {
    setInterval(() => {
        execAsync(["sh", "-c", "wpctl get-volume @DEFAULT_AUDIO_SINK@"]).then(out => {
            if (out.includes("[MUTED]")) volVal.set(0)
            else {
                const m = out.match(/Volume:\s+([0-9.]+)/)
                if (m) volVal.set(Math.round(parseFloat(m[1]) * 100))
            }
        }).catch(() => {})
        
        execAsync(["sh", "-c", "wpctl get-volume @DEFAULT_AUDIO_SOURCE@"]).then(out => {
            if (out.includes("[MUTED]")) micVal.set(0)
            else {
                const m = out.match(/Volume:\s+([0-9.]+)/)
                if (m) micVal.set(Math.round(parseFloat(m[1]) * 100))
            }
        }).catch(() => {})
    }, 2000)
}

// Media Player (AstalMpris via gjs)
import AstalMpris from "gi://AstalMpris"
try {
    const mpris = AstalMpris.get_default()
    if (mpris) {
        const updateMedia = () => {
            const players = mpris.get_players()
            if (players.length > 0) {
                const p = players[0]
                mediaTrack.set(p.title || "Nessuna riproduzione")
                mediaArtist.set(p.artist || "Sconosciuto")
                isPlaying.set(p.playback_status === AstalMpris.PlaybackStatus.PLAYING)
            } else {
                mediaTrack.set("Nessuna riproduzione")
                mediaArtist.set("")
                isPlaying.set(false)
            }
        }
        mpris.connect("notify::players", updateMedia)
        // Also we would need to connect to individual player properties, but for now fallback interval is fine.
        setInterval(updateMedia, 2000)
    }
} catch (e) {
    // Fallback to async playerctl
    setInterval(() => {
        execAsync(["playerctl", "metadata", "title"]).then(t => mediaTrack.set(t.trim() || "Nessuna riproduzione")).catch(() => mediaTrack.set("Nessuna riproduzione"))
        execAsync(["playerctl", "metadata", "artist"]).then(a => mediaArtist.set(a.trim())).catch(() => {})
        execAsync(["playerctl", "status"]).then(s => isPlaying.set(s.trim() === "Playing")).catch(() => isPlaying.set(false))
    }, 3000)
}


// --- ADVANCED NETWORK & BLUETOOTH SCANNING ---
export function scanWifi() {
    execAsync(["sh", "-c", "nmcli -t -f SSID,SIGNAL,SECURITY,IN-USE dev wifi list | grep -v '^:' | head -n 8"]).then((out) => {
        const lines = out.split("\n").filter(Boolean)
        const list = lines.map((l) => {
            const parts = l.split(":")
            return { ssid: parts[0] || "Wi-Fi Nascosto", signal: parts[1] || "50", sec: parts[2] || "Open", active: parts[3] === "*" || parts[3] === "yes" }
        })
        wifiList.set(list)
    }).catch(() => {})
}

export function scanBt() {
    execAsync(["sh", "-c", "bluetoothctl devices | head -n 8"]).then((out) => {
        const lines = out.split("\n").filter(Boolean)
        const list = lines.map((l) => {
            const parts = l.split(" ")
            const mac = parts[1] || ""
            const name = parts.slice(2).join(" ") || "Dispositivo Bluetooth"
            const connected = execSync(`bluetoothctl info ${mac} | grep -q 'Connected: yes' && echo yes`).includes("yes")
            return { mac, name, connected }
        })
        btList.set(list)
    }).catch(() => {})
}

// --- ADVANCED AUDIO MIXER POLLING ---
export function updateAudioHub() {
    execAsync(["sh", "-c", "LC_ALL=C pactl list sinks short"]).then((out) => {
        const def = execSync("pactl get-default-sink 2>/dev/null")
        const lines = out.split("\n").filter(Boolean)
        const sinks = lines.map((l) => {
            const parts = l.split("\t")
            const id = parts[0]
            const name = parts[1]
            const desc = name.replace("alsa_output.", "").replace("usb-", "").replace(".analog-stereo", "").replace(".pro-output-0", "").replace("_", " ")
            return { id, name, desc: desc || name, active: name === def }
        })
        audioSinks.set(sinks)
    }).catch(() => {})

    execAsync(["sh", "-c", "LC_ALL=C pactl list sources short | grep -v 'monitor'"]).then((out) => {
        const def = execSync("pactl get-default-source 2>/dev/null")
        const lines = out.split("\n").filter(Boolean)
        const sources = lines.map((l) => {
            const parts = l.split("\t")
            const id = parts[0]
            const name = parts[1]
            const desc = name.replace("alsa_input.", "").replace("usb-", "").replace(".analog-stereo", "").replace(".pro-input-0", "").replace("_", " ")
            return { id, name, desc: desc || name, active: name === def }
        })
        audioSources.set(sources)
    }).catch(() => {})

    execAsync(["sh", "-c", "LC_ALL=C pactl list sink-inputs"]).then((out) => {
        const blocks = out.split("Sink Input #").filter(Boolean)
        const streams: { id: string; name: string; vol: number; mute: boolean }[] = []
        blocks.forEach((b) => {
            const lines = b.split("\n")
            const id = lines[0]?.trim() || ""
            let name = `Applicazione #${id}`
            let vol = 80
            let mute = false
            lines.forEach((l) => {
                if (l.includes("application.name = ") || l.includes("media.name = ") || l.includes("node.name = ")) {
                    name = l.split("=")[1]?.replace(/"/g, "").trim() || name
                }
                if (l.includes("Volume:")) {
                    const match = l.match(/(\d+)%/)
                    if (match && match[1]) vol = parseInt(match[1])
                }
                if (l.includes("Mute: yes")) mute = true
            })
            if (id) streams.push({ id, name, vol, mute })
        })
        appStreams.set(streams)
    }).catch(() => {})
}

// Poll audio hub every 3 seconds
export const audioTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => {
    updateAudioHub()
    return GLib.SOURCE_CONTINUE
})

// --- APPLICATION LAUNCHER STATE ---
export const appsService = new AstalApps.Apps()
export const queryVar = Variable("")
export const activeCategory = Variable("Tutti")
export const listbox = new Gtk.ListBox({ css_classes: ["launcher-list"] })

export const CATEGORY_MAP: Record<string, string[]> = {
    "🌐 Internet": ["Network", "WebBrowser", "Email"],
    "🎨 Multimedia": ["Audio", "Video", "AudioVideo", "Graphics"],
    "🛠️ Sistema": ["System", "Settings", "Emulator"],
    "🧰 Utilità": ["Utility", "TextEditor", "Development"],
    "💼 Ufficio": ["Office"],
    "🎮 Giochi": ["Game"]
}

export function updateAppList() {
    let child = listbox.get_first_child()
    while (child) {
        const next = child.get_next_sibling()
        listbox.remove(child)
        child = next
    }
    
    let apps = appsService.get_list()
    const q = queryVar.get()
    const cat = activeCategory.get()
    
    if (q) {
        apps = appsService.fuzzy_query(q)
    } else {
        if (cat !== "Tutti") {
            const allowedCats = CATEGORY_MAP[cat] || []
            apps = apps.filter(app => {
                if (!app.categories) return false
                return app.categories.some(c => allowedCats.includes(c))
            })
        }
        apps.sort((a, b) => a.name.localeCompare(b.name))
    }
    
    apps = apps.slice(0, 40)
    
    if (apps.length === 0) {
        listbox.append(Widget.Label({ label: "Nessuna applicazione trovata", css_classes: ["launcher-empty"] }))
    } else {
        apps.forEach((app) => {
            const row = Widget.Box({
                css_classes: ["app-card"],
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 14,
                children: [
                    Widget.Image({ icon_name: app.icon_name || "application-x-executable", pixel_size: 36, css_classes: ["app-icon"] }),
                    Widget.Box({
                        orientation: Gtk.Orientation.VERTICAL,
                        valign: Gtk.Align.CENTER,
                        children: [
                            Widget.Label({ label: app.name, xalign: 0, css_classes: ["app-name"] }),
                            Widget.Label({ label: app.description || "Applicazione Ermete OS", xalign: 0, css_classes: ["app-desc"] })
                        ]
                    })
                ]
            })
            const gesture = new Gtk.GestureClick()
            gesture.connect("released", () => {
                app.launch()
                toggleExclusiveModal("launcher")
            })
            row.add_controller(gesture)
            listbox.append(row)
        })
    }
}


// --- SYSTRAY COMPONENT ---
import AstalTray from "gi://AstalTray"
import { bind } from "astal"

export function SysTray() {
    const tray = AstalTray.get_default()

    return Widget.Box({
        css_classes: ["bar-pill", "systray-box"],
        spacing: 8,
        visible: bind(tray, "items").as(items => items.length > 0),
        children: bind(tray, "items").as(items =>
            items.map(item => Widget.Button({
                css_classes: ["tray-item-btn"],
                tooltip_markup: bind(item, "tooltip_markup"),
                child: Widget.Image({
                    gicon: bind(item, "gicon"),
                    pixel_size: 16
                }),
                onClicked: () => item.activate(0, 0),
            }))
        )
    })
}

