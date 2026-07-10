import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { Variable, GLib } from "astal"
import { execAsync } from "astal/process"
import { bind } from "astal"
import AstalApps from "gi://AstalApps"
import AstalTray from "gi://AstalTray"
import AstalWp from "gi://AstalWp"
import AstalMpris from "gi://AstalMpris"
import { PopupWindow, timeState, dateState, uptimeState, cpuUsage, ramUsage, caffeineState, wifiState, btState, isPlaying, mediaTrack, niriWorkspaces, volState, volVal, micVal, brightVal, battState, mediaArtist, diskUsage, wifiExpanded, btExpanded, wifiList, btList, audioSinks, audioSources, appStreams, decoder, execSync, allModals, lastFocusLoss, toggleExclusiveModal, scanWifi, scanBt, updateAudioHub, audioTimer, appsService, queryVar, activeCategory, listbox, CATEGORY_MAP, updateAppList, SysTray } from "./state"
import { FirewallToggle } from "./firewall"
import { UpdaterButton } from "./updater"

// --- 1. TOP BAR COMPONENT ---
export function NiriWorkspaces(connector: string) {
    const btns: any[] = [];
    let wsRefs: any[] = [];
    
    for(let i = 0; i < 10; i++) {
        btns.push(Widget.Button({
            css_classes: ["workspace-btn"],
            visible: false,
            onClicked: () => {
                if (wsRefs[i] !== undefined) {
                    const ref = wsRefs[i];
                    GLib.spawn_command_line_async(`niri msg action focus-workspace ${ref}`);
                }
            }
        }))
    }
    
    niriWorkspaces.subscribe(json => {
        try {
            let wss = JSON.parse(json);
            if (connector) {
                wss = wss.filter((w: any) => w.output === connector);
            }
            wss.sort((a: any, b: any) => a.idx - b.idx);
            for(let i = 0; i < 10; i++) {
                const btn = btns[i];
                if (i < wss.length) {
                    const ws = wss[i];
                    wsRefs[i] = ws.name ? ws.name : ws.idx;
                    btn.label = ws.name ? ws.name : `${ws.idx}`;
                    if (ws.is_focused) btn.css_classes = ["workspace-btn", "focused"];
                    else if (ws.is_active) btn.css_classes = ["workspace-btn", "active"];
                    else btn.css_classes = ["workspace-btn"];
                    btn.visible = true;
                } else {
                    wsRefs[i] = undefined;
                    btn.visible = false;
                }
            }
        } catch {}
    });

    return Widget.Box({
        css_classes: ["bar-pill", "workspace-container"],
        spacing: 2,
        setup: (self) => {
            const scroll = new Gtk.EventControllerScroll({
                flags: Gtk.EventControllerScrollFlags.VERTICAL | Gtk.EventControllerScrollFlags.DISCRETE
            })
            scroll.connect("scroll", (ctrl, dx, dy) => {
                if (dy > 0) {
                    GLib.spawn_command_line_async("niri msg action focus-workspace-down")
                } else if (dy < 0) {
                    GLib.spawn_command_line_async("niri msg action focus-workspace-up")
                }
                return true
            })
            self.add_controller(scroll)
        },
        children: btns
    });
}

export function TopBar(monitor: Gdk.Monitor, idx: number) {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    const leftIsland = Widget.Box({
        css_classes: ["bar-pill"],
        spacing: 8,
        valign: Gtk.Align.CENTER,
        children: [
            Widget.Button({
                css_classes: ["os-logo-btn"],
                label: "◈ Ermete",
                onClicked: () => toggleExclusiveModal("launcher")
            }),
            Widget.Button({
                css_classes: ["caffeine-indicator"],
                label: caffeineState().as(c => c ? "♨ Awake" : ""),
                visible: caffeineState().as(c => c),
                onClicked: () => caffeineState.set(false)
            })
        ]
    })

    const centerLeftIsland = Widget.Button({
        css_classes: ["bar-pill", "sysmon-pill-btn"],
        valign: Gtk.Align.CENTER,
        onClicked: () => toggleExclusiveModal("sys-monitor"),
        child: Widget.Box({
            spacing: 6,
            children: [
                Widget.Label({ label: cpuUsage().as(c => `CPU ${c}`) }),
                Widget.Label({ label: "•", css_classes: ["workspace-indicator"] }),
                Widget.Label({ label: ramUsage().as(r => `RAM ${r}`) })
            ]
        })
    })

    const centerIsland = Widget.Button({
        css_classes: ["bar-pill", "media-pill-btn"],
        valign: Gtk.Align.CENTER,
        onClicked: () => toggleExclusiveModal("media-player"),
        child: Widget.Box({
            spacing: 6,
            children: [
                Widget.Label({ label: isPlaying().as(p => p ? "▶" : "♫") }),
                Widget.Label({ label: mediaTrack().as(t => t.length > 28 ? t.substring(0, 26) + "…" : t) })
            ]
        })
    })

    const centerRightIsland = Widget.Button({
        css_classes: ["bar-pill", "clock-btn"],
        valign: Gtk.Align.CENTER,
        onClicked: () => toggleExclusiveModal("calendar"),
        child: Widget.Box({
            spacing: 6,
            children: [
                Widget.Label({ label: timeState() }),
                Widget.Label({ label: "•", css_classes: ["workspace-indicator"] }),
                Widget.Label({ label: dateState() })
            ]
        })
    })

    // MODULAR INDIVIDUAL BUTTONS FOR EACH SECTION
    const rightIsland = Widget.Box({
        css_classes: ["bar-pill"],
        spacing: 6,
        valign: Gtk.Align.CENTER,
        children: [
            SysTray(),
            Widget.Button({
                css_classes: ["status-pill-btn"],
                onClicked: () => { scanWifi(); toggleExclusiveModal("wifi-modal") },
                child: Widget.Box({
                    spacing: 6,
                    children: [
                        Widget.Label({ label: "", css_classes: ["status-icon", "wifi"] }),
                        Widget.Label({ label: wifiState().as(w => w.includes("On") ? "Wi-Fi" : "Off") })
                    ]
                })
            }),
            Widget.Label({ label: "•", css_classes: ["workspace-indicator"] }),
            Widget.Button({
                css_classes: ["status-pill-btn"],
                onClicked: () => { scanBt(); toggleExclusiveModal("bt-modal") },
                child: Widget.Box({
                    spacing: 6,
                    children: [
                        Widget.Label({ label: "", css_classes: ["status-icon", "bt"] }),
                        Widget.Label({ label: btState().as(b => b.includes("On") ? "BT" : "Off") })
                    ]
                })
            }),
            Widget.Label({ label: "•", css_classes: ["workspace-indicator"] }),
            Widget.Button({
                css_classes: ["status-pill-btn"],
                onClicked: () => { updateAudioHub(); toggleExclusiveModal("audio-modal") },
                child: Widget.Box({
                    spacing: 6,
                    children: [
                        Widget.Label({ label: "♫", css_classes: ["status-icon", "vol"] }),
                        Widget.Label({ label: volVal().as(v => v === 0 ? "Muto" : `${v}%`) })
                    ]
                })
            }),
            Widget.Label({ label: "•", css_classes: ["workspace-indicator"] }),
            Widget.Button({
                css_classes: ["status-pill-btn"],
                onClicked: () => toggleExclusiveModal("quick-settings"),
                child: Widget.Box({
                    spacing: 6,
                    children: [
                        Widget.Label({ label: "", css_classes: ["status-icon", "batt"], visible: battState().as(b => !b.includes("AC")) }),
                        Widget.Label({ label: battState().as(b => b.replace("PWR • ", "")), visible: battState().as(b => !b.includes("AC")) }),
                        Widget.Label({ label: "❖ Config", css_classes: ["status-icon", "gear"] })
                    ]
                })
            }),
            Widget.Button({
                css_classes: ["power-btn"],
                label: "⏻",
                onClicked: () => toggleExclusiveModal("powermenu")
            })
        ]
    })

    return Widget.Window({
        name: `bar-${idx}`,
        namespace: "bar",
        application: App,
        gdkmonitor: monitor,
        anchor: TOP | LEFT | RIGHT,
        exclusivity: Astal.Exclusivity.EXCLUSIVE,
        heightRequest: 28,
        visible: true,
        child: Widget.CenterBox({
            css_classes: ["top-bar"],
            setup: (self) => {
                const scroll = new Gtk.EventControllerScroll({
                    flags: Gtk.EventControllerScrollFlags.VERTICAL | Gtk.EventControllerScrollFlags.DISCRETE
                })
                scroll.connect("scroll", (ctrl, dx, dy) => {
                    if (dy > 0) {
                        GLib.spawn_command_line_async("niri msg action focus-column-right")
                    } else if (dy < 0) {
                        GLib.spawn_command_line_async("niri msg action focus-column-left")
                    }
                    return true
                })
                self.add_controller(scroll)
            },
            startWidget: Widget.Box({ spacing: 8, children: [leftIsland, NiriWorkspaces(monitor.get_connector() || "")] }),
            centerWidget: Widget.Box({ spacing: 8, children: [centerIsland, centerRightIsland] }),
            endWidget: Widget.Box({ halign: Gtk.Align.END, spacing: 8, children: [centerLeftIsland, rightIsland] })
        })
    })
}

