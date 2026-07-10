use gtk4::prelude::*;
use gtk4::{Application, ApplicationWindow, Label, Box, Orientation, Align};
use gtk4_layer_shell::{Edge, Layer, LayerShell};
use chrono::{Local, Timelike};

const APP_ID: &str = "os.ermete.Shell";

fn current_time_string() -> String {
    Local::now().format("%H:%M - %A %d %b").to_string()
}

fn main() -> glib::ExitCode {
    let app = Application::builder().application_id(APP_ID).build();
    app.connect_activate(build_ui);
    app.run()
}

fn build_ui(app: &Application) {
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Ermete Top Bar")
        .build();

    // Initialize Layer Shell
    window.init_layer_shell();
    window.set_layer(Layer::Top);
    window.set_namespace("topbar");
    
    // Anchor to top, left, right
    window.set_anchor(Edge::Top, true);
    window.set_anchor(Edge::Left, true);
    window.set_anchor(Edge::Right, true);
    
    // UI Layout
    let hbox = Box::builder()
        .orientation(Orientation::Horizontal)
        .spacing(10)
        .margin_top(4)
        .margin_bottom(4)
        .margin_start(12)
        .margin_end(12)
        .build();
        
    let time_label = Label::new(Some(&current_time_string()));
    time_label.set_halign(Align::Center);
    time_label.set_hexpand(true);
    
    hbox.append(&time_label);
    window.set_child(Some(&hbox));
    
    // Sync clock with the system minute boundary
    let seconds_to_next_minute = 60 - Local::now().second();
    glib::timeout_add_seconds_local_once(
        seconds_to_next_minute,
        glib::clone!(@weak time_label => move || {
            time_label.set_label(&current_time_string());
            // Then update exactly every 60 seconds
            glib::timeout_add_seconds_local(
                60,
                glib::clone!(@weak time_label => @default-return glib::ControlFlow::Break, move || {
                    time_label.set_label(&current_time_string());
                    glib::ControlFlow::Continue
                }),
            );
        }),
    );

    window.present();
}
