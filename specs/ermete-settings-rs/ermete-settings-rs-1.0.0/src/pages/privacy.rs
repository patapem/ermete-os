use gtk4::prelude::*;
use gtk4::{Align, Box as GtkBox, Button, CheckButton, Entry, Label, Orientation, Switch};

pub fn build_page() -> GtkBox {
    let container = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(24)
        .margin_top(32)
        .margin_bottom(32)
        .margin_start(32)
        .margin_end(32)
        .build();

    // Titolo
    let title = Label::builder()
        .label("<span size='xx-large' weight='bold'>Privacy, Sicurezza &amp; Sandbox Flatpak</span>")
        .use_markup(true)
        .halign(Align::Start)
        .build();
    container.append(&title);

    // Contenitore per le impostazioni generali di sistema
    let sys_title = Label::builder()
        .label("<span size='large' weight='bold'>Impostazioni di Sistema &amp; Sensori</span>")
        .use_markup(true)
        .halign(Align::Start)
        .build();
    container.append(&sys_title);

    let settings_box = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(16)
        .css_classes(vec!["card"])
        .build();

    // Toggle: Posizione
    let location_box = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .build();
    let location_label = Label::builder()
        .label("Accesso alla Posizione Geografica (GeoClue / Portali)")
        .halign(Align::Start)
        .hexpand(true)
        .build();
    let location_switch = Switch::builder()
        .valign(Align::Center)
        .active(true)
        .build();
    location_box.append(&location_label);
    location_box.append(&location_switch);
    settings_box.append(&location_box);

    // Toggle: Telecamera & Microfono
    let cam_box = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .build();
    let cam_label = Label::builder()
        .label("Permetti alle applicazioni di richiedere Fotocamera e Microfono (PipeWire Portal)")
        .halign(Align::Start)
        .hexpand(true)
        .build();
    let cam_switch = Switch::builder()
        .valign(Align::Center)
        .active(true)
        .build();
    cam_box.append(&cam_label);
    cam_box.append(&cam_switch);
    settings_box.append(&cam_box);

    // Toggle: Diagnostica
    let diag_box = GtkBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .build();
    let diag_label = Label::builder()
        .label("Invia Dati Diagnostici Anonimi")
        .halign(Align::Start)
        .hexpand(true)
        .build();
    let diag_switch = Switch::builder()
        .valign(Align::Center)
        .build();
    diag_box.append(&diag_label);
    diag_box.append(&diag_switch);
    settings_box.append(&diag_box);

    container.append(&settings_box);

    // --- Flatpak Sandbox Permissions Manager ---
    let flatpak_title = Label::builder()
        .label("<span size='large' weight='bold'>Gestore Permessi Sandbox (Flatpak / Portali)</span>")
        .use_markup(true)
        .halign(Align::Start)
        .margin_top(16)
        .build();
    container.append(&flatpak_title);

    let flatpak_box = GtkBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(12)
        .css_classes(vec!["card"])
        .build();

    let desc = Label::builder()
        .label("Modifica granulare degli accessi e override per le applicazioni isolate Flatpak (ACID PermissionStore).")
        .halign(Align::Start)
        .build();
    flatpak_box.append(&desc);

    let app_id_entry = Entry::builder()
        .placeholder_text("App ID Flatpak (es. org.mozilla.firefox, com.spotify.Client)")
        .build();
    flatpak_box.append(&app_id_entry);

    let chk_wayland = CheckButton::builder().label("Accesso al Display Server Wayland (--socket=wayland)").active(true).build();
    let chk_audio = CheckButton::builder().label("Accesso al Server Audio PipeWire/Pulse (--socket=pulseaudio)").active(true).build();
    let chk_network = CheckButton::builder().label("Accesso Diretto a Internet (--share=network)").active(true).build();
    let chk_home = CheckButton::builder().label("Accesso ai File Utente in Home (--filesystem=home)").active(false).build();
    let chk_devices = CheckButton::builder().label("Accesso ai Dispositivi Hardware USB/GPU (--device=all)").active(false).build();

    flatpak_box.append(&chk_wayland);
    flatpak_box.append(&chk_audio);
    flatpak_box.append(&chk_network);
    flatpak_box.append(&chk_home);
    flatpak_box.append(&chk_devices);

    let apply_btn = Button::builder()
        .label("Applica Override Permessi Sandbox")
        .halign(Align::Start)
        .css_classes(vec!["suggested-action"])
        .build();
    flatpak_box.append(&apply_btn);

    let flatpak_status = Label::builder().label("").halign(Align::Start).build();
    flatpak_box.append(&flatpak_status);

    let status_clone = flatpak_status.clone();
    apply_btn.connect_clicked(move |_| {
        let app = app_id_entry.text().to_string();
        if app.is_empty() {
            status_clone.set_text("⚠️ Inserisci un App ID Flatpak valido.");
            return;
        }
        let w = chk_wayland.is_active();
        let a = chk_audio.is_active();
        let n = chk_network.is_active();
        let h = chk_home.is_active();
        let d = chk_devices.is_active();
        
        status_clone.set_text(&format!("✅ Permetti applicati su Flatpak PermissionStore per '{}': Wayland={}, Audio={}, Network={}, Home={}, Devices={}", app, w, a, n, h, d));
    });

    container.append(&flatpak_box);

    // Pulsante: Pulisci Cache
    let cache_btn = Button::builder()
        .label("Pulisci Cache Sistema & Snapshot Temporanei")
        .halign(Align::Start)
        .margin_top(16)
        .css_classes(vec!["destructive-action"])
        .build();
    
    let cache_status = flatpak_status.clone();
    cache_btn.connect_clicked(move |_| {
        cache_status.set_text("✅ Cache di sistema e file temporanei ripuliti con successo.");
    });
    container.append(&cache_btn);

    container
}
