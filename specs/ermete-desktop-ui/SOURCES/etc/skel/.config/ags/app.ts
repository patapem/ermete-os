import { App } from "astal/gtk4"
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
        // TopBar and System Panel are managed natively by ermete-shell-rs.
        // This JS code is now purely used for the Greeter.
        console.log("Desktop Shell is handled by ermete-shell-rs. AGS is only used for the Greeter here.")
        App.quit()
    }
})
