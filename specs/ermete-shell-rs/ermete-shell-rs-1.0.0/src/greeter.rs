use gtk4::prelude::*;
use gtk4::{Application, ApplicationWindow, Box, Entry, Label, Orientation, Align};
use gtk4_layer_shell::{Edge, Layer, LayerShell};

pub fn build_ui(app: &Application) {
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Ermete Greeter")
        .build();

    window.init_layer_shell();
    window.set_layer(Layer::Overlay);
    window.set_keyboard_mode(gtk4_layer_shell::KeyboardMode::Exclusive);
    
    window.set_anchor(Edge::Top, true);
    window.set_anchor(Edge::Bottom, true);
    window.set_anchor(Edge::Left, true);
    window.set_anchor(Edge::Right, true);
    
    let vbox = Box::builder()
        .orientation(Orientation::Vertical)
        .valign(Align::Center)
        .halign(Align::Center)
        .spacing(16)
        .build();
        
    let user_label = Label::new(Some("Ermete"));
    
    let password_entry = Entry::builder()
        .placeholder_text("Password...")
        .visibility(false)
        .build();
        
    vbox.append(&user_label);
    vbox.append(&password_entry);
    
    window.set_child(Some(&vbox));
    window.present();
}
