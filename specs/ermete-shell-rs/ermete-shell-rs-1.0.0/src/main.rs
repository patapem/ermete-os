use clap::Parser;
use gtk4::prelude::*;
use gtk4::{gio, Application};

// Dummy modules for now
mod ui;
mod greeter;
mod core;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(long)]
    topbar: bool,
    #[arg(long)]
    greeter: bool,
    #[arg(long)]
    lock: bool,
    #[arg(long)]
    spotlight: bool,
    #[arg(long)]
    launcher: bool,
    #[arg(long)]
    dock: bool,
    #[arg(long)]
    control_center: bool,
    #[arg(long)]
    media_player: bool,
    #[arg(long)]
    sys_monitor: bool,
    #[arg(long)]
    calendar: bool,
    #[arg(long)]
    powermenu: bool,
    #[arg(long)]
    clipboard: bool,
}

const APP_ID: &str = "os.ermete.Shell";

fn main() -> glib::ExitCode {
    let args = Args::parse();

    // If greeter or lock mode is requested explicitly, run standalone authentication app
    if args.greeter || args.lock {
        let is_lock = args.lock;
        let app_id = if is_lock { "os.ermete.Lockscreen" } else { "os.ermete.Greeter" };
        let app = Application::builder()
            .application_id(app_id)
            .build();
        app.connect_activate(move |app| {
            greeter::build_ui(app, is_lock);
        });
        return app.run_with_args(&Vec::<String>::new());
    }

    if args.dock {
        let app = Application::builder()
            .application_id("os.ermete.Dock")
            .flags(gio::ApplicationFlags::HANDLES_COMMAND_LINE)
            .build();
        app.connect_activate(|app| {
            static ACTIVATED_DOCK: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
            if !ACTIVATED_DOCK.swap(true, std::sync::atomic::Ordering::SeqCst) {
                ui::dock::build_ui(app);
            } else {
                ui::dock::toggle_dock_visibility();
            }
        });
        app.connect_command_line(|app, _cmdline| {
            app.activate();
            0
        });
        return app.run();
    }

    let app = Application::builder()
        .application_id(APP_ID)
        .flags(gio::ApplicationFlags::HANDLES_COMMAND_LINE)
        .build();

    app.connect_activate(move |app| {
        static ACTIVATED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
        if !ACTIVATED.swap(true, std::sync::atomic::Ordering::SeqCst) {
            ui::topbar::build_ui(app);
            crate::ui::osd::spawn_osd(app);
        }
    });

    app.connect_command_line(move |app, cmdline| {
        app.activate();
        let args = cmdline.arguments();
        for arg in args.iter().skip(1) {
            let s = arg.to_string_lossy();
            let clean = s.trim_start_matches("--");
            crate::ui::topbar::handle_command(app, clean);
        }
        0
    });

    // Pass original CLI args to run so GTK forwards them to primary instance
    app.run()
}
