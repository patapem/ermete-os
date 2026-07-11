use chrono::Local;
use glib::clone;
use gtk4::gdk::Display;
use gtk4::prelude::*;
use gtk4::{
    Align, Application, ApplicationWindow, Box as GtkBox, CenterBox, CssProvider, Label,
    Orientation,
};
use gtk4_layer_shell::{Edge, Layer, LayerShell};

const APP_ID: &str = "os.ermete.Shell";

const TOPBAR_CSS: &str = r#"
window.topbar-window {
    background-color: transparent;
}

.topbar-container {
    background-color: rgba(18, 20, 26, 0.88);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: #e2e8f0;
    font-family: 'Inter', 'JetBrains Mono', 'Cantarell', sans-serif;
    font-size: 13px;
    font-weight: 500;
    padding: 0 16px;
}

.os-badge {
    background: linear-gradient(135deg, #38bdf8, #818cf8);
    color: #0f172a;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 6px;
    margin-right: 8px;
}

.session-badge {
    background-color: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 12px;
}

.clock-pill {
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #f8fafc;
    font-weight: 600;
    padding: 3px 14px;
    border-radius: 8px;
}

.status-pill {
    background-color: rgba(255, 255, 255, 0.05);
    color: #cbd5e1;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 12px;
}

.status-pill.accent {
    background-color: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
}
"#;

fn current_time_string() -> String {
    Local::now().format("%H:%M  ·  %a %d %b").to_string()
}

fn load_css() {
    let provider = CssProvider::new();
    provider.load_from_data(TOPBAR_CSS);
    if let Some(display) = Display::default() {
        gtk4::style_context_add_provider_for_display(
            &display,
            &provider,
            gtk4::STYLE_PROVIDER_PRIORITY_APPLICATION,
        );
    }
}

fn build_start_widget() -> GtkBox {
    let box_left = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(6)
        .valign(Align::Center)
        .build();

    let os_label = Label::builder()
        .label("◆ ERMETE OS")
        .css_classes(["os-badge"])
        .build();

    let session_label = Label::builder()
        .label("WAYLAND // NIRI")
        .css_classes(["session-badge"])
        .build();

    box_left.append(&os_label);
    box_left.append(&session_label);
    box_left
}

fn build_center_widget(clock_label: &Label) -> GtkBox {
    let box_center = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .valign(Align::Center)
        .build();

    clock_label.set_css_classes(&["clock-pill"]);
    box_center.append(clock_label);
    box_center
}

fn build_end_widget() -> GtkBox {
    let box_right = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(6)
        .valign(Align::Center)
        .build();

    let net_label = Label::builder()
        .label("NET OK")
        .css_classes(["status-pill"])
        .build();

    let sys_label = Label::builder()
        .label("SYS ACTIVE")
        .css_classes(["status-pill", "accent"])
        .build();

    box_right.append(&net_label);
    box_right.append(&sys_label);
    box_right
}

fn build_ui(app: &Application) {
    load_css();

    let window = ApplicationWindow::builder()
        .application(app)
        .title("Ermete Shell")
        .css_classes(["topbar-window"])
        .build();

    // Inizializza Wayland Layer Shell
    window.init_layer_shell();
    window.set_layer(Layer::Top);
    window.set_namespace("topbar");

    // Ancoraggio a Top, Left, Right
    window.set_anchor(Edge::Top, true);
    window.set_anchor(Edge::Left, true);
    window.set_anchor(Edge::Right, true);

    // Altezza fissa del pannello
    window.set_height_request(34);

    let container = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .css_classes(["topbar-container"])
        .hexpand(true)
        .build();

    let clock_label = Label::new(Some(&current_time_string()));

    let center_box = CenterBox::new();
    center_box.set_start_widget(Some(&build_start_widget()));
    center_box.set_center_widget(Some(&build_center_widget(&clock_label)));
    center_box.set_end_widget(Some(&build_end_widget()));
    center_box.set_hexpand(true);

    container.append(&center_box);
    window.set_child(Some(&container));

    // Aggiorna orologio ogni secondo
    glib::timeout_add_seconds_local(
        1,
        clone!(@weak clock_label => @default-return glib::ControlFlow::Break, move || {
            clock_label.set_label(&current_time_string());
            glib::ControlFlow::Continue
        }),
    );

    window.present();
}

fn main() -> glib::ExitCode {
    let app = Application::builder().application_id(APP_ID).build();
    app.connect_activate(build_ui);
    app.run()
}