// --- 2A. DEDICATED WI-FI MODAL ---
export function WifiModal() {
    const { TOP, RIGHT } = Astal.WindowAnchor

    return PopupWindow({
        name: "wifi-modal",
        namespace: "wifi-modal",
        application: App,
        anchor: TOP | RIGHT,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 40,
        marginRight: 150,
        child: Widget.Box({
            css_classes: ["focused-modal-box"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 14,
            children: [
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    children: [
                        Widget.Label({ label: "  Connessione Wi-Fi", css_classes: ["dongle-title"], hexpand: true, xalign: 0 }),
                        Widget.Button({ label: "✕", css_classes: ["dongle-close-btn"], onClicked: () => toggleExclusiveModal("wifi-modal") })
                    ]
                }),
                Widget.Button({
                    css_classes: wifiState().as(w => w.includes("On") ? ["quick-toggle-btn", "wifi", "active"] : ["quick-toggle-btn", "wifi"]),
                    label: wifiState().as(w => w.includes("On") ? "✔ Wi-Fi Attivo • Clicca per Disattivare" : "✕ Wi-Fi Disattivato • Clicca per Attivare"),
                    onClicked: () => {
                        execAsync(["sh", "-c", "nmcli radio wifi | grep -q 'enabled' && nmcli radio wifi off || nmcli radio wifi on"]).catch(() => {})
                        wifiState.set(wifiState.get().includes("On") ? "Wi-Fi • Off" : "Wi-Fi • On")
                    }
                }),
                Widget.Box({
                    css_classes: ["sub-list-box"],
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 6,
                    children: wifiList().as((list) => {
                        if (list.length === 0) return [Widget.Label({ label: "Scansione reti Wi-Fi in corso...", css_classes: ["sub-list-label"] })]
                        return list.map((net) => Widget.Box({
                            css_classes: ["sub-list-row"],
                            orientation: Gtk.Orientation.HORIZONTAL,
                            spacing: 12,
                            children: [
                                Widget.Label({ label: "", style: "color: #89dceb;" }),
                                Widget.Label({ label: `${net.ssid} (${net.signal}%)`, css_classes: ["sub-list-label"], hexpand: true, xalign: 0 }),
                                Widget.Button({
                                    css_classes: net.active ? ["connect-btn", "active"] : ["connect-btn"],
                                    label: net.active ? "✔ Connesso" : "Connetti",
                                    onClicked: () => {
                                        if (!net.active) execAsync(["nmcli", "dev", "wifi", "connect", net.ssid]).then(() => scanWifi()).catch(() => {})
                                    }
                                })
                            ]
                        }))
                    })
                }),
                Widget.Button({
                    css_classes: ["action-pill-btn"],
                    label: "⚙  Impostazioni di Rete Avanzate",
                    onClicked: () => { toggleExclusiveModal("wifi-modal"); execAsync(["nm-connection-editor"]).catch(() => {}) }
                })
            ]
        })
    })
}

