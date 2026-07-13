use gtk4::prelude::*;
use gtk4::{Align, Application, ApplicationWindow, Box as GtkBox, Button, Entry, Image, Label, Orientation, ScrolledWindow};
use gtk4_layer_shell::{Edge, Layer, LayerShell};
use crate::ui::topbar::setup_popup_autoclose;
use gtk4::gio::AppInfo;

pub fn populate_launcher_list(list_box: &GtkBox, filter_text: &str, category_filter: &str, is_spotlight: bool, pop: &ApplicationWindow) {
    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }
    let filter_lower = filter_text.to_lowercase();

    if is_spotlight && filter_lower.starts_with('=') {
        let expr = filter_lower.trim_start_matches('=').trim();
        if let Ok(res) = meval::eval_str(expr) {
            let res_str = res.to_string();
            let row = Button::builder().css_classes(["spotlight-item"]).build();
            let hbox = GtkBox::builder().orientation(Orientation::Horizontal).spacing(16).build();
            let img = Image::builder().icon_name("accessories-calculator").pixel_size(40).build();
            hbox.append(&img);
            let vbox = GtkBox::builder().orientation(Orientation::Vertical).valign(Align::Center).build();
            let name_lbl = Label::builder().label(&format!("= {}", res_str)).halign(Align::Start).css_classes(["spotlight-item-title"]).build();
            vbox.append(&name_lbl);
            let desc_lbl = Label::builder().label("Risultato calcolatrice (clicca per copiare e chiudere)").halign(Align::Start).css_classes(["spotlight-item-desc"]).build();
            vbox.append(&desc_lbl);
            hbox.append(&vbox);
            row.set_child(Some(&hbox));
            let pop_clone = pop.clone();
            row.connect_clicked(move |_| {
                let clipboard = pop_clone.clipboard();
                clipboard.set_text(&res_str);
                pop_clone.close();
            });
            list_box.append(&row);
        }
        return;
    }

    if is_spotlight && filter_lower.starts_with('>') {
        let cmd = filter_text.trim_start_matches('>').trim();
        let row = Button::builder().css_classes(["spotlight-item"]).build();
        let hbox = GtkBox::builder().orientation(Orientation::Horizontal).spacing(16).build();
        let img = Image::builder().icon_name("utilities-terminal").pixel_size(40).build();
        hbox.append(&img);
        let vbox = GtkBox::builder().orientation(Orientation::Vertical).valign(Align::Center).build();
        let name_lbl = Label::builder().label(&format!("Esegui: {}", cmd)).halign(Align::Start).css_classes(["spotlight-item-title"]).build();
        vbox.append(&name_lbl);
        let desc_lbl = Label::builder().label("Lancia comando nel terminale").halign(Align::Start).css_classes(["spotlight-item-desc"]).build();
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

    if is_spotlight && filter_lower.starts_with('/') {
        let query = filter_text.trim_start_matches('/').trim();
        if !query.is_empty() {
            if let Ok(output) = std::process::Command::new("plocate")
                .arg("-l")
                .arg("5")
                .arg(&query)
                .output()
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut count = 0;
                for line in stdout.lines() {
                    if line.trim().is_empty() { continue; }
                    if count >= 5 { break; }
                    let row = Button::builder().css_classes(["spotlight-item"]).build();
                    let hbox = GtkBox::builder().orientation(Orientation::Horizontal).spacing(16).build();
                    let img = Image::builder().icon_name("text-x-generic").pixel_size(40).build();
                    hbox.append(&img);
                    let vbox = GtkBox::builder().orientation(Orientation::Vertical).valign(Align::Center).build();
                    let path = std::path::Path::new(line);
                    let name = path.file_name().unwrap_or_default().to_string_lossy();
                    let name_lbl = Label::builder().label(&name.to_string()).halign(Align::Start).css_classes(["spotlight-item-title"]).build();
                    vbox.append(&name_lbl);
                    let desc_lbl = Label::builder().label(line).halign(Align::Start).css_classes(["spotlight-item-desc"]).ellipsize(gtk4::pango::EllipsizeMode::Middle).build();
                    vbox.append(&desc_lbl);
                    hbox.append(&vbox);
                    row.set_child(Some(&hbox));
                    let pop_clone = pop.clone();
                    let file_path = line.to_string();
                    row.connect_clicked(move |_| {
                        let _ = std::process::Command::new("xdg-open").arg(&file_path).spawn();
                        pop_clone.close();
                    });
                    list_box.append(&row);
                    count += 1;
                }
                if count == 0 {
                    let no_res = Label::builder().label("Nessun file trovato.").css_classes(["cc-label-sub"]).margin_top(20).build();
                    list_box.append(&no_res);
                }
            }
        }
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
        let hbox = GtkBox::builder().orientation(Orientation::Horizontal).spacing(16).build();
        if let Some(icon) = app_info.icon() {
            let img = Image::from_gicon(&icon);
            img.set_pixel_size(40);
            hbox.append(&img);
        }
        let vbox = GtkBox::builder().orientation(Orientation::Vertical).valign(Align::Center).build();
        let name_lbl = Label::builder().label(name.as_str()).halign(Align::Start).css_classes(["spotlight-item-title"]).build();
        vbox.append(&name_lbl);
        if !desc.is_empty() {
            let desc_lbl = Label::builder().label(desc.as_str()).halign(Align::Start).css_classes(["spotlight-item-desc"]).ellipsize(gtk4::pango::EllipsizeMode::End).build();
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
pub fn show_spotlight_modal(app: &Application) {
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
        .spacing(0)
        .css_classes(["spotlight-card"])
        .build();

    let entry = Entry::builder()
        .placeholder_text("Cerca Spotlight...")
        .css_classes(["spotlight-input"])
        .hexpand(true)
        .margin_top(16)
        .margin_bottom(16)
        .margin_start(16)
        .margin_end(16)
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
