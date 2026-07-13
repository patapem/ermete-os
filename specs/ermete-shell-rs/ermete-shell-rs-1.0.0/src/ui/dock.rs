use gtk4::prelude::*;
use gtk4::{Application, ApplicationWindow, Box as GtkBox, Label};
use gtk4_layer_shell::{Edge, Layer, LayerShell};

pub fn build_ui(app: &Application) {
    let window = ApplicationWindow::new(app);
    window.init_layer_shell();
    window.set_layer(Layer::Top);
    window.set_anchor(Edge::Bottom, true);
    window.set_margin(Edge::Bottom, 10);
    
    let container = GtkBox::new(gtk4::Orientation::Horizontal, 10);
    container.append(&Label::new(Some("Ermete Dock Placeholder")));
    window.set_child(Some(&container));
    window.present();
}
