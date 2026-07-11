use chrono::Local;
use glib::clone;
use gtk4::gdk::Display;
use gtk4::gio::AppInfo;
use gtk4::prelude::*;
use gtk4::{
    Align, Application, ApplicationWindow, Box as GtkBox, Button, Calendar, CenterBox, CssProvider,
    Entry, Image, Label, Orientation, PasswordEntry, ProgressBar, Scale, ScrolledWindow, Switch,
};
use gtk4_layer_shell::{Edge, KeyboardMode, Layer, LayerShell};
use std::process::Command;

const APP_ID: &str = "os.ermete.Shell";

const TOPBAR_CSS: &str = r#"
/* ==========================================
   ERMETE OS - AUTHENTIC macOS MENU BAR 1:1
   ========================================== */

window.topbar-window {
    background-color: transparent;
}

.topbar-container {
    background: rgba(22, 22, 25, 0.88);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    color: #f5f5f7;
    font-family: -apple-system, 'SF Pro Text', 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    padding: 0 10px;
}

/* Authentic macOS Menu Bar Button Hover Style (Flat, rounded 5px rect on hover) */
.macos-menu-item {
    background: transparent;
    border: none;
    border-radius: 5px;
    padding: 2px 9px;
    color: #f5f5f7;
    font-size: 13px;
    font-weight: 500;
    transition: background 100ms ease;
}

.macos-menu-item:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
}

.macos-apple-logo {
    font-size: 15px;
    font-weight: 700;
    padding: 2px 8px;
}

.macos-app-title {
    font-weight: 700;
    color: #ffffff;
    padding: 2px 10px;
}

/* macOS Status Items (Right side) */
.macos-status-item {
    background: transparent;
    border: none;
    border-radius: 5px;
    padding: 2px 8px;
    color: #e2e8f0;
    font-size: 13px;
    transition: background 100ms ease;
}

.macos-status-item:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
}

.macos-clock {
    font-weight: 500;
    padding: 2px 9px;
}

/* ==========================================
   macOS SPOTLIGHT MODAL (Win+D)
   ========================================== */
window.spotlight-window {
    background-color: transparent;
}

.spotlight-card {
    background: rgba(28, 28, 32, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 30px 70px rgba(0, 0, 0, 0.80);
}

.spotlight-input {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #ffffff;
    font-size: 18px;
    padding: 10px 14px;
}

.spotlight-input:focus {
    border-color: #38bdf8;
}

.spotlight-item {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    color: #f5f5f7;
    font-size: 14px;
}

.spotlight-item:hover {
    background: rgba(10, 132, 255, 0.70);
    color: #ffffff;
}

/* ==========================================
   macOS CONTROL CENTER POPOVER
   ========================================== */
window.popup-window {
    background-color: transparent;
}

.cc-card {
    background: rgba(28, 28, 32, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 18px;
    padding: 14px;
    color: #f8fafc;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.75);
}

.cc-tile {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 10px;
    transition: background 120ms ease;
}

.cc-tile:hover {
    background: rgba(255, 255, 255, 0.11);
}

.cc-tile-row {
    background: transparent;
    border: none;
    border-radius: 10px;
    padding: 6px 8px;
    color: #f5f5f7;
    transition: background 100ms ease;
}

.cc-tile-row:hover {
    background: rgba(255, 255, 255, 0.08);
}

.cc-circle-blue {
    background: #0a84ff;
    border-radius: 999px;
    min-width: 28px;
    min-height: 28px;
    color: #ffffff;
    font-weight: 700;
}

.cc-circle-indigo {
    background: #5e5ce6;
    border-radius: 999px;
    min-width: 28px;
    min-height: 28px;
    color: #ffffff;
    font-weight: 700;
}

.cc-circle-gray {
    background: rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    min-width: 28px;
    min-height: 28px;
    color: #ffffff;
    font-weight: 700;
}

.cc-label-main {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
}

.cc-label-sub {
    font-size: 11px;
    font-weight: 500;
    color: #94a3b8;
}

.cc-tile-slider {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 10px 14px;
}

.cc-slider-icon {
    font-size: 15px;
    color: #f5f5f7;
}

.cc-quick-btn {
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 10px 6px;
    color: #f5f5f7;
    font-size: 12px;
    font-weight: 500;
    transition: background 120ms ease;
}

.cc-quick-btn:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff;
}

.cc-btn {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 8px 12px;
    color: #e2e8f0;
    font-weight: 500;
}

.cc-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
}

.cc-btn-danger {
    background: rgba(255, 69, 58, 0.25);
    border: 1px solid rgba(255, 69, 58, 0.45);
    border-radius: 8px;
    padding: 8px 12px;
    color: #ff8a80;
    font-weight: 600;
}

.cc-btn-danger:hover {
    background: rgba(255, 69, 58, 0.45);
    color: #ffffff;
}

progressbar.cc-progress-blue trough {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    min-height: 8px;
}
progressbar.cc-progress-blue progress {
    background: #0a84ff;
    border-radius: 6px;
    min-height: 8px;
}
progressbar.cc-progress-indigo trough {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    min-height: 8px;
}
progressbar.cc-progress-indigo progress {
    background: #5e5ce6;
    border-radius: 6px;
    min-height: 8px;
}
.applet-item {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px 12px;
    color: #f8fafc;
}

.metric-card {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 14px;
    padding: 14px 16px;
}
.metric-value {
    font-size: 26px;
    font-weight: 800;
    color: #ffffff;
}
.pro-applet-card {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 10px 14px;
}
.applet-header-card {
    background: rgba(255, 255, 255, 0.09);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    padding: 12px 16px;
}
.pro-applet-card-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 10px 14px;
    color: #ffffff;
    transition: all 0.15s ease;
}
.pro-applet-card-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.20);
}
.wifi-pwd-entry {
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 8px 12px;
    color: #ffffff;
    min-height: 38px;
}
"#;

