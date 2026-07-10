import { App, Astal, Gtk, Gdk, Widget } from "astal/gtk4"
import { GLib } from "astal"
import { PopupWindow, timeState, dateState, uptimeState, cpuUsage, ramUsage, caffeineState, wifiState, btState, isPlaying, mediaTrack, niriWorkspaces, volState, volVal, micVal, brightVal, battState, mediaArtist, diskUsage, wifiExpanded, btExpanded, wifiList, btList, audioSinks, audioSources, appStreams, decoder, execSync, allModals, lastFocusLoss, toggleExclusiveModal, scanWifi, scanBt, updateAudioHub, audioTimer, appsService, queryVar, activeCategory, listbox, CATEGORY_MAP, updateAppList, SysTray } from "./state"
import { NiriWorkspaces, TopBar, WifiModal, BtModal, AudioModal, QuickSettingsModal, ErmeteSettingsModal, MediaPlayerDongle, SysMonitorDongle, LauncherModal, evaluateMath, updateSpotlightList, SpotlightModal, PowerMenuModal, CalendarModal } from "./modals"
import { NotificationPopups } from "./notifications"
import { PolkitAgent, PolkitModal } from "./polkit"
import { UDisksMonitor } from "./udisks"
import { ClipboardModal } from "./clipboard"
import { GeoclueModal, initGeoclueAgent } from "./geoclue"
import { Greeter } from "./greeter"
import GLib from "gi://GLib"

// --- APP INITIALIZATION ---
App.start({
    css: `${GLib.get_home_dir()}/.config/ags/style.css`,
    main() {
        if (GLib.getenv("GREETD_SOCK")) {
            Greeter()
            return
        }

        const configDir = GLib.get_home_dir() + "/.config/ags"
        const cssPath = configDir + "/style.css"
        const scssPath = configDir + "/style/main.scss"
        const componentsPath = configDir + "/style/components/normal"

        try {
            const { execSync } = imports.gi.GLib
            // If the style directory exists, compile the main SCSS file
            if (GLib.file_test(scssPath, GLib.FileTest.EXISTS)) {
                console.log(`Compiling SCSS from ${scssPath}`)
                // Use GLib.spawn_command_line_sync to execute the sass command
                GLib.spawn_command_line_sync(`sass --load-path="${componentsPath}" "${scssPath}" "${cssPath}"`)
            }
        } catch (e) {
            console.error("Failed to compile SCSS:", e)
        }

        App.get_monitors().forEach((mon, idx) => TopBar(mon, idx))
        NotificationPopups()
        WifiModal()
        BtModal()
        AudioModal()
        QuickSettingsModal()
        ErmeteSettingsModal()
        MediaPlayerDongle()
        SysMonitorDongle()
        LauncherModal()
        SpotlightModal()
        PowerMenuModal()
        CalendarModal()
        PolkitModal()
        PolkitAgent()
        UDisksMonitor()
        ClipboardModal()
        GeoclueModal()
        initGeoclueAgent()

        allModals.forEach(name => {
            const win = App.get_window(name)
            if (win) {
                // Close on ESC
                const keyCtrl = new Gtk.EventControllerKey()
                keyCtrl.connect("key-pressed", (ctrl, keyval) => {
                    if (keyval === 65307) { // Gdk.KEY_Escape
                        win.visible = false
                        return true
                    }
                    return false
                })
                win.add_controller(keyCtrl)
            }
        })

        updateAppList()
        scanWifi()
        scanBt()
        updateAudioHub()
    },
    requestHandler(args, res) {
        const cmd = args[0]
        if (cmd === "toggle") {
            const target = args[1] || "quick-settings"
            const actual = target === "control-center" ? "quick-settings" : target
            toggleExclusiveModal(actual)
            res(`Toggled ${actual}`)
        } else {
            res("Unknown command")
        }
    }
})
