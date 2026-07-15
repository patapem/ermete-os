use gtk4::prelude::*;
use gtk4::{Align, Box, Button, Image, Label, Orientation, Switch};

pub fn build_page() -> gtk4::Box {
    let container = Box::builder()
        .orientation(Orientation::Vertical)
        .spacing(32)
        .margin_top(32)
        .margin_bottom(32)
        .margin_start(32)
        .margin_end(32)
        .build();

    // Title
    let title = Label::builder()
        .label("Account Utente")
        .halign(Align::Start)
        .css_classes(["title-1", "large-title"])
        .build();

    // User Profile Section
    let profile_box = Box::builder()
        .orientation(Orientation::Vertical)
        .spacing(16)
        .halign(Align::Center)
        .build();

    let avatar = Image::builder()
        .icon_name("avatar-default-symbolic")
        .pixel_size(128)
        .css_classes(["circular"])
        .build();

    let username = get_username();

    let name_label = Label::builder()
        .label(&username)
        .halign(Align::Center)
        .css_classes(["title-2"])
        .build();

    let role_label = Label::builder()
        .label("Amministratore")
        .halign(Align::Center)
        .css_classes(["dim-label"])
        .build();

    let name_box = Box::builder()
        .orientation(Orientation::Vertical)
        .spacing(4)
        .halign(Align::Center)
        .build();
    
    name_box.append(&name_label);
    name_box.append(&role_label);

    profile_box.append(&avatar);
    profile_box.append(&name_box);

    // Settings Section (Card-like)
    let settings_list = Box::builder()
        .orientation(Orientation::Vertical)
        .spacing(16)
        .css_classes(["card"])
        .build();

    // Change Password Row
    let password_row = Box::builder()
        .orientation(Orientation::Horizontal)
        .spacing(16)
        .margin_top(12)
        .margin_bottom(12)
        .margin_start(16)
        .margin_end(16)
        .build();

    let password_label_box = Box::builder()
        .orientation(Orientation::Vertical)
        .hexpand(true)
        .build();
    let password_title = Label::builder()
        .label("Password")
        .halign(Align::Start)
        .build();
    let password_desc = Label::builder()
        .label("Modifica la password di accesso")
        .halign(Align::Start)
        .css_classes(["dim-label"])
        .build();
    password_label_box.append(&password_title);
    password_label_box.append(&password_desc);

    let password_btn = Button::builder()
        .label("Cambia Password...")
        .valign(Align::Center)
        .build();
    
    password_btn.connect_clicked(|_| {
        println!("Dummy command: Password change requested.");
    });

    password_row.append(&password_label_box);
    password_row.append(&password_btn);

    // Auto Login Row
    let autologin_row = Box::builder()
        .orientation(Orientation::Horizontal)
        .spacing(16)
        .margin_top(12)
        .margin_bottom(12)
        .margin_start(16)
        .margin_end(16)
        .build();

    let autologin_label_box = Box::builder()
        .orientation(Orientation::Vertical)
        .hexpand(true)
        .build();
    let autologin_title = Label::builder()
        .label("Login Automatico")
        .halign(Align::Start)
        .build();
    let autologin_desc = Label::builder()
        .label("Accedi senza inserire la password all'avvio")
        .halign(Align::Start)
        .css_classes(["dim-label"])
        .build();
    autologin_label_box.append(&autologin_title);
    autologin_label_box.append(&autologin_desc);

    let autologin_switch = Switch::builder()
        .valign(Align::Center)
        .build();

    autologin_row.append(&autologin_label_box);
    autologin_row.append(&autologin_switch);

    settings_list.append(&password_row);
    // Add a separator here if you prefer using GtkSeparator
    let separator = gtk4::Separator::builder()
        .orientation(Orientation::Horizontal)
        .build();
    settings_list.append(&separator);
    settings_list.append(&autologin_row);

    container.append(&title);
    container.append(&profile_box);
    container.append(&settings_list);

    container
}

fn get_username() -> String {
    std::env::var("USER")
        .or_else(|_| std::env::var("LOGNAME"))
        .unwrap_or_else(|_| "ermete".to_string())
}