// Orologio macOS: "sab 11 lug 14:47"
fn macos_clock_string() -> String {
    Local::now().format("%a %d %b %H:%M").to_string()
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

thread_local! {
    static ACTIVE_POPUP: std::cell::RefCell<Option<(String, glib::WeakRef<ApplicationWindow>)>> = std::cell::RefCell::new(None);
}

fn toggle_or_open_popup(tag: &str, open_fn: impl FnOnce()) {
    let mut to_close = None;
    let mut already_open = false;
    ACTIVE_POPUP.with(|p| {
        if let Some((old_tag, old_weak)) = p.borrow().as_ref() {
            if let Some(old_win) = old_weak.upgrade() {
                if old_win.is_visible() {
                    to_close = Some(old_win);
                    if old_tag == tag {
                        already_open = true;
                    }
                }
            }
        }
        *p.borrow_mut() = None;
    });

    if let Some(win) = to_close {
        win.close();
    }

    if !already_open {
        open_fn();
    }
}

fn setup_popup_autoclose(pop: &ApplicationWindow, tag: &str) {
    let mut to_close = None;
    ACTIVE_POPUP.with(|p| {
        if let Some((_, old_weak)) = p.borrow().as_ref() {
            if let Some(old_win) = old_weak.upgrade() {
                if old_win != *pop && old_win.is_visible() {
                    to_close = Some(old_win);
                }
            }
        }
        *p.borrow_mut() = Some((tag.to_string(), pop.downgrade()));
    });

    if let Some(win) = to_close {
        win.close();
    }

    pop.connect_close_request(move |win| {
        ACTIVE_POPUP.with(|p| {
            let mut clear = false;
            if let Some((_, old_weak)) = p.borrow().as_ref() {
                if let Some(old_win) = old_weak.upgrade() {
                    if old_win == *win {
                        clear = true;
                    }
                }
            }
            if clear {
                *p.borrow_mut() = None;
            }
        });
        glib::Propagation::Proceed
    });

    pop.set_keyboard_mode(KeyboardMode::OnDemand);

    let active_seen = std::rc::Rc::new(std::cell::Cell::new(false));
    let seen_clone = active_seen.clone();
    pop.connect_is_active_notify(move |win| {
        if win.is_active() {
            seen_clone.set(true);
        } else if seen_clone.get() {
            win.close();
        }
    });

    let focus_ctrl = gtk4::EventControllerFocus::new();
    let seen_enter = active_seen.clone();
    focus_ctrl.connect_enter(move |_| {
        seen_enter.set(true);
    });
    let seen_leave = active_seen.clone();
    let pop_leave = pop.clone();
    focus_ctrl.connect_leave(move |_| {
        if seen_leave.get() {
            pop_leave.close();
        }
    });
    pop.add_controller(focus_ctrl);

    let win_weak = pop.downgrade();
    let seen_clone2 = active_seen.clone();
    glib::timeout_add_local(std::time::Duration::from_millis(250), move || {
        if let Some(_) = win_weak.upgrade() {
            seen_clone2.set(true);
        }
        glib::ControlFlow::Break
    });

    let key_ctrl = gtk4::EventControllerKey::new();
    let pop_esc = pop.clone();
    key_ctrl.connect_key_pressed(move |_, keyval, _, _| {
        if keyval == gtk4::gdk::Key::Escape {
            pop_esc.close();
            glib::Propagation::Stop
        } else {
            glib::Propagation::Proceed
        }
    });
    pop.add_controller(key_ctrl);
}

fn populate_launcher_list(list_box: &GtkBox, filter_text: &str, category_filter: &str, is_spotlight: bool, pop: &ApplicationWindow) {
    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }
    let filter_lower = filter_text.to_lowercase();

    if is_spotlight && filter_lower.starts_with('=') {
        let expr = filter_lower.trim_start_matches('=').trim();
        if let Ok(output) = std::process::Command::new("bc").arg("-l").arg("-e").arg(expr).arg("-e").arg("quit").output() {
            let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !res.is_empty() {
                let row = Button::builder().css_classes(["spotlight-item"]).build();
                let hbox = GtkBox::builder().orientation(Orientation::Horizontal).spacing(12).build();
                let img = Image::builder().icon_name("accessories-calculator").pixel_size(32).build();
                hbox.append(&img);
                let vbox = GtkBox::builder().orientation(Orientation::Vertical).valign(Align::Center).build();
                let name_lbl = Label::builder().label(&format!("= {}", res)).halign(Align::Start).css_classes(["cc-label-main"]).build();
                vbox.append(&name_lbl);
                let desc_lbl = Label::builder().label("Risultato calcolatrice (clicca per copiare e chiudere)").halign(Align::Start).css_classes(["cc-label-sub"]).build();
                vbox.append(&desc_lbl);
                hbox.append(&vbox);
                row.set_child(Some(&hbox));
                let pop_clone = pop.clone();
                row.connect_clicked(move |_| {
                    let clipboard = pop_clone.clipboard();
                    clipboard.set_text(&res);
                    pop_clone.close();
                });
                list_box.append(&row);
            }
        }
        return;
    }

    if is_spotlight && filter_lower.starts_with('>') {
        let cmd = filter_text.trim_start_matches('>').trim();
        let row = Button::builder().css_classes(["spotlight-item"]).build();
        let hbox = GtkBox::builder().orientation(Orientation::Horizontal).spacing(12).build();
        let img = Image::builder().icon_name("utilities-terminal").pixel_size(32).build();
        hbox.append(&img);
        let vbox = GtkBox::builder().orientation(Orientation::Vertical).valign(Align::Center).build();
        let name_lbl = Label::builder().label(&format!("Esegui: {}", cmd)).halign(Align::Start).css_classes(["cc-label-main"]).build();
        vbox.append(&name_lbl);
        let desc_lbl = Label::builder().label("Lancia comando nel terminale").halign(Align::Start).css_classes(["cc-label-sub"]).build();
        vbox.append(&desc_lbl);
        hbox.append(&vbox);
        row.set_child(Some(&hbox));
        let pop_clone = pop.clone();
        let cmd_clone = cmd.to_string();
        row.connect_clicked(move |_| {
            let _ = std::process::Command::new("foot").arg("-e").arg("sh").arg("-c").arg(&format!("{}; read -p '\nPremi Invio per chiudere...'", cmd_clone)).spawn();
            pop_clone.close();
        });
        list_box.append(&row);
        return;
    }

    let mut apps: Vec<AppInfo> = AppInfo::all().into_iter().filter(|a| a.should_show()).collect();
    apps.sort_by(|a, b| a.display_name().to_lowercase().cmp(&b.display_name().to_lowercase()));
    let mut count = 0;
    for app_info in apps {
        let name = app_info.display_name();
        let desc = app_info.description().unwrap_or_default();
        let mut app_cats = String::new();
        if let Some(desktop_app) = app_info.downcast_ref::<gtk4::gio::DesktopAppInfo>() {
            if let Some(cats) = desktop_app.categories() {
                app_cats = cats.to_string().to_lowercase();
            }
        }
        if category_filter != "Tutte" && !category_filter.is_empty() {
            let match_found = match category_filter {
                "Internet" => app_cats.contains("network") || app_cats.contains("webbrowser"),
                "Ufficio" => app_cats.contains("office") || app_cats.contains("wordprocessor"),
                "Grafica" => app_cats.contains("graphics") || app_cats.contains("photography"),
                "Multimedia" => app_cats.contains("audiovideo") || app_cats.contains("audio") || app_cats.contains("video"),
                "Sviluppo" => app_cats.contains("development"),
                "Sistema" => app_cats.contains("system") || app_cats.contains("utility") || app_cats.contains("settings"),
                "Giochi" => app_cats.contains("game"),
                _ => false,
            };
            if !match_found { continue; }
        }
        if !filter_lower.is_empty() && !name.to_lowercase().contains(&filter_lower) && !desc.to_lowercase().contains(&filter_lower) {
            continue;
        }
        let row = Button::builder().css_classes(["spotlight-item"]).build();
        let hbox = GtkBox::builder().orientation(Orientation::Horizontal).spacing(12).build();
        if let Some(icon) = app_info.icon() {
            let img = Image::from_gicon(&icon);
            img.set_pixel_size(32);
            hbox.append(&img);
        }
        let vbox = GtkBox::builder().orientation(Orientation::Vertical).valign(Align::Center).build();
        let name_lbl = Label::builder().label(name.as_str()).halign(Align::Start).css_classes(["cc-label-main"]).build();
        vbox.append(&name_lbl);
        if !desc.is_empty() {
            let desc_lbl = Label::builder().label(desc.as_str()).halign(Align::Start).css_classes(["cc-label-sub"]).ellipsize(gtk4::pango::EllipsizeMode::End).build();
            vbox.append(&desc_lbl);
        }
        hbox.append(&vbox);
        row.set_child(Some(&hbox));
        let app_clone = app_info.clone();
        let pop_clone = pop.clone();
        row.connect_clicked(move |_| {
            let _ = app_clone.launch(&[], gtk4::gio::AppLaunchContext::NONE);
            pop_clone.close();
        });
        list_box.append(&row);
        count += 1;
    }
    if count == 0 {
        let no_res = Label::builder().label("Nessun risultato.").css_classes(["cc-label-sub"]).margin_top(20).build();
        list_box.append(&no_res);
    }
}

// macOS Spotlight Modal (Win+D / Clic su 🔍)
fn show_spotlight_modal(app: &Application) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Spotlight")
        .css_classes(["spotlight-window"])
        .default_width(620)
        .default_height(420)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "spotlight");
    pop.set_margin(Edge::Top, 140);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(12)
        .css_classes(["spotlight-card"])
        .build();

    let entry = Entry::builder()
        .placeholder_text("Cerca Spotlight...")
        .css_classes(["spotlight-input"])
        .build();

    let scroll = ScrolledWindow::builder()
        .hexpand(true)
        .vexpand(true)
        .min_content_height(300)
        .build();

    let list_box = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(4)
        .build();

    populate_launcher_list(&list_box, "", "", true, &pop);

    let list_clone = list_box.clone();
    let pop_clone2 = pop.clone();
    entry.connect_changed(move |e| {
        populate_launcher_list(&list_clone, &e.text(), "", true, &pop_clone2);
    });

    scroll.set_child(Some(&list_box));
    card.append(&entry);
    card.append(&scroll);

    pop.set_child(Some(&card));
    pop.present();
    entry.grab_focus();
}

