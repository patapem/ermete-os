use gtk4::prelude::*;
use gtk4::{Application, ApplicationWindow};

const APP_ID: &str = "os.ermete.Shell";

fn main() -> glib::ExitCode {
    let app = Application::builder().application_id(APP_ID).build();
    
    app.connect_activate(build_ui);
    
    app.run()
}

fn build_ui(app: &Application) {
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Ermete Shell")
        .build();
        
    window.present();
}
