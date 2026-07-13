use gtk4::prelude::*;
use gtk4::{Box, Orientation, Label, Scale, Align};
use std::process::Command;

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
    scale.set_value(0.5);

    scale.connect_value_changed(move |s| {
        let val = s.value();
        // In real execution, spawn a tokio thread to call zbus proxy.
        // For this step, we keep wpctl as fallback but the architecture is ready.
        let _ = Command::new("wpctl").args(["set-volume", "@DEFAULT_AUDIO_SINK@", &val.to_string()]).spawn();
    });

    container.append(&scale);
    container
}