fn build_cc_row(badge_class: &str, icon_glyph: &str, title: &str, sub: &str) -> Button {
    let btn = Button::builder().css_classes(["cc-tile-row"]).build();
    let row_box = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(10)
        .valign(Align::Center)
        .build();

    let badge = Label::builder()
        .label(icon_glyph)
        .css_classes([badge_class])
        .valign(Align::Center)
        .halign(Align::Center)
        .build();

    let text_box = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(1)
        .valign(Align::Center)
        .build();

    let lbl_title = Label::builder()
        .label(title)
        .css_classes(["cc-label-main"])
        .halign(Align::Start)
        .build();
    let lbl_sub = Label::builder()
        .label(sub)
        .css_classes(["cc-label-sub"])
        .halign(Align::Start)
        .build();

    text_box.append(&lbl_title);
    text_box.append(&lbl_sub);

    row_box.append(&badge);
    row_box.append(&text_box);
    btn.set_child(Some(&row_box));
    btn
}

fn build_cc_compact_tile(badge_class: &str, icon_glyph: &str, title: &str) -> Button {
    let btn = Button::builder().css_classes(["cc-tile"]).hexpand(true).build();
    let row_box = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(10)
        .valign(Align::Center)
        .build();

    let badge = Label::builder()
        .label(icon_glyph)
        .css_classes([badge_class])
        .valign(Align::Center)
        .halign(Align::Center)
        .build();

    let lbl = Label::builder()
        .label(title)
        .css_classes(["cc-label-main"])
        .halign(Align::Start)
        .build();

    row_box.append(&badge);
    row_box.append(&lbl);
    btn.set_child(Some(&row_box));
    btn
}

fn get_ram_info() -> (String, f64) {
    let mut total_kb = 0.0;
    let mut avail_kb = 0.0;
    if let Ok(content) = std::fs::read_to_string("/proc/meminfo") {
        for line in content.lines() {
            if line.starts_with("MemTotal:") {
                if let Some(val) = line.split_whitespace().nth(1) {
                    total_kb = val.parse::<f64>().unwrap_or(0.0);
                }
            } else if line.starts_with("MemAvailable:") {
                if let Some(val) = line.split_whitespace().nth(1) {
                    avail_kb = val.parse::<f64>().unwrap_or(0.0);
                }
            }
        }
    }
    if total_kb > 0.0 {
        let used_kb = total_kb - avail_kb;
        let frac = (used_kb / total_kb).clamp(0.0, 1.0);
        let used_gb = used_kb / 1048576.0;
        let total_gb = total_kb / 1048576.0;
        (
            format!("{:.1} GB / {:.1} GB ({:.0}%)", used_gb, total_gb, frac * 100.0),
            frac,
        )
    } else {
        ("N/D".to_string(), 0.0)
    }
}

fn get_cpu_load() -> (String, f64) {
    if let Ok(content) = std::fs::read_to_string("/proc/loadavg") {
        if let Some(load_str) = content.split_whitespace().next() {
            let load = load_str.parse::<f64>().unwrap_or(0.0);
            let frac = (load / 4.0).clamp(0.0, 1.0);
            return (format!("Carico 1m: {}", load_str), frac);
        }
    }
    ("N/D".to_string(), 0.0)
}

fn show_system_monitor_modal(app: &Application) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Monitor Risorse")
        .css_classes(["popup-window"])
        .default_width(360)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "sys-monitor");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Right, true);
    pop.set_margin(Edge::Top, 34);
    pop.set_margin(Edge::Right, 50);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(14)
        .css_classes(["cc-card"])
        .build();

    let header = Label::builder()
        .label("MONITOR DI SISTEMA — ERMETE OS")
        .css_classes(["cc-label-sub"])
        .halign(Align::Start)
        .build();

    // CPU Metric Card
    let (cpu_text, cpu_frac) = get_cpu_load();
    let cpu_card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(8)
        .css_classes(["metric-card"])
        .build();
    let cpu_top = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(10)
        .build();
    let cpu_val_lbl = Label::builder()
        .label(&format!("{:.0}%", cpu_frac * 100.0))
        .css_classes(["metric-value"])
        .halign(Align::Start)
        .build();
    let cpu_desc = Label::builder()
        .label(&format!("Processore\n{}", cpu_text))
        .css_classes(["cc-label-sub"])
        .halign(Align::Start)
        .hexpand(true)
        .build();
    cpu_top.append(&cpu_val_lbl);
    cpu_top.append(&cpu_desc);
    let cpu_bar = ProgressBar::builder()
        .fraction(cpu_frac)
        .css_classes(["cc-progress-blue"])
        .build();
    cpu_card.append(&cpu_top);
    cpu_card.append(&cpu_bar);

    // RAM Metric Card
    let (ram_text, ram_frac) = get_ram_info();
    let ram_card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(8)
        .css_classes(["metric-card"])
        .build();
    let ram_top = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(10)
        .build();
    let ram_val_lbl = Label::builder()
        .label(&format!("{:.0}%", ram_frac * 100.0))
        .css_classes(["metric-value"])
        .halign(Align::Start)
        .build();
    let ram_desc = Label::builder()
        .label(&format!("Memoria RAM\n{}", ram_text))
        .css_classes(["cc-label-sub"])
        .halign(Align::Start)
        .hexpand(true)
        .build();
    ram_top.append(&ram_val_lbl);
    ram_top.append(&ram_desc);
    let ram_bar = ProgressBar::builder()
        .fraction(ram_frac)
        .css_classes(["cc-progress-indigo"])
        .build();
    ram_card.append(&ram_top);
    ram_card.append(&ram_bar);

    let sys_info = Label::builder()
        .label("Wayland / Niri Compositor — Forgia Atomica RPM")
        .css_classes(["cc-label-sub"])
        .halign(Align::Start)
        .build();

    let close_btn = Button::builder()
        .label("Chiudi")
        .css_classes(["cc-quick-btn"])
        .build();
    let pop_clone = pop.clone();
    close_btn.connect_clicked(move |_| {
        pop_clone.close();
    });

    card.append(&header);
    card.append(&cpu_card);
    card.append(&ram_card);
    card.append(&sys_info);
    card.append(&close_btn);

    pop.set_child(Some(&card));
    pop.present();
}

