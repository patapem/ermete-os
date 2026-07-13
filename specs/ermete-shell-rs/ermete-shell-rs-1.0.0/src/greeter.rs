use gtk4::prelude::*;
use gtk4::{Application, ApplicationWindow, Box, Button, Entry, Label, Orientation, Align};
use gtk4_layer_shell::{Edge, Layer, LayerShell};
use std::os::unix::net::UnixStream;
use std::io::{Read, Write};
use greetd_ipc::{Request, Response};

const GREETER_CSS: &str = r#"
window.background {
    background-color: rgba(10, 12, 16, 0.45);
}

.greeter-topbar-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 3px;
    color: rgba(255, 255, 255, 0.75);
}

.greeter-status-pill {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    background-color: rgba(255, 255, 255, 0.12);
    padding: 6px 14px;
    border-radius: 999px;
}

.greeter-clock-time {
    font-size: 68px;
    font-weight: 300;
    color: #ffffff;
    letter-spacing: -1px;
}

.greeter-clock-date {
    font-size: 18px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.80);
    margin-bottom: 12px;
}

.greeter-card {
    background-color: rgba(22, 25, 33, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 28px;
    padding: 36px 48px;
    min-width: 360px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
}

.greeter-avatar {
    font-size: 36px;
    color: #ffffff;
    background-color: rgba(255, 255, 255, 0.12);
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    min-width: 76px;
    min-height: 76px;
}

.greeter-user-name {
    font-size: 24px;
    font-weight: 700;
    color: #ffffff;
    margin-top: 12px;
}

.greeter-badge {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    color: rgba(255, 255, 255, 0.50);
    margin-top: 4px;
    margin-bottom: 18px;
}

.greeter-entry {
    background-color: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 14px;
    color: #ffffff;
    caret-color: #6ea8fe;
    font-size: 15px;
    padding: 12px 16px;
    min-height: 44px;
}

.greeter-entry:focus {
    border-color: #6ea8fe;
    background-color: rgba(255, 255, 255, 0.12);
}

.greeter-error {
    color: #ff6b6b;
    font-size: 13px;
    font-weight: 600;
    margin-top: 8px;
}

.greeter-power-btn {
    background-color: rgba(255, 255, 255, 0.10);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 20px;
}

.greeter-power-btn:hover {
    background-color: rgba(255, 255, 255, 0.18);
}
"#;

fn format_italian_date(now: &chrono::DateTime<chrono::Local>) -> String {
    use chrono::Datelike;
    let weekday = match now.weekday() {
        chrono::Weekday::Mon => "Lunedì",
        chrono::Weekday::Tue => "Martedì",
        chrono::Weekday::Wed => "Mercoledì",
        chrono::Weekday::Thu => "Giovedì",
        chrono::Weekday::Fri => "Venerdì",
        chrono::Weekday::Sat => "Sabato",
        chrono::Weekday::Sun => "Domenica",
    };
    let month = match now.month() {
        1 => "gennaio",
        2 => "febbraio",
        3 => "marzo",
        4 => "aprile",
        5 => "maggio",
        6 => "giugno",
        7 => "luglio",
        8 => "agosto",
        9 => "settembre",
        10 => "ottobre",
        11 => "novembre",
        12 => "dicembre",
        _ => "",
    };
    format!("{}, {} {}", weekday, now.day(), month)
}

fn send_request(stream: &mut UnixStream, req: &Request) -> Result<Response, String> {
    let json = serde_json::to_string(req).map_err(|e| e.to_string())?;
    let len = (json.len() as u32).to_ne_bytes();
    stream.write_all(&len).map_err(|e| e.to_string())?;
    stream.write_all(json.as_bytes()).map_err(|e| e.to_string())?;

    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).map_err(|e| e.to_string())?;
    let reply_len = u32::from_ne_bytes(len_buf);

    let mut reply_buf = vec![0u8; reply_len as usize];
    stream.read_exact(&mut reply_buf).map_err(|e| e.to_string())?;

    serde_json::from_slice(&reply_buf).map_err(|e| e.to_string())
}

