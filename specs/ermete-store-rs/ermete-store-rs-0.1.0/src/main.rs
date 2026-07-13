mod backend;
mod ui;

use gtk4::prelude::*;
use gtk4::Application;

fn main() {
    let app = Application::builder()
        .application_id("it.ermete.Store")
        .build();

    app.connect_activate(|app| {
        ui::build_ui(app);
    });

    app.run();
}