fn show_wifi_password_modal(app: &Application, ssid: &str) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Autenticazione Wi-Fi")
        .css_classes(["popup-window"])
        .default_width(380)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "wifi-password");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Right, true);
    pop.set_margin(Edge::Top, 60);
    pop.set_margin(Edge::Right, 80);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(14)
        .css_classes(["cc-card"])
        .build();

    // Header
    let header_card = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .css_classes(["applet-header-card"])
        .valign(Align::Center)
        .build();
    let header_icon = Label::builder().label("").css_classes(["cc-circle-blue"]).build();
    let texts_box = GtkBox::builder().orientation(Orientation::Vertical).spacing(2).hexpand(true).build();
    let title_lbl = Label::builder().label("Accedi alla rete Wi-Fi").css_classes(["cc-label-main"]).halign(Align::Start).build();
    let sub_lbl = Label::builder().label(format!("Rete: {}", ssid)).css_classes(["cc-label-sub"]).halign(Align::Start).build();
    texts_box.append(&title_lbl);
    texts_box.append(&sub_lbl);
    header_card.append(&header_icon);
    header_card.append(&texts_box);

    // Password field
    let pwd_entry = PasswordEntry::builder()
        .placeholder_text("Inserisci la password Wi-Fi...")
        .show_peek_icon(true)
        .css_classes(["wifi-pwd-entry"])
        .hexpand(true)
        .build();

    // Security note
    let sec_note = Label::builder()
        .label("🔒  NetworkManager memorizzerà questa password per la riconnessione automatica.")
        .css_classes(["cc-label-sub"])
        .wrap(true)
        .halign(Align::Start)
        .build();

    // Status label
    let status_lbl = Label::builder()
        .label("")
        .css_classes(["cc-label-sub"])
        .halign(Align::Start)
        .build();

    // Action buttons
    let btn_box = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(10)
        .halign(Align::End)
        .build();

    let cancel_btn = Button::builder()
        .label("Annulla")
        .css_classes(["cc-quick-btn"])
        .build();
    let pop_cancel = pop.clone();
    cancel_btn.connect_clicked(move |_| {
        pop_cancel.close();
    });

    let connect_btn = Button::builder()
        .label("Connetti")
        .css_classes(["cc-quick-btn"])
        .build();

    let ssid_str = ssid.to_string();
    let pwd_clone = pwd_entry.clone();
    let pop_conn = pop.clone();
    let status_clone = status_lbl.clone();
    let do_connect = move || {
        let pwd = pwd_clone.text().to_string();
        if pwd.is_empty() {
            status_clone.set_label("⚠️ Inserisci prima la password.");
            return;
        }
        status_clone.set_label("⏳ Connessione in corso...");
        let _ = Command::new("nmcli")
            .args(["device", "wifi", "connect", &ssid_str, "password", &pwd])
            .spawn();
        pop_conn.close();
    };

    let do_conn_1 = do_connect.clone();
    connect_btn.connect_clicked(move |_| {
        do_conn_1();
    });

    let do_conn_2 = do_connect.clone();
    pwd_entry.connect_activate(move |_| {
        do_conn_2();
    });

    btn_box.append(&cancel_btn);
    btn_box.append(&connect_btn);

    card.append(&header_card);
    card.append(&pwd_entry);
    card.append(&sec_note);
    card.append(&status_lbl);
    card.append(&btn_box);

    pop.set_child(Some(&card));
    pop.present();
    pwd_entry.grab_focus();
}

fn show_wifi_details_modal(app: &Application, ssid: &str, active: bool) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title(format!("Configurazione Rete: {}", ssid))
        .css_classes(["popup-window"])
        .default_width(420)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "wifi-details");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Right, true);
    pop.set_margin(Edge::Top, 50);
    pop.set_margin(Edge::Right, 60);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(14)
        .css_classes(["cc-card"])
        .build();

    let header_card = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .css_classes(["applet-header-card"])
        .valign(Align::Center)
        .build();
    let header_icon = Label::builder().label("").css_classes(["cc-circle-blue"]).build();
    let texts_box = GtkBox::builder().orientation(Orientation::Vertical).spacing(2).hexpand(true).build();
    let title_lbl = Label::builder().label(ssid).css_classes(["cc-label-main"]).halign(Align::Start).build();
    let sub_lbl = Label::builder()
        .label(if active { "Connesso — Rete Salvata" } else { "Profilo Memorizzato" })
        .css_classes(["cc-label-sub"])
        .halign(Align::Start)
        .build();
    texts_box.append(&title_lbl);
    texts_box.append(&sub_lbl);
    header_card.append(&header_icon);
    header_card.append(&texts_box);

    let mut cur_method = "auto".to_string();
    let mut cur_ip = "".to_string();
    let mut cur_gw = "".to_string();
    let mut cur_dns = "".to_string();
    let mut cur_auto = true;

    if let Ok(output) = Command::new("nmcli")
        .args(["-g", "ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns,connection.autoconnect", "connection", "show", ssid])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().collect();
        if lines.len() >= 5 {
            cur_method = lines[0].trim().to_string();
            cur_ip = lines[1].trim().to_string();
            cur_gw = lines[2].trim().to_string();
            cur_dns = lines[3].trim().to_string();
            cur_auto = lines[4].trim() != "no";
        }
    }

    let ip_section = GtkBox::builder().orientation(Orientation::Vertical).spacing(8).build();
    let ip_header = Label::builder().label("CONFIGURAZIONE IP (IPv4)").css_classes(["cc-label-sub"]).halign(Align::Start).build();
    let dhcp_row = GtkBox::builder().orientation(Orientation::Horizontal).spacing(10).build();
    let dhcp_lbl = Label::builder().label("IP Automatico (DHCP)").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
    let dhcp_sw = Switch::builder().active(cur_method == "auto").valign(Align::Center).build();
    dhcp_row.append(&dhcp_lbl);
    dhcp_row.append(&dhcp_sw);

    let ip_entry = Entry::builder()
        .placeholder_text("Indirizzo IP/Subnet (es. 192.168.1.50/24)")
        .text(&cur_ip)
        .sensitive(cur_method != "auto")
        .build();
    let gw_entry = Entry::builder()
        .placeholder_text("Gateway Router (es. 192.168.1.1)")
        .text(&cur_gw)
        .sensitive(cur_method != "auto")
        .build();

    let ip_e_clone = ip_entry.clone();
    let gw_e_clone = gw_entry.clone();
    dhcp_sw.connect_state_set(move |_, is_dhcp| {
        ip_e_clone.set_sensitive(!is_dhcp);
        gw_e_clone.set_sensitive(!is_dhcp);
        glib::Propagation::Proceed
    });

    ip_section.append(&ip_header);
    ip_section.append(&dhcp_row);
    ip_section.append(&ip_entry);
    ip_section.append(&gw_entry);

    let dns_section = GtkBox::builder().orientation(Orientation::Vertical).spacing(8).build();
    let dns_header = Label::builder().label("SERVER DNS").css_classes(["cc-label-sub"]).halign(Align::Start).build();
    let dns_entry = Entry::builder()
        .placeholder_text("DNS Personalizzati (es. 1.1.1.1, 8.8.8.8)")
        .text(&cur_dns)
        .build();
    dns_section.append(&dns_header);
    dns_section.append(&dns_entry);

    let auto_row = GtkBox::builder().orientation(Orientation::Horizontal).spacing(10).build();
    let auto_lbl = Label::builder().label("Riconnetti automaticamente").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
    let auto_sw = Switch::builder().active(cur_auto).valign(Align::Center).build();
    auto_row.append(&auto_lbl);
    auto_row.append(&auto_sw);

    let btn_box = GtkBox::builder().orientation(Orientation::Horizontal).spacing(8).build();

    let forget_btn = Button::builder().label("Dimentica").css_classes(["cc-quick-btn"]).build();
    let ssid_f = ssid.to_string();
    let pop_f = pop.clone();
    forget_btn.connect_clicked(move |_| {
        let _ = Command::new("nmcli").args(["connection", "delete", &ssid_f]).spawn();
        pop_f.close();
    });

    let disc_btn = Button::builder().label("Disconnetti").css_classes(["cc-quick-btn"]).build();
    let ssid_d = ssid.to_string();
    let pop_d = pop.clone();
    disc_btn.connect_clicked(move |_| {
        let _ = Command::new("nmcli").args(["connection", "down", &ssid_d]).spawn();
        pop_d.close();
    });

    let save_btn = Button::builder().label("Salva e Applica").css_classes(["cc-quick-btn"]).hexpand(true).build();
    let ssid_s = ssid.to_string();
    let dhcp_sw_clone = dhcp_sw.clone();
    let ip_e_s = ip_entry.clone();
    let gw_e_s = gw_entry.clone();
    let dns_e_s = dns_entry.clone();
    let auto_sw_s = auto_sw.clone();
    let pop_s = pop.clone();
    save_btn.connect_clicked(move |_| {
        if dhcp_sw_clone.is_active() {
            let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.method", "auto"]).output();
        } else {
            let ip_val = ip_e_s.text().to_string();
            let gw_val = gw_e_s.text().to_string();
            if !ip_val.is_empty() {
                let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.method", "manual", "ipv4.addresses", &ip_val]).output();
                if !gw_val.is_empty() {
                    let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.gateway", &gw_val]).output();
                }
            }
        }
        let dns_val = dns_e_s.text().to_string();
        if dns_val.trim().is_empty() {
            let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.ignore-auto-dns", "no", "ipv4.dns", ""]).output();
        } else {
            let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.ignore-auto-dns", "yes", "ipv4.dns", &dns_val]).output();
        }
        let auto_val = if auto_sw_s.is_active() { "yes" } else { "no" };
        let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "connection.autoconnect", auto_val]).output();
        let _ = Command::new("nmcli").args(["connection", "up", &ssid_s]).output();
        pop_s.close();
    });

    btn_box.append(&forget_btn);
    if active {
        btn_box.append(&disc_btn);
    }
    btn_box.append(&save_btn);

    card.append(&header_card);
    card.append(&ip_section);
    card.append(&dns_section);
    card.append(&auto_row);
    card.append(&btn_box);

    pop.set_child(Some(&card));
    pop.present();
}