// --- 2B. DEDICATED BLUETOOTH MODAL ---
export function BtModal() {
    const { TOP, RIGHT } = Astal.WindowAnchor

    return PopupWindow({
        name: "bt-modal",
        namespace: "bt-modal",
        application: App,
        anchor: TOP | RIGHT,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 40,
        marginRight: 100,
        child: Widget.Box({
            css_classes: ["focused-modal-box"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 14,
            children: [
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    children: [
                        Widget.Label({ label: "  Dispositivi Bluetooth", css_classes: ["dongle-title"], hexpand: true, xalign: 0 }),
                        Widget.Button({ label: "✕", css_classes: ["dongle-close-btn"], onClicked: () => toggleExclusiveModal("bt-modal") })
                    ]
                }),
                Widget.Button({
                    css_classes: btState().as(b => b.includes("On") ? ["quick-toggle-btn", "bt", "active"] : ["quick-toggle-btn", "bt"]),
                    label: btState().as(b => b.includes("On") ? "✔ Bluetooth Attivo • Clicca per Disattivare" : "✕ Bluetooth Disattivato • Clicca per Attivare"),
                    onClicked: () => {
                        execAsync(["sh", "-c", "rfkill list bluetooth | grep -q 'Soft blocked: yes' && rfkill unblock bluetooth || rfkill block bluetooth"]).catch(() => {})
                        btState.set(btState.get().includes("On") ? "BT • Off" : "BT • On")
                    }
                }),
                Widget.Box({
                    css_classes: ["sub-list-box"],
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 6,
                    children: btList().as((list) => {
                        if (list.length === 0) return [Widget.Label({ label: "Scansione dispositivi BT in corso...", css_classes: ["sub-list-label"] })]
                        return list.map((dev) => Widget.Box({
                            css_classes: ["sub-list-row"],
                            orientation: Gtk.Orientation.HORIZONTAL,
                            spacing: 12,
                            children: [
                                Widget.Label({ label: "", style: "color: #89b4fa;" }),
                                Widget.Label({ label: dev.name, css_classes: ["sub-list-label"], hexpand: true, xalign: 0 }),
                                Widget.Button({
                                    css_classes: dev.connected ? ["connect-btn", "active"] : ["connect-btn"],
                                    label: dev.connected ? "✔ Connesso" : "Connetti",
                                    onClicked: () => {
                                        execAsync(["bluetoothctl", dev.connected ? "disconnect" : "connect", dev.mac]).then(() => scanBt()).catch(() => {})
                                    }
                                })
                            ]
                        }))
                    })
                })
            ]
        })
    })
}

// --- 2C. DEDICATED AUDIO HUB & APPLICATION MIXER MODAL ---
export function AudioModal() {
    const { TOP, RIGHT } = Astal.WindowAnchor

    const mkSlider = (icon: string, title: string, valVar: Variable<number>, action: (val: number) => void) => {
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 5, page_increment: 10, value: valVar.get() }),
            css_classes: ["matshell-slider"]
        })
        let timer: number | null = null;
        scale.connect("value-changed", () => {
            const val = Math.round(scale.get_value())
            valVar.set(val)
            if (timer !== null) GLib.source_remove(timer)
            timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                action(val)
                timer = null;
                return GLib.SOURCE_REMOVE;
            })
        })
        valVar.subscribe((v) => { if (Math.round(scale.get_value()) !== v) scale.set_value(v) })

        return Widget.Box({
            css_classes: ["dongle-slider-section"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            children: [
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    children: [
                        Widget.Label({ label: `${icon}  ${title}`, css_classes: ["slider-label"], hexpand: true, xalign: 0 }),
                        Widget.Label({ label: valVar().as(v => `${v}%`), css_classes: ["slider-val"] })
                    ]
                }),
                scale
            ]
        })
    }

    return PopupWindow({
        name: "audio-modal",
        namespace: "audio-modal",
        application: App,
        anchor: TOP | RIGHT,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 40,
        marginRight: 60,
        child: Widget.Box({
            css_classes: ["focused-modal-box"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            children: [
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    children: [
                        Widget.Label({ label: "♫  Centro Audio & Mixer Applicazioni", css_classes: ["dongle-title"], hexpand: true, xalign: 0 }),
                        Widget.Button({ label: "✕", css_classes: ["dongle-close-btn"], onClicked: () => toggleExclusiveModal("audio-modal") })
                    ]
                }),
                
                // Output Sink Selector
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 10,
                    children: [
                        Widget.Label({ label: "Uscita:", css_classes: ["sub-list-label"], style: "min-width: 70px;" }),
                        Widget.Button({
                            css_classes: ["audio-device-selector"],
                            hexpand: true,
                            label: audioSinks().as((sinks) => {
                                const act = sinks.find((s) => s.active) || sinks[0]
                                return act ? `✔ ${act.desc}` : "Seleziona Dispositivo Uscita"
                            }),
                            onClicked: () => {
                                const sinks = audioSinks.get()
                                if (sinks.length > 1) {
                                    const idx = sinks.findIndex((s) => s.active)
                                    const next = sinks[(idx + 1) % sinks.length]
                                    if (next) {
                                        execAsync(["pactl", "set-default-sink", next.name]).then(() => {
                                            execAsync(["sh", "-c", `for id in $(pactl list sink-inputs short | awk '{print $1}'); do pactl move-sink-input $id ${next.name}; done`]).catch(() => {})
                                            updateAudioHub()
                                        }).catch(() => {})
                                    }
                                }
                            }
                        })
                    ]
                }),

                // Input Source Selector
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 10,
                    children: [
                        Widget.Label({ label: "Microfono:", css_classes: ["sub-list-label"], style: "min-width: 70px;" }),
                        Widget.Button({
                            css_classes: ["audio-device-selector"],
                            hexpand: true,
                            label: audioSources().as((sources) => {
                                const act = sources.find((s) => s.active) || sources[0]
                                return act ? `✔ ${act.desc}` : "Seleziona Ingresso Mic"
                            }),
                            onClicked: () => {
                                const sources = audioSources.get()
                                if (sources.length > 1) {
                                    const idx = sources.findIndex((s) => s.active)
                                    const next = sources[(idx + 1) % sources.length]
                                    if (next) {
                                        execAsync(["pactl", "set-default-source", next.name]).then(() => updateAudioHub()).catch(() => {})
                                    }
                                }
                            }
                        })
                    ]
                }),

                mkSlider("♫", "Volume Master Output", volVal, (v) => { try { const wp = AstalWp.get_default()?.audio; if (wp?.default_speaker) { wp.default_speaker.mute = false; wp.default_speaker.volume = v / 100; } } catch (e) { execAsync(["sh", "-c", `wpctl set-mute @DEFAULT_AUDIO_SINK@ 0 2>/dev/null; wpctl set-volume @DEFAULT_AUDIO_SINK@ ${v}%`]).catch(()=>{}) } }),
                mkSlider("", "Guadagno Microfono", micVal, (v) => { try { const wp = AstalWp.get_default()?.audio; if (wp?.default_microphone) { wp.default_microphone.mute = false; wp.default_microphone.volume = v / 100; } } catch (e) { execAsync(["sh", "-c", `wpctl set-mute @DEFAULT_AUDIO_SOURCE@ 0 2>/dev/null; wpctl set-volume @DEFAULT_AUDIO_SOURCE@ ${v}%`]).catch(()=>{}) } }),

                // Application Volume Mixer
                Widget.Box({
                    css_classes: ["app-mixer-section"],
                    orientation: Gtk.Orientation.VERTICAL,
                    spacing: 8,
                    children: [
                        Widget.Label({ label: "Livellamento Flussi Applicativi Attivi:", css_classes: ["sub-list-label"], xalign: 0, style: "color: #89b4fa; font-size: 0.85em;" }),
                        Widget.Box({
                            orientation: Gtk.Orientation.VERTICAL,
                            spacing: 6,
                            children: appStreams().as((streams) => {
                                if (streams.length === 0) {
                                    return [Widget.Label({ label: "Nessun flusso applicativo attivo in riproduzione", css_classes: ["sub-list-label"], style: "color: #a6adc8; font-style: italic; padding: 6px 0;" })]
                                }
                                return streams.map((st) => {
                                    const stVol = Variable(st.vol)
                                    const scale = new Gtk.Scale({
                                        orientation: Gtk.Orientation.HORIZONTAL,
                                        adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 5, page_increment: 10, value: st.vol }),
                                        css_classes: ["matshell-slider"],
                                        hexpand: true
                                    })
                                    scale.connect("value-changed", () => {
                                        const val = Math.round(scale.get_value())
                                        stVol.set(val)
                                        execAsync(["sh", "-c", `pactl set-sink-input-mute ${st.id} 0 2>/dev/null; pactl set-sink-input-volume ${st.id} ${val}%`]).catch(() => {})
                                    })
                                    return Widget.Box({
                                        css_classes: ["app-mixer-row"],
                                        orientation: Gtk.Orientation.VERTICAL,
                                        spacing: 4,
                                        children: [
                                            Widget.Box({
                                                orientation: Gtk.Orientation.HORIZONTAL,
                                                children: [
                                                    Widget.Label({ label: st.name, css_classes: ["app-mixer-title"], hexpand: true, xalign: 0 }),
                                                    Widget.Label({ label: stVol().as(v => `${v}%`), style: "color: #89b4fa; font-size: 0.85em; font-weight: 800; margin-right: 10px;" }),
                                                    Widget.Button({
                                                        css_classes: st.mute ? ["app-mixer-mute-btn", "muted"] : ["app-mixer-mute-btn"],
                                                        label: st.mute ? "Muto" : "Attivo",
                                                        onClicked: () => {
                                                            execAsync(["pactl", "set-sink-input-mute", st.id, "toggle"]).then(() => updateAudioHub()).catch(() => {})
                                                        }
                                                    })
                                                ]
                                            }),
                                            scale
                                        ]
                                    })
                                })
                            })
                        })
                    ]
                })
            ]
        })
    })
}

