pub mod pages;
use gtk4::prelude::*;
use gtk4::{Application, ApplicationWindow, Box as GtkBox, Orientation, Label, Stack, Align, ListBox, ListBoxRow, Image};

fn build_ui(app: &Application) {
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Impostazioni di Sistema")
        .default_width(960)
        .default_height(700)
        .build();

    let main_box = GtkBox::builder().orientation(Orientation::Horizontal).build();

    // Custom Sidebar
    let sidebar_container = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .width_request(260)
        .css_classes(["sidebar-container"])
        .build();

    // User profile header
    let profile_box = GtkBox::builder().orientation(Orientation::Horizontal).spacing(12).margin_top(16).margin_bottom(16).margin_start(16).build();
    let profile_img = Image::builder().icon_name("avatar-default").pixel_size(48).build();
    let profile_vbox = GtkBox::builder().orientation(Orientation::Vertical).valign(Align::Center).build();
    let profile_name = Label::builder().label("Ermete User").css_classes(["profile-name"]).halign(Align::Start).build();
    let profile_role = Label::builder().label("Amministratore").css_classes(["profile-role"]).halign(Align::Start).build();
    profile_vbox.append(&profile_name);
    profile_vbox.append(&profile_role);
    profile_box.append(&profile_img);
    profile_box.append(&profile_vbox);
    sidebar_container.append(&profile_box);

    let list_box = ListBox::builder().css_classes(["sidebar-list"]).build();
    list_box.set_selection_mode(gtk4::SelectionMode::Single);

    let stack = Stack::builder()
        .transition_type(gtk4::StackTransitionType::Crossfade)
        .hexpand(true)
        .vexpand(true)
        .css_classes(["stack-container"])
        .build();

    let categories = vec![
        ("Wi-Fi", "network-wireless", "wifi"),
        ("Bluetooth", "bluetooth-active", "bluetooth"),
        ("Rete", "network-wired", "network"),
        ("SEPARATOR", "", ""),
        ("Audio", "audio-volume-high", "audio"),
        ("Notifiche", "preferences-system-notifications", "notifications"),
        ("Focus", "weather-clear-night", "focus"),
        ("SEPARATOR", "", ""),
        ("Generali", "preferences-system", "general"),
        ("Aspetto", "preferences-desktop-theme", "appearance"),
        ("Desktop & Dock", "preferences-desktop", "desktop"),
        ("Schermi", "preferences-desktop-display", "displays"),
        ("SEPARATOR", "", ""),
        ("Batteria", "battery", "battery"),
        ("Tastiera", "input-keyboard", "keyboard"),
        ("Mouse & Trackpad", "input-mouse", "mouse"),
        ("SEPARATOR", "", ""),
        ("Account", "system-users", "accounts"),
        ("Privacy & Sicurezza", "security-high", "privacy"),
    ];

    let mut first_row = None;

    for (title, icon, id) in categories {
        if title == "SEPARATOR" {
            let sep = GtkBox::builder().height_request(10).build();
            list_box.append(&sep);
            continue;
        }

        let row = ListBoxRow::builder().build();
        let hbox = GtkBox::builder().orientation(Orientation::Horizontal).spacing(12).margin_start(12).margin_top(6).margin_bottom(6).build();
        let img = Image::builder().icon_name(icon).pixel_size(24).build();
        let lbl = Label::builder().label(title).css_classes(["sidebar-label"]).build();
        hbox.append(&img);
        hbox.append(&lbl);
        row.set_child(Some(&hbox));
        
        list_box.append(&row);

        if first_row.is_none() {
            first_row = Some(row.clone());
        }

        // Add dummy or real page to stack
        let page = if id == "appearance" {
            crate::pages::appearance::build_page()
        } else if id == "desktop" {
            crate::pages::desktop::build_page()
        } else if id == "displays" {
            crate::pages::displays::build_page()
        } else if id == "wifi" {
            crate::pages::network::build_page()
        } else if id == "audio" {
            crate::pages::audio::build_page()
        } else if id == "notifications" {
            crate::pages::notifications::build_page()
        } else if id == "battery" {
            crate::pages::battery::build_page()
        } else if id == "accounts" {
            crate::pages::accounts::build_page()
        } else if id == "keyboard" {
            crate::pages::keyboard::build_page()
        } else if id == "mouse" {
            crate::pages::mouse::build_page()
        } else if id == "general" {
            crate::pages::general::build_page()
        } else if id == "privacy" {
            crate::pages::privacy::build_page()
        } else if id == "bluetooth" {
            crate::pages::bluetooth::build_page()
        } else if id == "network" {
            crate::pages::wired::build_page()
        } else if id == "focus" {
            crate::pages::focus::build_page()
        } else {
            let p = GtkBox::builder().orientation(Orientation::Vertical).spacing(20).margin_top(40).margin_start(40).build();
            p.append(&Label::builder().label(title).css_classes(["title-1"]).halign(Align::Start).build());
            p.append(&Label::builder().label("Opzioni in costruzione...").css_classes(["subtitle"]).halign(Align::Start).build());
            p
        };
        stack.add_named(&page, Some(id));

    }

    if let Some(row) = first_row {
        list_box.select_row(Some(&row));
    }

    list_box.connect_row_selected(move |_, row| {
        if let Some(_row) = row {
            // This is just a quick binding for the prototype
            // The real logic should store the ID in the row
            // We'll fix this properly soon!
        }
    });

    // Fix connection properly
    let stack_clone = stack.clone();
    
    // We bind it correctly by looking at the label inside
    list_box.connect_row_selected(move |_, row| {
        if let Some(r) = row {
            if let Some(child) = r.child() {
                if let Some(hbox) = child.downcast_ref::<GtkBox>() {
                    if let Some(lbl_widget) = hbox.last_child() {
                        if let Some(lbl) = lbl_widget.downcast_ref::<Label>() {
                            let text = lbl.label().to_string();
                            let target_id = match text.as_str() {
                                "Wi-Fi" => "wifi",
                                "Bluetooth" => "bluetooth",
                                "Rete" => "network",
                                "Audio" => "audio",
                                "Notifiche" => "notifications",
                                "Focus" => "focus",
                                "Generali" => "general",
                                "Aspetto" => "appearance",
                                "Desktop & Dock" => "desktop",
                                "Schermi" => "displays",
                                "Batteria" => "battery",
                                "Tastiera" => "keyboard",
                                "Mouse & Trackpad" => "mouse",
                                "Account" => "accounts",
                                "Privacy & Sicurezza" => "privacy",
                                _ => "wifi"
                            };
                            stack_clone.set_visible_child_name(target_id);
                        }
                    }
                }
            }
        }
    });

    let scroll = gtk4::ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .vexpand(true)
        .child(&list_box)
        .build();

    sidebar_container.append(&scroll);
    
    main_box.append(&sidebar_container);
    main_box.append(&stack);

    window.set_child(Some(&main_box));
    
    // Apply basic CSS
    let provider = gtk4::CssProvider::new();
    provider.load_from_data("
        .title-1 { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .subtitle { font-size: 16px; color: #a6adc8; }
        window { background-color: #1e1e2e; color: #cdd6f4; }
        .sidebar-container { background-color: rgba(17, 17, 27, 0.9); border-right: 1px solid #313244; }
        .sidebar-list { background-color: transparent; }
        .sidebar-list row { padding: 4px 8px; margin: 2px 10px; border-radius: 8px; }
        .sidebar-list row:selected { background-color: rgba(10, 132, 255, 0.9); color: white; }
        .sidebar-label { font-size: 14px; font-weight: 500; }
        .profile-name { font-size: 16px; font-weight: bold; }
        .profile-role { font-size: 12px; color: #a6adc8; }
        .stack-container { background-color: #1e1e2e; }
    ");
    gtk4::style_context_add_provider_for_display(
        &gtk4::gdk::Display::default().unwrap(),
        &provider,
        gtk4::STYLE_PROVIDER_PRIORITY_APPLICATION,
    );

    window.present();
}

fn main() {
    let app = Application::builder()
        .application_id("os.ermete.Settings")
        .build();

    app.connect_activate(build_ui);
    app.run();
}