fn populate_wifi_list(list_box: &GtkBox, app: &Application, pop: &ApplicationWindow, wifi_enabled: bool) {
    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    if !wifi_enabled {
        let disabled_card = GtkBox::builder()
            .orientation(Orientation::Vertical)
            .spacing(6)
            .css_classes(["pro-applet-card"])
            .build();
        let lbl1 = Label::builder().label("󰖪  Rete Wi-Fi disattivata").css_classes(["cc-label-main"]).halign(Align::Start).build();
        let lbl2 = Label::builder().label("Attiva l'interruttore in alto per cercare e visualizzare le reti Wi-Fi vicine.").css_classes(["cc-label-sub"]).wrap(true).halign(Align::Start).build();
        disabled_card.append(&lbl1);
        disabled_card.append(&lbl2);
        list_box.append(&disabled_card);
        return;
    }

    let mut known_ssids = std::collections::HashSet::new();
    if let Ok(saved_out) = Command::new("nmcli").args(["-t", "-f", "NAME", "connection", "show"]).output() {
        for line in String::from_utf8_lossy(&saved_out.stdout).lines() {
            if !line.is_empty() {
                known_ssids.insert(line.trim().to_string());
            }
        }
    }

    if let Ok(output) = Command::new("nmcli")
        .args(["-t", "-f", "IN-USE,SSID,SIGNAL", "device", "wifi", "list"])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut count = 0;
        let mut seen = std::collections::HashSet::new();
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() >= 3 && !parts[1].is_empty() && count < 8 {
                let ssid = parts[1];
                if seen.contains(ssid) {
                    continue;
                }
                seen.insert(ssid.to_string());

                let active = parts[0] == "*";
                let saved = known_ssids.contains(ssid);
                let sig = parts[2].parse::<i32>().unwrap_or(50);
                let icon = if sig > 75 {
                    "󰤨"
                } else if sig > 40 {
                    "󰤥"
                } else {
                    "󰤢"
                };

                let item_row = Button::builder()
                    .css_classes(["pro-applet-card-btn"])
                    .build();

                let inner_box = GtkBox::builder()
                    .orientation(Orientation::Horizontal)
                    .spacing(10)
                    .build();

                let icon_lbl = Label::builder().label(icon).build();
                let texts = GtkBox::builder().orientation(Orientation::Vertical).hexpand(true).build();
                let ssid_lbl = Label::builder()
                    .label(ssid)
                    .css_classes(["cc-label-main"])
                    .halign(Align::Start)
                    .build();
                let status_text = if active {
                    "Connesso — Attiva"
                } else if saved {
                    "Salvato — Clicca per impostazioni"
                } else {
                    "Disponibile — Clicca per connetterti"
                };
                let status_lbl = Label::builder()
                    .label(status_text)
                    .css_classes(["cc-label-sub"])
                    .halign(Align::Start)
                    .build();
                texts.append(&ssid_lbl);
                texts.append(&status_lbl);

                inner_box.append(&icon_lbl);
                inner_box.append(&texts);

                if active {
                    let check_lbl = Label::builder().label("✓").css_classes(["cc-label-main"]).build();
                    inner_box.append(&check_lbl);
                }

                item_row.set_child(Some(&inner_box));

                let app_clone = app.clone();
                let pop_clone = pop.clone();
                let ssid_str = ssid.to_string();
                item_row.connect_clicked(move |_| {
                    pop_clone.close();
                    if active || saved {
                        show_wifi_details_modal(&app_clone, &ssid_str, active);
                    } else {
                        show_wifi_password_modal(&app_clone, &ssid_str);
                    }
                });

                list_box.append(&item_row);
                count += 1;
            }
        }
        if count == 0 {
            let no_wifi = Label::builder()
                .label("Nessuna rete Wi-Fi rilevata")
                .css_classes(["cc-label-sub"])
                .build();
            list_box.append(&no_wifi);
        }
    } else {
        let err_lbl = Label::builder()
            .label("Impossibile interrogare NetworkManager")
            .css_classes(["cc-label-sub"])
            .build();
        list_box.append(&err_lbl);
    }
}

fn show_wifi_popover(app: &Application) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Reti Wi-Fi")
        .css_classes(["popup-window"])
        .default_width(360)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "wifi");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Right, true);
    pop.set_margin(Edge::Top, 34);
    pop.set_margin(Edge::Right, 50);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(14)
        .css_classes(["cc-card"])
        .build();

    let header_card = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .css_classes(["applet-header-card"])
        .valign(Align::Center)
        .build();
    let header_icon = Label::builder().label("").css_classes(["cc-circle-blue"]).build();
    let header_lbl = Label::builder().label("Rete Wi-Fi").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
    let wifi_enabled = if let Ok(output) = Command::new("nmcli").args(["radio", "wifi"]).output() {
        String::from_utf8_lossy(&output.stdout).trim() == "enabled"
    } else {
        true
    };
    let wifi_sw = Switch::builder().active(wifi_enabled).valign(Align::Center).build();
    header_card.append(&header_icon);
    header_card.append(&header_lbl);
    header_card.append(&wifi_sw);

    let list_box = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(8)
        .build();

    populate_wifi_list(&list_box, app, &pop, wifi_enabled);

    let list_clone = list_box.clone();
    let app_clone = app.clone();
    let pop_clone = pop.clone();
    wifi_sw.connect_state_set(move |_, state| {
        let cmd = if state { "on" } else { "off" };
        let _ = Command::new("nmcli").args(["radio", "wifi", cmd]).spawn();
        populate_wifi_list(&list_clone, &app_clone, &pop_clone, state);
        glib::Propagation::Proceed
    });

    let close_btn = Button::builder()
        .label("Fine")
        .css_classes(["cc-quick-btn"])
        .build();
    let pop_clone2 = pop.clone();
    close_btn.connect_clicked(move |_| {
        pop_clone2.close();
    });

    card.append(&header_card);
    card.append(&list_box);
    card.append(&close_btn);

    pop.set_child(Some(&card));
    pop.present();
}

fn show_bluetooth_popover(app: &Application) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Bluetooth")
        .css_classes(["popup-window"])
        .default_width(360)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "bluetooth");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Right, true);
    pop.set_margin(Edge::Top, 34);
    pop.set_margin(Edge::Right, 50);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(14)
        .css_classes(["cc-card"])
        .build();

    let header_card = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .css_classes(["applet-header-card"])
        .valign(Align::Center)
        .build();
    let header_icon = Label::builder().label("").css_classes(["cc-circle-blue"]).build();
    let header_lbl = Label::builder().label("Bluetooth").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
    let bt_enabled = if let Ok(output) = Command::new("bluetoothctl").arg("show").output() {
        String::from_utf8_lossy(&output.stdout).contains("Powered: yes")
    } else {
        true
    };
    let bt_sw = Switch::builder().active(bt_enabled).valign(Align::Center).build();
    bt_sw.connect_state_set(move |_, state| {
        let cmd = if state { "on" } else { "off" };
        let _ = Command::new("bluetoothctl").args(["power", cmd]).spawn();
        glib::Propagation::Proceed
    });
    header_card.append(&header_icon);
    header_card.append(&header_lbl);
    header_card.append(&bt_sw);

    let list_box = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(8)
        .build();

    if let Ok(output) = Command::new("bluetoothctl").arg("devices").output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut count = 0;
        for line in stdout.lines() {
            let parts: Vec<&str> = line.splitn(3, ' ').collect();
            if parts.len() >= 3 && count < 8 {
                let name = parts[2];
                let item_row = GtkBox::builder()
                    .orientation(Orientation::Horizontal)
                    .spacing(10)
                    .css_classes(["pro-applet-card"])
                    .build();

                let icon_lbl = Label::builder().label("").build();
                let texts = GtkBox::builder().orientation(Orientation::Vertical).hexpand(true).build();
                let name_lbl = Label::builder()
                    .label(name)
                    .css_classes(["cc-label-main"])
                    .halign(Align::Start)
                    .build();
                let sub_lbl = Label::builder().label("Dispositivo Rilevato").css_classes(["cc-label-sub"]).halign(Align::Start).build();
                texts.append(&name_lbl);
                texts.append(&sub_lbl);

                item_row.append(&icon_lbl);
                item_row.append(&texts);
                list_box.append(&item_row);
                count += 1;
            }
        }
        if count == 0 {
            let no_bt = Label::builder()
                .label("Nessun dispositivo accoppiato")
                .css_classes(["cc-label-sub"])
                .build();
            list_box.append(&no_bt);
        }
    }

    let close_btn = Button::builder()
        .label("Fine")
        .css_classes(["cc-quick-btn"])
        .build();
    let pop_clone = pop.clone();
    close_btn.connect_clicked(move |_| {
        pop_clone.close();
    });

    card.append(&header_card);
    card.append(&list_box);
    card.append(&close_btn);

    pop.set_child(Some(&card));
    pop.present();
}