// --- 2D. DEDICATED QUICK SETTINGS & SYSTEM MODAL ---
export function QuickSettingsModal() {
    const { TOP, RIGHT } = Astal.WindowAnchor

    const profileCard = Widget.Box({
        css_classes: ["profile-card"],
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 16,
        children: [
            Widget.Label({ label: "◈", css_classes: ["profile-avatar"] }),
            Widget.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                hexpand: true,
                children: [
                    Widget.Label({ label: "Ermete OS", css_classes: ["profile-name"], xalign: 0 }),
                    Widget.Label({ label: "Trismegistus • Linux Bedrock", css_classes: ["profile-sub"], xalign: 0 })
                ]
            }),
            Widget.Label({ label: uptimeState(), css_classes: ["uptime-badge"] })
        ]
    })

    const mkSlider = (icon: string, title: string, valVar: Variable<number>, action: (val: number) => void) => {
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({ lower: 0, upper: 100, step_increment: 5, page_increment: 10, value: valVar.get() }),
            css_classes: ["matshell-slider"]
        })
        let timer: number | null = null;
        scale.connect("value-changed", () => {
            const val = Math.round(scale.get_value())
            valVar.set(val)
            if (timer !== null) GLib.source_remove(timer)
            timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                action(val)
                timer = null;
                return GLib.SOURCE_REMOVE;
            })
        })
        valVar.subscribe((v) => { if (Math.round(scale.get_value()) !== v) scale.set_value(v) })

        return Widget.Box({
            css_classes: ["dongle-slider-section"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            children: [
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    children: [
                        Widget.Label({ label: `${icon}  ${title}`, css_classes: ["slider-label"], hexpand: true, xalign: 0 }),
                        Widget.Label({ label: valVar().as(v => `${v}%`), css_classes: ["slider-val"] })
                    ]
                }),
                scale
            ]
        })
    }

    return PopupWindow({
        name: "quick-settings",
        namespace: "quick-settings",
        application: App,
        anchor: TOP | RIGHT,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 40,
        marginRight: 16,
        child: Widget.Box({
            css_classes: ["focused-modal-box"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            children: [
                profileCard,
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    children: [
                        Widget.Label({ label: "❖  Impostazioni & Telemetria", css_classes: ["dongle-title"], hexpand: true, xalign: 0 }),
                        Widget.Button({ label: "✕", css_classes: ["dongle-close-btn"], onClicked: () => toggleExclusiveModal("quick-settings") })
                    ]
                }),
                Widget.Box({
                    spacing: 12,
                    children: [
                        Widget.Button({
                            css_classes: caffeineState().as(c => c ? ["quick-toggle-btn", "caffeine", "active"] : ["quick-toggle-btn", "caffeine"]),
                            hexpand: true,
                            label: caffeineState().as(c => c ? "♨ Awake • On" : "♨ Awake • Normal"),
                            onClicked: () => caffeineState.set(!caffeineState.get())
                        }),
                        Widget.Button({
                            css_classes: ["quick-toggle-btn", "shot"],
                            hexpand: true,
                            label: "  Cattura",
                            onClicked: () => {
                                toggleExclusiveModal("quick-settings")
                                execAsync(["sh", "-c", "sleep 0.5 && grim -g \"$(slurp)\" ~/Pictures/screenshot_$(date +%s).png"]).catch(() => {})
                            }
                        }),
                        FirewallToggle()
                    ]
                }),
                Widget.Box({
                    spacing: 12,
                    children: [
                        UpdaterButton(),
                        Widget.Button({
                            css_classes: ["quick-toggle-btn", "clipboard"],
                            hexpand: true,
                            label: "📋 Appunti",
                            onClicked: () => toggleExclusiveModal("clipboard")
                        })
                    ]
                }),
                mkSlider("☀", "Luminosità Monitor (DDC/CI & eDP)", brightVal, (v) => { execAsync(["sh", "-c", `ddcutil setvcp 10 ${v} 2>/dev/null || brightnessctl s ${v}% 2>/dev/null || true`]).catch(()=>{}) }),
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 12,
                    children: [
                        Widget.Button({ css_classes: ["action-pill-btn"], hexpand: true, label: "  btop", onClicked: () => { toggleExclusiveModal("quick-settings"); execAsync(["foot", "btop"]).catch(() => {}) } }),
                        Widget.Button({ css_classes: ["action-pill-btn"], hexpand: true, label: "📁  Files", onClicked: () => { toggleExclusiveModal("quick-settings"); execAsync(["thunar", GLib.get_home_dir()]).catch(() => {}) } }),
                        Widget.Button({ css_classes: ["action-pill-btn"], hexpand: true, label: "⚙  Impostazioni", onClicked: () => { toggleExclusiveModal("quick-settings"); toggleExclusiveModal("settings-modal") } })
                    ]
                })
            ]
        })
    })
}

