import { App, Astal, Gtk, Gdk } from "astal/gtk4"

export default function Wallpaper(monitor: Gdk.Monitor) {
    return <window
        name={`wallpaper-${monitor}`}
        namespace="wallpaper"
        monitor={monitor}
        layer={Astal.Layer.BACKGROUND}
        anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
        exclusivity={Astal.Exclusivity.IGNORE}
        keymode={Astal.Keymode.NONE}
        visible={true}
    >
        <box
            css={`
                background-image: url("/usr/share/backgrounds/ermete/default.png");
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
            `}
        />
    </window>
}