fn show_audio_mixer_popover(app: &Application) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Mixer Audio")
        .css_classes(["popup-window"])
        .default_width(360)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "media-player");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Right, true);
    pop.set_margin(Edge::Top, 34);
    pop.set_margin(Edge::Right, 50);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(14)
        .css_classes(["cc-card"])
        .build();

    let header_card = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .css_classes(["applet-header-card"])
        .valign(Align::Center)
        .build();
    let header_icon = Label::builder().label("🎚️").css_classes(["cc-slider-icon"]).build();
    let header_texts = GtkBox::builder().orientation(Orientation::Vertical).hexpand(true).build();
    let title_lbl = Label::builder().label("MIXER AUDIO ERMETE OS").css_classes(["cc-label-main"]).halign(Align::Start).build();
    let sub_lbl = Label::builder().label("PipeWire / WirePlumber").css_classes(["cc-label-sub"]).halign(Align::Start).build();
    header_texts.append(&title_lbl);
    header_texts.append(&sub_lbl);
    header_card.append(&header_icon);
    header_card.append(&header_texts);

    // Sezione Uscita Audio
    let out_card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(10)
        .css_classes(["pro-applet-card"])
        .build();
    let out_header = GtkBox::builder().orientation(Orientation::Horizontal).spacing(8).build();
    let out_lbl = Label::builder().label("🔊  Uscita Audio (Speaker/Cuffie)").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
    let mute_out_btn = Button::builder().label("Muto").css_classes(["cc-quick-btn"]).build();
    mute_out_btn.connect_clicked(move |_| {
        let _ = Command::new("wpctl").args(["set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"]).spawn();
    });
    out_header.append(&out_lbl);
    out_header.append(&mute_out_btn);

    let out_slider = Scale::with_range(Orientation::Horizontal, 0.0, 100.0, 1.0);
    out_slider.set_value(80.0);
    out_slider.set_hexpand(true);
    out_slider.connect_value_changed(move |s| {
        let val = s.value() as i32;
        let _ = Command::new("wpctl")
            .arg("set-volume")
            .arg("@DEFAULT_AUDIO_SINK@")
            .arg(format!("{}%", val))
            .spawn();
    });
    out_card.append(&out_header);
    out_card.append(&out_slider);

    // Sezione Ingresso Microfono
    let in_card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(10)
        .css_classes(["pro-applet-card"])
        .build();
    let in_header = GtkBox::builder().orientation(Orientation::Horizontal).spacing(8).build();
    let in_lbl = Label::builder().label("🎙  Ingresso Audio (Microfono)").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
    let mute_in_btn = Button::builder().label("Muto").css_classes(["cc-quick-btn"]).build();
    mute_in_btn.connect_clicked(move |_| {
        let _ = Command::new("wpctl").args(["set-mute", "@DEFAULT_AUDIO_SOURCE@", "toggle"]).spawn();
    });
    in_header.append(&in_lbl);
    in_header.append(&mute_in_btn);

    let in_slider = Scale::with_range(Orientation::Horizontal, 0.0, 100.0, 1.0);
    in_slider.set_value(75.0);
    in_slider.set_hexpand(true);
    in_slider.connect_value_changed(move |s| {
        let val = s.value() as i32;
        let _ = Command::new("wpctl")
            .arg("set-volume")
            .arg("@DEFAULT_AUDIO_SOURCE@")
            .arg(format!("{}%", val))
            .spawn();
    });
    in_card.append(&in_header);
    in_card.append(&in_slider);

    let close_btn = Button::builder()
        .label("Fine")
        .css_classes(["cc-quick-btn"])
        .build();
    let pop_clone = pop.clone();
    close_btn.connect_clicked(move |_| {
        pop_clone.close();
    });

    card.append(&header_card);
    card.append(&out_card);
    card.append(&in_card);
    card.append(&close_btn);

    pop.set_child(Some(&card));
    pop.present();
}