// --- ERMETE OS SYSTEM SETTINGS HUB ("settings-modal") ---
// --- ERMETE OS SYSTEM SETTINGS HUB ("settings-modal") ---
export function ErmeteSettingsModal() {
    // A single row in a group
    const mkSettingRow = (icon: string, title: string, desc: string, actionWidget: Gtk.Widget) => Widget.Box({
        css_classes: ["win-setting-row"],
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 16,
        children: [
            Widget.Label({ label: icon, css_classes: ["win-row-icon"] }),
            Widget.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                hexpand: true,
                children: [
                    Widget.Label({ label: title, css_classes: ["win-row-title"], xalign: 0 }),
                    Widget.Label({ label: desc, css_classes: ["win-row-desc"], xalign: 0, wrap: true, visible: desc !== "" })
                ]
            }),
            Widget.Box({
                valign: Gtk.Align.CENTER,
                children: [actionWidget]
            })
        ]
    })

    // A group of rows (looks like a single card with dividers)
    const mkSettingGroup = (title: string, rows: Gtk.Widget[]) => {
        const children: Gtk.Widget[] = [];
        for (let i = 0; i < rows.length; i++) {
            children.push(rows[i]);
            if (i < rows.length - 1) {
                children.push(Widget.Box({ css_classes: ["win-row-divider"] }));
            }
        }
        return Widget.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            children: [
                Widget.Label({ label: title, css_classes: ["win-group-title"], xalign: 0, visible: title !== "" }),
                Widget.Box({
                    css_classes: ["win-setting-group-card"],
                    orientation: Gtk.Orientation.VERTICAL,
                    children: children
                })
            ]
        })
    }

    const mkButton = (icon: string, label: string, action: () => void) => Widget.Button({
        css_classes: ["win-action-btn"],
        child: Widget.Box({
            spacing: 6,
            children: [
                Widget.Label({ label: icon }),
                Widget.Label({ label })
            ]
        }),
        onClicked: () => action()
    })

    const mkToggle = (active: boolean, action: (state: boolean) => void) => {
        const sw = new Gtk.Switch({ active, valign: Gtk.Align.CENTER })
        sw.connect("notify::active", () => action(sw.active))
        return sw
    }

    const mkDropdown = (options: string[], selectedIdx: number, action: (idx: number, val: string) => void) => {
        const dd = new Gtk.DropDown({
            model: Gtk.StringList.new(options),
            selected: selectedIdx,
            valign: Gtk.Align.CENTER
        })
        dd.connect("notify::selected", () => action(dd.selected, options[dd.selected]))
        return dd
    }

    // --- PAGES ---

    const pageSistema = Widget.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 24,
        children: [
            Widget.Label({ label: "Sistema", css_classes: ["win-page-title"], xalign: 0 }),
            mkSettingGroup("Display & Finestre", [
                mkSettingRow("🖥️", "Scala Display (DPI)", "Regola la dimensione globale dell'interfaccia (richiede riavvio per alcune app).",
                    mkDropdown(["1.0x (100%)", "1.25x (125%)", "1.5x (150%)", "2.0x (200%)"], 0, (idx, val) => {
                        const scale = val.split("x")[0]
                        execAsync(["sh", "-c", `sed -i 's/scale .*/scale ${scale}/' ~/.config/niri/config.kdl`]).catch(() => {})
                    })
                ),
                mkSettingRow("🔲", "Spaziatura Finestre", "Distanza in pixel tra le finestre affiancate (Gaps).",
                    mkDropdown(["Nessuna (0px)", "Stretta (8px)", "Media (16px)", "Larga (24px)"], 1, (idx, val) => {
                        const gap = val.includes("0") ? "0" : val.includes("8") ? "8" : val.includes("16") ? "16" : "24"
                        execAsync(["sh", "-c", `sed -i 's/gaps .*/gaps ${gap}/' ~/.config/niri/config.kdl`]).catch(() => {})
                    })
                ),
                mkSettingRow("🖲️", "Gestione Multi-Monitor", "Duplica o estendi automaticamente gli schermi connessi.",
                    mkButton("🖥️", "Configura Display", () => execAsync(["sh", "-c", "killall wl-mirror 2>/dev/null; M2=$(niri msg -j outputs | jq -r 'keys | .[1]'); if [ -n \"$M2\" ] && [ \"$M2\" != \"null\" ]; then niri msg output \"$M2\" on; niri msg output \"$M2\" position auto; fi"]).catch(() => {}))
                )
            ]),
            mkSettingGroup("Prestazioni & Alimentazione", [
                mkSettingRow("⚡", "Modalità Caffeine", "Impedisce la sospensione automatica dello schermo.",
                    mkToggle(caffeineState.get(), (state) => caffeineState.set(state))
                ),
                mkSettingRow("🔋", "Stato Batteria", "Dettagli hardware e consumo.",
                    Widget.Label({ label: battState().as(b => b), css_classes: ["win-status-label"] })
                )
            ])
        ]
    })

    const pagePersonalizzazione = Widget.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 24,
        children: [
            Widget.Label({ label: "Personalizzazione", css_classes: ["win-page-title"], xalign: 0 }),
            mkSettingGroup("Estetica del Desktop", [
                mkSettingRow("🌈", "Tema Dinamico (Matugen)", "Rigenera i colori di sistema basandoti sullo sfondo attuale.",
                    mkButton("🎨", "Estrai Colori", () => execAsync(["sh", "-c", "matugen image ~/.config/ermete/wallpaper.png || true"]).catch(() => {}))
                ),
                mkSettingRow("🖼️", "Sfondo Scrivania", "Sostituisci o ricarica lo sfondo corrente (Swaybg).",
                    mkButton("🔄", "Ricarica", () => execAsync(["systemctl", "--user", "restart", "ermete-wallpaper.service"]).catch(() => {}))
                ),
                mkSettingRow("🎨", "Pannello Superiore (AGS)", "Applica le modifiche CSS ricaricando l'interfaccia.",
                    mkButton("🔄", "Riavvia AGS", () => execAsync(["systemctl", "--user", "restart", "ermete-ags.service"]).catch(() => {}))
                )
            ]),
            mkSettingGroup("Terminale", [
                mkSettingRow("⌨️", "Dimensione Font", "Grandezza del carattere nel terminale Foot.",
                    mkDropdown(["Piccolo (10)", "Medio (11)", "Grande (13)", "Enorme (16)"], 1, (idx, val) => {
                        const size = val.includes("10") ? "10" : val.includes("11") ? "11" : val.includes("13") ? "13" : "16"
                        execAsync(["sh", "-c", `sed -i 's/font=JetBrains Mono:size=.*/font=JetBrains Mono:size=${size}/' ~/.config/foot/foot.ini`]).catch(() => {})
                    })
                ),
                mkSettingRow("👁️", "Trasparenza (Opacità)", "Regola il livello di glassmorphism nel terminale.",
                    mkDropdown(["Solido (100%)", "Trasparente (90%)", "Vetro (80%)"], 1, (idx, val) => {
                        const alpha = val.includes("100") ? "1.0" : val.includes("90") ? "0.9" : "0.8"
                        execAsync(["sh", "-c", `sed -i 's/alpha=.*/alpha=${alpha}/' ~/.config/foot/foot.ini`]).catch(() => {})
                    })
                )
            ])
        ]
    })

    const pageInfo = Widget.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 24,
        children: [
            Widget.Label({ label: "Informazioni Sistema", css_classes: ["win-page-title"], xalign: 0 }),
            Widget.Box({
                css_classes: ["win-about-card"],
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                children: [
                    Widget.Box({
                        orientation: Gtk.Orientation.HORIZONTAL,
                        spacing: 16,
                        children: [
                            Widget.Label({ label: "◈", css_classes: ["win-about-logo"] }),
                            Widget.Box({
                                orientation: Gtk.Orientation.VERTICAL,
                                valign: Gtk.Align.CENTER,
                                children: [
                                    Widget.Label({ label: "Ermete OS", css_classes: ["win-about-title"], xalign: 0 }),
                                    Widget.Label({ label: "Trismegistus Edition (Bedrock Linux)", css_classes: ["win-about-sub"], xalign: 0 }),
                                    Widget.Label({ label: "OSTree Immutabile", css_classes: ["win-about-sub"], xalign: 0 })
                                ]
                            })
                        ]
                    })
                ]
            }),
            mkSettingGroup("Azioni di Sistema", [
                mkSettingRow("🔍", "Stato Immutabilità (OSTree)", "Verifica l'albero dei commit e gli aggiornamenti in attesa.",
                    mkButton("🚀", "Controlla", () => { toggleExclusiveModal("settings-modal"); execAsync(["foot", "sh", "-c", "rpm-ostree status; echo ''; read -p 'Premere Invio per chiudere...'"]).catch(() => {}) })
                ),
                mkSettingRow("", "Monitoraggio Risorse (btop)", "Apri il gestore di processi avanzato nel terminale.",
                    mkButton("🚀", "Apri btop", () => { toggleExclusiveModal("settings-modal"); execAsync(["foot", "btop"]).catch(() => {}) })
                )
            ])
        ]
    })

    const stack = new Gtk.Stack({
        transition_type: Gtk.StackTransitionType.SLIDE_UP_DOWN,
        hexpand: true,
        vexpand: true
    })
    
    // Scrolled window wrapper per ogni pagina
    const wrapPage = (child: Gtk.Widget) => new Gtk.ScrolledWindow({ 
        child: Widget.Box({ child: child, padding: 24 }), 
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        css_classes: ["win-stack-scroll"]
    })

    stack.add_named(wrapPage(pageSistema), "sistema")
    stack.add_named(wrapPage(pagePersonalizzazione), "personalizzazione")
    stack.add_named(wrapPage(pageInfo), "info")

    const activePage = Variable("sistema")
    activePage.subscribe((val) => stack.set_visible_child_name(val))

    const mkNavBtn = (icon: string, label: string, page: string) => Widget.Button({
        css_classes: activePage().as(p => p === page ? ["win-nav-btn", "active"] : ["win-nav-btn"]),
        onClicked: () => activePage.set(page),
        child: Widget.Box({
            spacing: 12,
            children: [
                Widget.Label({ label: icon, css_classes: ["win-nav-icon"] }),
                Widget.Label({ label: label, css_classes: ["win-nav-label"] })
            ]
        })
    })

    const sidebar = Widget.Box({
        css_classes: ["win-sidebar"],
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 4,
        children: [
            Widget.Box({
                css_classes: ["win-profile-area"],
                spacing: 12,
                children: [
                    Widget.Label({ label: "◈", css_classes: ["win-avatar"] }),
                    Widget.Box({
                        orientation: Gtk.Orientation.VERTICAL,
                        valign: Gtk.Align.CENTER,
                        children: [
                            Widget.Label({ label: "Ermete OS", css_classes: ["win-profile-name"], xalign: 0 }),
                            Widget.Label({ label: "Admin Locale", css_classes: ["win-profile-sub"], xalign: 0 })
                        ]
                    })
                ]
            }),
            Widget.Box({
                css_classes: ["win-search-box"],
                spacing: 8,
                children: [
                    Widget.Label({ label: "🔍", css_classes: ["win-search-icon"] }),
                    Widget.Label({ label: "Trova impostazione", css_classes: ["win-search-placeholder"] })
                ]
            }),
            Widget.Box({ css_classes: ["win-sidebar-divider"] }),
            mkNavBtn("🖥️", "Sistema", "sistema"),
            mkNavBtn("🎨", "Personalizzazione", "personalizzazione"),
            mkNavBtn("🛡️", "Informazioni", "info")
        ]
    })

    return PopupWindow({
        name: "settings-modal",
        namespace: "settings-modal",
        application: App,
        anchor: Astal.WindowAnchor.NONE,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        child: Widget.Box({
            css_classes: ["win-settings-window"],
            orientation: Gtk.Orientation.HORIZONTAL,
            children: [
                sidebar,
                Widget.Box({
                    css_classes: ["win-settings-content"],
                    hexpand: true,
                    vexpand: true,
                    children: [stack]
                })
            ]
        })
    })
}