fn resolve_target_username() -> String {
    let env_user = std::env::var("USER").unwrap_or_default();
    if env_user == "greeter" || env_user.is_empty() {
        std::env::var("ERMETE_LOGIN_USER").unwrap_or_else(|_| "ermete".to_string())
    } else {
        env_user
    }
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

fn authenticate(password: &str) -> Result<(), String> {
    let path = std::env::var("GREETD_SOCK").unwrap_or_else(|_| "/run/greetd.sock".to_string());
    let mut stream = UnixStream::connect(path).map_err(|e| e.to_string())?;

    let username = resolve_target_username();

    let session_cmd = if std::path::Path::new("/etc/greetd/ermete-session").exists() {
        "/etc/greetd/ermete-session".to_string()
    } else if std::path::Path::new("/usr/local/bin/ermete-session").exists() {
        "/usr/local/bin/ermete-session".to_string()
    } else {
        "ermete-session".to_string()
    };

    let req = Request::CreateSession { username };
    let resp = send_request(&mut stream, &req)?;

    match resp {
        Response::AuthMessage { .. } => {
            let req = Request::PostAuthMessageResponse { response: Some(password.to_string()) };
            let resp = send_request(&mut stream, &req)?;
            match resp {
                Response::Success => {
                    let req = Request::StartSession {
                        cmd: vec![session_cmd],
                        env: vec![],
                    };
                    let resp = send_request(&mut stream, &req)?;
                    match resp {
                        Response::Success => Ok(()),
                        Response::Error { description, .. } => Err(description),
                        _ => Err("Unexpected response to StartSession".to_string()),
                    }
                },
                Response::Error { description, .. } => Err(description),
                _ => Err("Unexpected response to PostAuthMessageResponse".to_string()),
            }
        },
        Response::Success => {
            let req = Request::StartSession {
                cmd: vec![session_cmd],
                env: vec![],
            };
            let resp = send_request(&mut stream, &req)?;
            match resp {
                Response::Success => Ok(()),
                Response::Error { description, .. } => Err(description),
                _ => Err("Unexpected response to StartSession".to_string()),
            }
        },
        Response::Error { description, .. } => Err(description),
    }
}

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

    if let Some(display) = gtk4::gdk::Display::default() {
        let provider = gtk4::CssProvider::new();
        provider.load_from_data(GREETER_CSS);
        gtk4::style_context_add_provider_for_display(
            &display,
            &provider,
            gtk4::STYLE_PROVIDER_PRIORITY_APPLICATION,
        );
    }

    let root_vbox = Box::builder()
        .orientation(Orientation::Vertical)
        .hexpand(true)
        .vexpand(true)
        .build();

    // Zone 1: Top Bar
    let topbar = Box::builder()
        .orientation(Orientation::Horizontal)
        .margin_top(20)
        .margin_start(28)
        .margin_end(28)
        .build();

    let os_title = Label::builder()
        .label("ERMETE OS")
        .css_classes(["greeter-topbar-title"])
        .build();

    let spacer = Box::builder()
        .orientation(Orientation::Horizontal)
        .hexpand(true)
        .build();

    let status_pill = Label::builder()
        .label("󰤨   󰁹   IT")
        .css_classes(["greeter-status-pill"])
        .build();

    topbar.append(&os_title);
    topbar.append(&spacer);
    topbar.append(&status_pill);

    // Zone 2: Center Clock + Card
    let center_box = Box::builder()
        .orientation(Orientation::Vertical)
        .valign(Align::Center)
        .halign(Align::Center)
        .hexpand(true)
        .vexpand(true)
        .spacing(24)
        .build();

    let clock_box = Box::builder()
        .orientation(Orientation::Vertical)
        .halign(Align::Center)
        .spacing(4)
        .build();

    let time_label = Label::builder()
        .css_classes(["greeter-clock-time"])
        .build();

    let date_label = Label::builder()
        .css_classes(["greeter-clock-date"])
        .build();

    let now = chrono::Local::now();
    time_label.set_text(&now.format("%H:%M").to_string());
    date_label.set_text(&format_italian_date(&now));

    let time_label_clone = time_label.clone();
    let date_label_clone = date_label.clone();
    glib::timeout_add_seconds_local(1, move || {
        let now = chrono::Local::now();
        time_label_clone.set_text(&now.format("%H:%M").to_string());
        date_label_clone.set_text(&format_italian_date(&now));
        glib::ControlFlow::Continue
    });

    clock_box.append(&time_label);
    clock_box.append(&date_label);

    let card_box = Box::builder()
        .orientation(Orientation::Vertical)
        .halign(Align::Center)
        .css_classes(["greeter-card"])
        .build();

    let avatar_label = Label::builder()
        .label("")
        .halign(Align::Center)
        .css_classes(["greeter-avatar"])
        .build();

    let display_user = capitalize_first(&resolve_target_username());
    let user_label = Label::builder()
        .label(&display_user)
        .halign(Align::Center)
        .css_classes(["greeter-user-name"])
        .build();

    let badge_label = Label::builder()
        .label("WAYLAND • NIRI")
        .halign(Align::Center)
        .css_classes(["greeter-badge"])
        .build();

    let password_entry = Entry::builder()
        .placeholder_text("Password di accesso...")
        .visibility(false)
        .css_classes(["greeter-entry"])
        .build();

    let error_label = Label::builder()
        .label("")
        .css_classes(["greeter-error"])
        .visible(false)
        .wrap(true)
        .build();

    let error_label_clone = error_label.clone();
    password_entry.connect_changed(move |_| {
        error_label_clone.set_visible(false);
    });

    let error_label_activate = error_label.clone();
    password_entry.connect_activate(move |entry| {
        let password = entry.text().to_string();
        entry.set_sensitive(false);
        error_label_activate.set_visible(false);

        let (sender, receiver) = glib::MainContext::channel::<Result<(), String>>(glib::Priority::DEFAULT);

        std::thread::spawn(move || {
            let res = authenticate(&password);
            let _ = sender.send(res);
        });

        let entry_clone = entry.clone();
        let err_clone = error_label_activate.clone();
        receiver.attach(None, move |res| {
            match res {
                Ok(_) => {
                    std::process::exit(0);
                }
                Err(e) => {
                    eprintln!("Login failed: {}", e);
                    err_clone.set_text(&format!("Accesso non riuscito: {}", e));
                    err_clone.set_visible(true);
                    entry_clone.set_text("");
                    entry_clone.set_sensitive(true);
                    entry_clone.grab_focus();
                }
            }
            glib::ControlFlow::Break
        });
    });

    card_box.append(&avatar_label);
    card_box.append(&user_label);
    card_box.append(&badge_label);
    card_box.append(&password_entry);
    card_box.append(&error_label);

    center_box.append(&clock_box);
    center_box.append(&card_box);

    // Zone 3: Bottom Power Buttons
    let bottom_bar = Box::builder()
        .orientation(Orientation::Horizontal)
        .halign(Align::Center)
        .margin_bottom(32)
        .spacing(16)
        .build();

    let suspend_btn = Button::builder()
        .label("Sospendi")
        .css_classes(["greeter-power-btn"])
        .build();
    suspend_btn.connect_clicked(|_| {
        if let Err(e) = std::process::Command::new("systemctl").arg("suspend").spawn() {
            eprintln!("Failed to spawn systemctl suspend: {}", e);
        }
    });

    let reboot_btn = Button::builder()
        .label("Riavvia")
        .css_classes(["greeter-power-btn"])
        .build();
    reboot_btn.connect_clicked(|_| {
        if let Err(e) = std::process::Command::new("systemctl").arg("reboot").spawn() {
            eprintln!("Failed to spawn systemctl reboot: {}", e);
        }
    });

    let poweroff_btn = Button::builder()
        .label("Spegni")
        .css_classes(["greeter-power-btn"])
        .build();
    poweroff_btn.connect_clicked(|_| {
        if let Err(e) = std::process::Command::new("systemctl").arg("poweroff").spawn() {
            eprintln!("Failed to spawn systemctl poweroff: {}", e);
        }
    });

    bottom_bar.append(&suspend_btn);
    bottom_bar.append(&reboot_btn);
    bottom_bar.append(&poweroff_btn);

    root_vbox.append(&topbar);
    root_vbox.append(&center_box);
    root_vbox.append(&bottom_bar);

    window.set_child(Some(&root_vbox));
    window.present();
}