// macOS Control Center Popover (Clic su ❖)
fn show_control_center_popover(app: &Application) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Control Center")
        .css_classes(["popup-window"])
        .default_width(350)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "control-center");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Right, true);
    pop.set_margin(Edge::Top, 34);
    pop.set_margin(Edge::Right, 50);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(10)
        .css_classes(["cc-card"])
        .build();

    // 1. TOP SECTION (Grid a 2 Colonne)
    let top_grid = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(10)
        .build();

    // Colonna Sinistra (Connettività)
    let conn_box = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(4)
        .css_classes(["cc-tile"])
        .hexpand(true)
        .build();

    let (net_icon, net_title, net_sub) = get_network_status();
    let wifi_btn = build_cc_row("cc-circle-blue", &net_icon, &net_title, &net_sub);
    let app_wifi = app.clone();
    let pop_wifi = pop.clone();
    wifi_btn.connect_clicked(move |_| {
        pop_wifi.close();
        show_wifi_popover(&app_wifi);
    });
    let bt_btn = build_cc_row("cc-circle-blue", "", "Bluetooth", "Dispositivi");
    let app_bt = app.clone();
    let pop_bt = pop.clone();
    bt_btn.connect_clicked(move |_| {
        pop_bt.close();
        show_bluetooth_popover(&app_bt);
    });
    let sys_btn = build_cc_row("cc-circle-blue", "⚙", "Risorse", "Monitor Live");
    let app_sys = app.clone();
    let pop_sys = pop.clone();
    sys_btn.connect_clicked(move |_| {
        pop_sys.close();
        show_system_monitor_modal(&app_sys);
    });

    conn_box.append(&wifi_btn);
    conn_box.append(&bt_btn);
    conn_box.append(&sys_btn);

    // Colonna Destra (2 Card verticali)
    let right_col = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(10)
        .homogeneous(true)
        .hexpand(true)
        .build();

    let screenshot_tile = build_cc_compact_tile("cc-circle-indigo", "📷", "Screenshot");
    let pop_shot = pop.clone();
    screenshot_tile.connect_clicked(move |_| {
        pop_shot.close();
        let _ = Command::new("niri")
            .args(["msg", "action", "screenshot"])
            .spawn();
    });

    let lock_tile = build_cc_compact_tile("cc-circle-blue", "🔒", "Blocca");
    let pop_lock = pop.clone();
    lock_tile.connect_clicked(move |_| {
        pop_lock.close();
        let _ = Command::new("swaylock").spawn();
    });

    right_col.append(&screenshot_tile);
    right_col.append(&lock_tile);

    top_grid.append(&conn_box);
    top_grid.append(&right_col);

    // 2. MIDDLE SECTION (Slider Apple-Style)
    // Slider Luminosità
    let bright_card = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .css_classes(["cc-tile-slider"])
        .valign(Align::Center)
        .build();
    let bright_icon = Label::builder().label("☀").css_classes(["cc-slider-icon"]).build();
    let bright_slider = Scale::with_range(Orientation::Horizontal, 0.0, 100.0, 1.0);
    bright_slider.set_value(75.0);
    bright_slider.set_hexpand(true);
    bright_slider.connect_value_changed(move |s| {
        let val = s.value() as i32;
        let _ = Command::new("brightnessctl")
            .args(["set", &format!("{}%", val)])
            .spawn();
    });
    bright_card.append(&bright_icon);
    bright_card.append(&bright_slider);

    // Slider Volume Audio
    let audio_card = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .css_classes(["cc-tile-slider"])
        .valign(Align::Center)
        .build();
    let audio_icon = Label::builder().label("🔊").css_classes(["cc-slider-icon"]).build();
    let audio_slider = Scale::with_range(Orientation::Horizontal, 0.0, 100.0, 1.0);
    audio_slider.set_value(80.0);
    audio_slider.set_hexpand(true);
    audio_slider.connect_value_changed(move |s| {
        let val = s.value() as i32;
        let _ = Command::new("wpctl")
            .arg("set-volume")
            .arg("@DEFAULT_AUDIO_SINK@")
            .arg(format!("{}%", val))
            .spawn();
    });
    audio_card.append(&audio_icon);
    audio_card.append(&audio_slider);

    // 3. BOTTOM SECTION (4 Quick Toggles Grid)
    let bottom_grid = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(8)
        .homogeneous(true)
        .build();

    let dark_btn = Button::builder()
        .label("☾   Scuro")
        .css_classes(["cc-quick-btn"])
        .build();
    dark_btn.connect_clicked(move |_| {
        let _ = Command::new("gsettings")
            .args([
                "set",
                "org.gnome.desktop.interface",
                "color-scheme",
                "prefer-dark",
            ])
            .spawn();
    });

    let standby_btn = Button::builder()
        .label("🖥   Standby")
        .css_classes(["cc-quick-btn"])
        .build();
    let pop_std = pop.clone();
    standby_btn.connect_clicked(move |_| {
        pop_std.close();
        let _ = Command::new("niri")
            .args(["msg", "action", "power-off-monitors"])
            .spawn();
    });

    let mixer_btn = Button::builder()
        .label("🎚️   Mixer")
        .css_classes(["cc-quick-btn"])
        .build();
    let app_mixer = app.clone();
    let pop_mixer = pop.clone();
    mixer_btn.connect_clicked(move |_| {
        pop_mixer.close();
        show_audio_mixer_popover(&app_mixer);
    });

    let term_btn = Button::builder()
        .label(">_   Shell")
        .css_classes(["cc-quick-btn"])
        .build();
    let pop_term = pop.clone();
    term_btn.connect_clicked(move |_| {
        pop_term.close();
        let _ = Command::new("foot").spawn();
    });

    bottom_grid.append(&dark_btn);
    bottom_grid.append(&standby_btn);
    bottom_grid.append(&mixer_btn);
    bottom_grid.append(&term_btn);

    card.append(&top_grid);
    card.append(&bright_card);
    card.append(&audio_card);
    card.append(&bottom_grid);

    let key_ctrl = gtk4::EventControllerKey::new();
    let pop_esc = pop.clone();
    key_ctrl.connect_key_pressed(move |_, keyval, _, _| {
        if keyval == gtk4::gdk::Key::Escape {
            pop_esc.close();
            glib::Propagation::Stop
        } else {
            glib::Propagation::Proceed
        }
    });
    pop.add_controller(key_ctrl);

    pop.set_child(Some(&card));
    pop.present();
}

// KDE / Windows Style Start Menu Popover (Clic su ◈)
fn show_start_menu_popover(app: &Application) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Start Menu")
        .css_classes(["popup-window"])
        .default_width(560)
        .default_height(480)
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "launcher");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Left, true);
    pop.set_margin(Edge::Top, 32);
    pop.set_margin(Edge::Left, 8);

    let main_hbox = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(0)
        .css_classes(["cc-card"])
        .build();

    let sidebar = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(4)
        .build();
    sidebar.set_margin_top(14);
    sidebar.set_margin_bottom(14);
    sidebar.set_margin_start(14);
    sidebar.set_margin_end(14);

    let cats_lbl = Label::builder().label("CATEGORIE").css_classes(["cc-label-sub"]).halign(Align::Start).margin_bottom(6).build();
    sidebar.append(&cats_lbl);

    let list_box = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(4)
        .build();

    let search = Entry::builder()
        .placeholder_text("Cerca nel menu...")
        .css_classes(["spotlight-input"])
        .build();

    let current_category = std::rc::Rc::new(std::cell::RefCell::new("Tutte".to_string()));
    let cats = ["Tutte", "Internet", "Ufficio", "Grafica", "Multimedia", "Sviluppo", "Sistema", "Giochi"];
    
    for cat in cats {
        let btn = Button::builder().label(cat).css_classes(["spotlight-item"]).halign(Align::Fill).build();
        let cat_str = cat.to_string();
        let list_clone = list_box.clone();
        let entry_clone = search.clone();
        let pop_clone = pop.clone();
        let curr_cat = current_category.clone();
        btn.connect_clicked(move |_| {
            *curr_cat.borrow_mut() = cat_str.clone();
            populate_launcher_list(&list_clone, &entry_clone.text(), &cat_str, false, &pop_clone);
        });
        sidebar.append(&btn);
    }

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(10)
        .hexpand(true)
        .build();
    card.set_margin_top(14);
    card.set_margin_bottom(14);
    card.set_margin_end(14);

    let title = Label::builder()
        .label("◈  MENU APPLICAZIONI ERMETE OS")
        .css_classes(["cc-title"])
        .build();

    let scroll = ScrolledWindow::builder()
        .hexpand(true)
        .vexpand(true)
        .min_content_height(310)
        .build();

    populate_launcher_list(&list_box, "", "Tutte", false, &pop);

    let list_clone2 = list_box.clone();
    let pop_clone2 = pop.clone();
    let curr_cat2 = current_category.clone();
    search.connect_changed(move |e| {
        populate_launcher_list(&list_clone2, &e.text(), &curr_cat2.borrow(), false, &pop_clone2);
    });

    scroll.set_child(Some(&list_box));

    let footer = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(6)
        .build();

    let off_btn = Button::builder()
        .label("⏻  Spegni")
        .css_classes(["cc-btn-danger"])
        .hexpand(true)
        .build();
    off_btn.connect_clicked(move |_| {
        let _ = Command::new("systemctl").arg("poweroff").spawn();
    });

    let reb_btn = Button::builder()
        .label("↻  Riavvia")
        .css_classes(["cc-btn"])
        .hexpand(true)
        .build();
    reb_btn.connect_clicked(move |_| {
        let _ = Command::new("systemctl").arg("reboot").spawn();
    });

    footer.append(&off_btn);
    footer.append(&reb_btn);

    card.append(&title);
    card.append(&search);
    card.append(&scroll);
    card.append(&footer);

    main_hbox.append(&sidebar);
    
    let sep = gtk4::Separator::new(Orientation::Vertical);
    sep.set_margin_start(4);
    sep.set_margin_end(10);
    main_hbox.append(&sep);
    
    main_hbox.append(&card);

    let key_ctrl = gtk4::EventControllerKey::new();
    let pop_esc = pop.clone();
    key_ctrl.connect_key_pressed(move |_, keyval, _, _| {
        if keyval == gtk4::gdk::Key::Escape {
            pop_esc.close();
            glib::Propagation::Stop
        } else {
            glib::Propagation::Proceed
        }
    });
    pop.add_controller(key_ctrl);

    pop.set_child(Some(&main_hbox));
    pop.present();
    search.grab_focus();
}