// --- 3. MEDIA PLAYER DONGLE ---
export function MediaPlayerDongle() {
    const { TOP } = Astal.WindowAnchor

    const content = Widget.Box({
        css_classes: ["modal-box", "media-modal-box"],
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 18,
        children: [
            Widget.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 16,
                children: [
                    Widget.Label({ label: "♫", css_classes: ["media-modal-title"], style: "font-size: 2.4em;" }),
                    Widget.Box({
                        orientation: Gtk.Orientation.VERTICAL,
                        valign: Gtk.Align.CENTER,
                        children: [
                            Widget.Label({ label: mediaTrack(), css_classes: ["media-track-title"], xalign: 0 }),
                            Widget.Label({ label: mediaArtist(), css_classes: ["media-track-artist"], xalign: 0 })
                        ]
                    })
                ]
            }),
            Widget.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 14,
                halign: Gtk.Align.CENTER,
                children: [
                    Widget.Button({ css_classes: ["media-action-btn"], label: "⏮  Prev", onClicked: () => execAsync(["playerctl", "previous"]).catch(() => {}) }),
                    Widget.Button({ css_classes: ["media-action-btn"], label: isPlaying().as(p => p ? "⏸  Pause" : "▶  Play"), onClicked: () => execAsync(["playerctl", "play-pause"]).catch(() => {}) }),
                    Widget.Button({ css_classes: ["media-action-btn"], label: "Next  ⏭", onClicked: () => execAsync(["playerctl", "next"]).catch(() => {}) })
                ]
            })
        ]
    })

    return PopupWindow({
        name: "media-player",
        namespace: "media-player",
        application: App,
        anchor: TOP,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 40,
        child: content
    })
}

