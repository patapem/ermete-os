use gtk4::prelude::*;
use gtk4::{Application, ApplicationWindow, Label};
use gtk4_layer_shell::{Layer, LayerShell, Edge};

pub fn build_desktop_widgets(app: &Application) {
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Desktop Widgets")
        .build();

    // Initialize GTK4 Layer Shell
    window.init_layer_shell();

    // Set the layer to Bottom so it renders below standard windows (like on a desktop background)
    window.set_layer(Layer::Bottom);

    // Anchor to all edges to act as a full-screen desktop overlay
    window.set_anchor(Edge::Top, true);
    window.set_anchor(Edge::Bottom, true);
    window.set_anchor(Edge::Left, true);
    window.set_anchor(Edge::Right, true);

    // Allow keyboard interactivity if required
    window.set_keyboard_mode(gtk4_layer_shell::KeyboardMode::None);

    let container = gtk4::Box::new(gtk4::Orientation::Vertical, 10);
    container.set_halign(gtk4::Align::Center);
    container.set_valign(gtk4::Align::Center);

    let label = Label::new(Some("Desktop Widgets"));
    container.append(&label);

    window.set_child(Some(&container));
    window.present();
}