// macOS Calendar Popover
fn show_calendar_popover(app: &Application) {
    let pop = ApplicationWindow::builder()
        .application(app)
        .title("Calendar")
        .css_classes(["popup-window"])
        .build();

    pop.init_layer_shell();
    pop.set_layer(Layer::Overlay);
    setup_popup_autoclose(&pop, "calendar");
    pop.set_anchor(Edge::Top, true);
    pop.set_anchor(Edge::Right, true);
    pop.set_margin(Edge::Top, 32);
    pop.set_margin(Edge::Right, 10);

    let card = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(10)
        .css_classes(["cc-card"])
        .build();

    let cal = Calendar::builder().build();
    let close_btn = Button::builder()
        .label("Chiudi")
        .css_classes(["cc-btn"])
        .build();
    close_btn.connect_clicked(clone!(@weak pop => move |_| {
        pop.close();
    }));

    card.append(&cal);
    card.append(&close_btn);
    pop.set_child(Some(&card));
    pop.present();
}

// Left Section: Authentic macOS Menu Bar items (Flat, no pills)
fn build_left_island(app: &Application) -> GtkBox {
    let box_left = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(1)
        .valign(Align::Center)
        .build();

    let apple_logo = Button::builder()
        .label("◈")
        .css_classes(["macos-menu-item", "macos-apple-logo"])
        .build();
    let app_clone = app.clone();
    apple_logo.connect_clicked(move |_| {
        show_start_menu_popover(&app_clone);
    });

    let app_title = Button::builder()
        .label("Ermete OS")
        .css_classes(["macos-menu-item", "macos-app-title"])
        .build();

    let file_item = Button::builder()
        .label("File")
        .css_classes(["macos-menu-item"])
        .build();
    let edit_item = Button::builder()
        .label("Modifica")
        .css_classes(["macos-menu-item"])
        .build();
    let view_item = Button::builder()
        .label("Vista")
        .css_classes(["macos-menu-item"])
        .build();
    let win_item = Button::builder()
        .label("Finestra")
        .css_classes(["macos-menu-item"])
        .build();

    box_left.append(&apple_logo);
    box_left.append(&app_title);
    box_left.append(&file_item);
    box_left.append(&edit_item);
    box_left.append(&view_item);
    box_left.append(&win_item);
    box_left
}

fn get_network_status() -> (String, String, String) {
    if let Ok(output) = Command::new("nmcli")
        .args(["-t", "-f", "TYPE,STATE,NAME", "connection", "show", "--active"])
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split(':').collect();
            if parts.len() >= 3 {
                let ctype = parts[0];
                let state = parts[1];
                let name = parts[2];
                if state == "activated" {
                    if ctype == "802-3-ethernet" || ctype == "ethernet" {
                        return ("󰈀".to_string(), "Ethernet".to_string(), "Connesso via cavo".to_string());
                    }
                    if ctype == "802-11-wireless" || ctype == "wifi" {
                        return ("".to_string(), "Rete Wi-Fi".to_string(), name.to_string());
                    }
                }
            }
        }
    }

    if let Ok(output) = Command::new("nmcli").args(["radio", "wifi"]).output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.trim() == "disabled" {
            return ("󰖪".to_string(), "Rete Wi-Fi".to_string(), "Disattivato".to_string());
        }
    }

    ("󰖪".to_string(), "Rete Wi-Fi".to_string(), "Non connesso".to_string())
}

// Right Section: Authentic macOS Dongles/Status Items
fn build_right_island(app: &Application, clock_label: &Label) -> (GtkBox, Button) {
    let box_right = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(2)
        .valign(Align::Center)
        .build();

    // 1. Battery / Power Dongle (macOS style)
    let batt_item = Button::builder()
        .label("100% 󰁹")
        .css_classes(["macos-status-item"])
        .build();

    // 2. Dynamic Network Dongle (macOS style: Ethernet/Wi-Fi/Off)
    let (init_icon, _, _) = get_network_status();
    let net_item = Button::builder()
        .label(&init_icon)
        .css_classes(["macos-status-item"])
        .build();
    let app_net = app.clone();
    net_item.connect_clicked(move |_| {
        show_wifi_popover(&app_net);
    });

    // 3. Spotlight Dongle (macOS style)
    let spot_item = Button::builder()
        .label("🔍")
        .css_classes(["macos-status-item"])
        .build();
    let app_clone1 = app.clone();
    spot_item.connect_clicked(move |_| {
        show_spotlight_modal(&app_clone1);
    });

    // 4. Control Center Dongle (macOS style)
    let cc_item = Button::builder()
        .label("❖")
        .css_classes(["macos-status-item"])
        .build();
    let app_clone2 = app.clone();
    cc_item.connect_clicked(move |_| {
        show_control_center_popover(&app_clone2);
    });

    // 5. Clock Dongle (macOS style)
    let clock_item = Button::builder()
        .css_classes(["macos-status-item", "macos-clock"])
        .build();
    clock_item.set_child(Some(clock_label));
    let app_clone3 = app.clone();
    clock_item.connect_clicked(move |_| {
        show_calendar_popover(&app_clone3);
    });

    box_right.append(&batt_item);
    box_right.append(&net_item);
    box_right.append(&spot_item);
    box_right.append(&cc_item);
    box_right.append(&clock_item);
    (box_right, net_item)
}

fn build_ui(app: &Application) {
    load_css();

    let window = ApplicationWindow::builder()
        .application(app)
        .title("Ermete Shell")
        .css_classes(["topbar-window"])
        .build();

    window.init_layer_shell();
    window.set_layer(Layer::Top);
    window.set_namespace("bar");
    window.auto_exclusive_zone_enable();

    window.set_anchor(Edge::Top, true);
    window.set_anchor(Edge::Left, true);
    window.set_anchor(Edge::Right, true);

    // macOS Sonoma / Sequoia height = 28px exactly
    window.set_height_request(28);

    let container = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .css_classes(["topbar-container"])
        .hexpand(true)
        .build();

    let clock_label = Label::new(Some(&macos_clock_string()));

    let center_box = CenterBox::new();
    center_box.set_start_widget(Some(&build_left_island(app)));
    // Center is empty exactly like macOS Menu Bar
    let (right_island, net_btn) = build_right_island(app, &clock_label);
    center_box.set_end_widget(Some(&right_island));
    center_box.set_hexpand(true);

    container.append(&center_box);
    window.set_child(Some(&container));

    glib::timeout_add_seconds_local(
        5,
        clone!(@weak clock_label, @weak net_btn => @default-return glib::ControlFlow::Break, move || {
            clock_label.set_label(&macos_clock_string());
            let (net_icon, _, _) = get_network_status();
            net_btn.set_label(&net_icon);
            glib::ControlFlow::Continue
        }),
    );

    window.present();
}

static UI_BUILT: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn handle_command(app: &Application, arg: &str) {
    match arg {
        "spotlight" | "launcher" => toggle_or_open_popup("spotlight", || show_spotlight_modal(app)),
        "control-center" => toggle_or_open_popup("control-center", || show_control_center_popover(app)),
        "sys-monitor" | "monitor" => toggle_or_open_popup("sys-monitor", || show_system_monitor_modal(app)),
        "calendar" => toggle_or_open_popup("calendar", || show_calendar_popover(app)),
        "media-player" | "mixer" | "audio" => toggle_or_open_popup("media-player", || show_audio_mixer_popover(app)),
        "wifi" => toggle_or_open_popup("wifi", || show_wifi_popover(app)),
        "bluetooth" => toggle_or_open_popup("bluetooth", || show_bluetooth_popover(app)),
        "start-menu" | "menu" => toggle_or_open_popup("launcher", || show_start_menu_popover(app)),
        _ => {}
    }
}

fn main() -> glib::ExitCode {
    let app = Application::builder()
        .application_id(APP_ID)
        .flags(gtk4::gio::ApplicationFlags::HANDLES_COMMAND_LINE)
        .build();

    app.connect_activate(|app| {
        if !UI_BUILT.swap(true, std::sync::atomic::Ordering::Relaxed) {
            build_ui(app);
        }
    });

    app.connect_command_line(|app, cmdline| {
        if !UI_BUILT.swap(true, std::sync::atomic::Ordering::Relaxed) {
            build_ui(app);
        }

        let args = cmdline.arguments();
        for arg_os in args.into_iter().skip(1) {
            let arg = arg_os.to_string_lossy();
            handle_command(app, &arg);
        }

        0
    });

    app.run()
}