// --- 4. HARDWARE TELEMETRY DONGLE ("sys-monitor") ---
export function SysMonitorDongle() {
    const { TOP, RIGHT } = Astal.WindowAnchor

    const mkStatCard = (labelClass: string, icon: string, title: string, statVar: Variable<string>) => Widget.Box({
        css_classes: ["sysmon-card"],
        orientation: Gtk.Orientation.HORIZONTAL,
        children: [
            Widget.Label({ label: `${icon}  ${title}`, css_classes: ["sysmon-label", labelClass], hexpand: true, xalign: 0 }),
            Widget.Label({ label: statVar(), css_classes: ["sysmon-val"] })
        ]
    })

    return PopupWindow({
        name: "sys-monitor",
        namespace: "sys-monitor",
        application: App,
        anchor: TOP | RIGHT,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 40,
        marginRight: 260,
        child: Widget.Box({
            css_classes: ["modal-box", "sysmon-modal-box"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 14,
            children: [
                Widget.Label({ label: "Telemetria Hardware Live", css_classes: ["dongle-title"], xalign: 0 }),
                mkStatCard("cpu", "", "Processore CPU", cpuUsage),
                mkStatCard("ram", "", "Memoria RAM", ramUsage),
                mkStatCard("disk", "", "Archivio Root (/)", diskUsage),
                Widget.Box({
                    visible: battState().as(b => !b.includes("AC")),
                    child: mkStatCard("batt", "", "Batteria di Sistema", battState)
                })
            ]
        })
    })
}

// --- 5. APPLICATION LAUNCHER ---
export function LauncherModal() {
    const { TOP, LEFT } = Astal.WindowAnchor

    const searchEntry = new Gtk.Entry({
        placeholder_text: "Cerca applicazioni...",
        css_classes: ["launcher-entry"]
    })
    searchEntry.connect("changed", () => {
        if (searchEntry.get_text() && activeCategory.get() !== "Tutti") {
            activeCategory.set("Tutti")
        }
        queryVar.set(searchEntry.get_text())
        updateAppList()
    })
    searchEntry.connect("activate", () => {
        let first;
        if (queryVar.get()) {
            first = appsService.fuzzy_query(queryVar.get())[0]
        } else {
            const allowedCats = CATEGORY_MAP[activeCategory.get()] || []
            first = appsService.get_list().find(app => activeCategory.get() === "Tutti" || (app.categories && app.categories.some(c => allowedCats.includes(c))))
        }
        if (first) {
            first.launch()
            toggleExclusiveModal("launcher")
        }
    })

    const categorySidebar = Widget.Box({
        orientation: Gtk.Orientation.VERTICAL,
        css_classes: ["launcher-sidebar"],
        spacing: 4,
        children: ["Tutti", ...Object.keys(CATEGORY_MAP)].map(catName => 
            Widget.Button({
                css_classes: ["launcher-cat-btn"],
                label: catName,
                onClicked: () => {
                    activeCategory.set(catName)
                    searchEntry.set_text("")
                    queryVar.set("")
                    updateAppList()
                },
                setup: (self) => {
                    const updateClass = (val: string) => {
                        const isActive = val === catName;
                        const classes = self.css_classes.filter(c => c !== "active");
                        if (isActive) classes.push("active");
                        self.css_classes = classes;
                    }
                    updateClass(activeCategory.get())
                    activeCategory.subscribe(updateClass)
                }
            })
        )
    })

    const appsScroll = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        css_classes: ["launcher-scroll"],
        child: listbox
    })

    const win = PopupWindow({
        name: "launcher",
        namespace: "launcher",
        application: App,
        anchor: TOP | LEFT,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 40,
        marginLeft: 12,
        child: Widget.Box({
            css_classes: ["modal-box", "launcher-box"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 18,
            children: [
                Widget.Box({
                    css_classes: ["launcher-header"],
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 14,
                    children: [Widget.Label({ label: "", style: "font-size: 1.4em; color: #89b4fa;" }), searchEntry]
                }),
                Widget.Box({
                    orientation: Gtk.Orientation.HORIZONTAL,
                    css_classes: ["launcher-layout"],
                    spacing: 14,
                    children: [categorySidebar, appsScroll]
                })
            ]
        })
    })

    win.connect("notify::visible", () => {
        if (win.visible) {
            activeCategory.set("Tutti")
            queryVar.set("")
            searchEntry.set_text("")
            searchEntry.grab_focus()
            updateAppList()
        }
    })

    return win
}

// --- 5b. SPOTLIGHT SEARCH ---
const spotlightQueryVar = Variable("")
const spotlightListbox = new Gtk.ListBox({ css_classes: ["spotlight-list"] })
let appsScroll: Gtk.ScrolledWindow | null = null

export function evaluateMath(query: string): string | null {
    try {
        if (!/^[0-9+\-*/().\s,]+$/.test(query)) return null;
        const safeQuery = query.replace(/,/g, '.');
        const result = new Function(`return ${safeQuery}`)();
        if (result !== undefined && !isNaN(result)) {
            return String(result);
        }
    } catch {}
    return null;
}

