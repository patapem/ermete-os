use gtk4::prelude::*;
use gtk4::{Align, Box, Label, Orientation, Scale};
use std::process::Command;

fn get_current_volume() -> f64 {
    if let Ok(output) = Command::new("wpctl")
        .args(["get-volume", "@DEFAULT_AUDIO_SINK@"])
        .output()
    {
        if let Ok(text) = std::str::from_utf8(&output.stdout) {
            for token in text.split_whitespace() {
                if let Ok(val) = token.parse::<f64>() {
                    return val.clamp(0.0, 1.0);
                }
            }
        }
    }
    0.5
}

pub fn build_page() -> Box {
    let container = Box::builder()
        .orientation(Orientation::Vertical)
        .spacing(24)
        .margin_top(24)
        .margin_start(24)
        .margin_end(24)
        .build();

    let title = Label::builder()
        .label("Audio e Suoni (DBus)")
        .halign(Align::Start)
        .css_classes(["title-1"])
        .build();
    container.append(&title);

    let scale = Scale::with_range(gtk4::Orientation::Horizontal, 0.0, 1.0, 0.05);
    let initial_volume = get_current_volume();
    scale.set_value(initial_volume);

    scale.connect_value_changed(move |s| {
        let val = s.value();
        let vol_str = format!("{:.2}", val);
        let _ = Command::new("wpctl")
            .args(["set-volume", "@DEFAULT_AUDIO_SINK@", &vol_str])
            .spawn();
    });

    container.append(&scale);
    container
}