export function updateSpotlightList() {
    let child = spotlightListbox.get_first_child()
    while (child) {
        const next = child.get_next_sibling()
        spotlightListbox.remove(child)
        child = next
    }
    
    const q = spotlightQueryVar.get().trim()
    if (!q) {
        if (appsScroll) appsScroll.visible = false
        return
    }
    
    if (appsScroll) appsScroll.visible = true
    let resultsAdded = 0;

    const mathResult = evaluateMath(q)
    if (mathResult) {
        const row = Widget.Box({
            css_classes: ["app-card", "spotlight-card"],
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 16,
            children: [
                Widget.Label({ label: "🧮", style: "font-size: 2.2em;" }),
                Widget.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    valign: Gtk.Align.CENTER,
                    children: [
                        Widget.Label({ label: mathResult, xalign: 0, css_classes: ["app-name", "spotlight-name"] }),
                        Widget.Label({ label: "Calcolatrice", xalign: 0, css_classes: ["app-desc", "spotlight-desc"] })
                    ]
                })
            ]
        })
        spotlightListbox.append(row)
        resultsAdded++
    }

    let apps = appsService.fuzzy_query(q).slice(0, 8)
    apps.forEach((app) => {
        const row = Widget.Box({
            css_classes: ["app-card", "spotlight-card"],
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 16,
            children: [
                Widget.Image({ icon_name: app.icon_name || "application-x-executable", pixel_size: 48, css_classes: ["app-icon"] }),
                Widget.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    valign: Gtk.Align.CENTER,
                    children: [
                        Widget.Label({ label: app.name, xalign: 0, css_classes: ["app-name", "spotlight-name"] }),
                        Widget.Label({ label: app.description || "Applicazione", xalign: 0, css_classes: ["app-desc", "spotlight-desc"] })
                    ]
                })
            ]
        })
        const gesture = new Gtk.GestureClick()
        gesture.connect("released", () => {
            app.launch()
            toggleExclusiveModal("spotlight")
        })
        row.add_controller(gesture)
        spotlightListbox.append(row)
        resultsAdded++
    })

    if (resultsAdded === 0 || (resultsAdded > 0 && !mathResult)) {
        const row = Widget.Box({
            css_classes: ["app-card", "spotlight-card"],
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 16,
            children: [
                Widget.Label({ label: "", style: "font-size: 2.2em; color: #a6adc8;" }),
                Widget.Box({
                    orientation: Gtk.Orientation.VERTICAL,
                    valign: Gtk.Align.CENTER,
                    children: [
                        Widget.Label({ label: `Esegui: ${q}`, xalign: 0, css_classes: ["app-name", "spotlight-name"] }),
                        Widget.Label({ label: "Comando di sistema (sh -c)", xalign: 0, css_classes: ["app-desc", "spotlight-desc"] })
                    ]
                })
            ]
        })
        const gesture = new Gtk.GestureClick()
        gesture.connect("released", () => {
            execAsync(["sh", "-c", q]).catch(() => {})
            toggleExclusiveModal("spotlight")
        })
        row.add_controller(gesture)
        spotlightListbox.append(row)
    }
}

export function SpotlightModal() {
    const { TOP } = Astal.WindowAnchor

    const searchEntry = new Gtk.Entry({
        placeholder_text: "Cerca app, comandi, calcoli...",
        css_classes: ["spotlight-entry"],
        hexpand: true
    })
    
    searchEntry.connect("changed", () => {
        spotlightQueryVar.set(searchEntry.get_text())
        updateSpotlightList()
    })
    
    searchEntry.connect("activate", () => {
        const q = spotlightQueryVar.get().trim()
        if (!q) return
        
        const mathResult = evaluateMath(q)
        if (!mathResult) {
            const first = appsService.fuzzy_query(q)[0]
            if (first) {
                first.launch()
            } else {
                execAsync(["sh", "-c", q]).catch(() => {})
            }
        }
        toggleExclusiveModal("spotlight")
    })

    appsScroll = new Gtk.ScrolledWindow({
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        css_classes: ["spotlight-scroll"],
        child: spotlightListbox,
        vexpand: true,
        visible: false
    })

    const win = PopupWindow({
        name: "spotlight",
        namespace: "spotlight",
        application: App,
        anchor: TOP,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 180,
        child: Widget.Box({
            css_classes: ["modal-box", "spotlight-box"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            children: [
                Widget.Box({
                    css_classes: ["spotlight-header"],
                    orientation: Gtk.Orientation.HORIZONTAL,
                    spacing: 16,
                    children: [Widget.Label({ label: "", style: "font-size: 1.8em; color: #a6adc8;" }), searchEntry]
                }),
                appsScroll
            ]
        })
    })

    win.connect("notify::visible", () => {
        if (win.visible) {
            spotlightQueryVar.set("")
            searchEntry.set_text("")
            searchEntry.grab_focus()
            if (appsScroll) appsScroll.visible = false
            updateSpotlightList()
        }
    })

    return win
}

// --- 6. SESSION POWER MENU ---
export function PowerMenuModal() {
    const { TOP } = Astal.WindowAnchor

    const mkPowerBtn = (cls: string, icon: string, label: string, cmd: string[]) => Widget.Button({
        css_classes: ["power-action-btn", cls],
        child: Widget.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            children: [
                Widget.Label({ label: icon, style: "font-size: 2.2em;" }),
                Widget.Label({ label })
            ]
        }),
        onClicked: () => {
            toggleExclusiveModal("powermenu")
            execAsync(cmd).catch(() => {})
        }
    })

    const grid = Widget.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 18,
        halign: Gtk.Align.CENTER,
        children: [
            mkPowerBtn("lock", "", "Blocca", ["sh", "-c", "loginctl lock-session 2>/dev/null || true"]),
            mkPowerBtn("suspend", "", "Sospendi", ["systemctl", "suspend"]),
            mkPowerBtn("reboot", "", "Riavvia", ["systemctl", "reboot"]),
            mkPowerBtn("shutdown", "⏻", "Spegni", ["systemctl", "poweroff"])
        ]
    })

    return PopupWindow({
        name: "powermenu",
        namespace: "powermenu",
        application: App,
        anchor: TOP,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 140,
        child: Widget.Box({
            css_classes: ["modal-box", "powermenu-overlay"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 26,
            children: [
                Widget.Label({ label: "Gestione Sessione • Ermete OS", css_classes: ["powermenu-title"], halign: Gtk.Align.CENTER }),
                grid,
                Widget.Button({
                    css_classes: ["power-cancel-btn"],
                    label: "Annulla e Torna al Desktop",
                    halign: Gtk.Align.CENTER,
                    onClicked: () => toggleExclusiveModal("powermenu")
                })
            ]
        })
    })
}

// --- 7. CALENDAR & EVENTS ---
export function CalendarModal() {
    const { TOP } = Astal.WindowAnchor

    const calendar = new Gtk.Calendar({ css_classes: ["matshell-calendar"] })

    return PopupWindow({
        name: "calendar",
        namespace: "calendar",
        application: App,
        anchor: TOP,
        exclusivity: Astal.Exclusivity.IGNORE,
        keymode: Astal.Keymode.EXCLUSIVE,
        visible: false,
        marginTop: 40,
        child: Widget.Box({
            css_classes: ["modal-box"],
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 16,
            children: [
                Widget.Label({ label: "Calendario e Eventi", css_classes: ["dongle-title"], xalign: 0 }),
                calendar
            ]
        })
    })
}

