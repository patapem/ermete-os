use gtk4::prelude::*;
use gtk4::{Align, Box, Button, Label, ListBox, Orientation, Switch};

#[zbus::dbus_proxy(
    interface = "os.ermete.Bedrock.Bluetooth",
    default_service = "os.ermete.Bedrock",
    default_path = "/os/ermete/Bedrock/Bluetooth"
)]
trait Bluetooth {
    #[dbus_proxy(property)]
    fn power(&self) -> zbus::Result<bool>;
    #[dbus_proxy(property)]
    fn set_power(&self, value: bool) -> zbus::Result<()>;

    fn get_devices(&self) -> zbus::Result<Vec<String>>;
}

pub fn build_page() -> Box {
    let container = Box::builder()
        .orientation(Orientation::Vertical)
        .spacing(24)
        .margin_top(24)
        .margin_bottom(24)
        .margin_start(24)
        .margin_end(24)
        .build();

    let title = Label::builder()
        .label("Bluetooth")
        .halign(Align::Start)
        .css_classes(["title-1"])
        .build();

    container.append(&title);

    // Global Switch
    let switch_box = Box::builder()
        .orientation(Orientation::Horizontal)
        .spacing(12)
        .build();

    let switch_label = Label::builder()
        .label("Attiva Bluetooth")
        .halign(Align::Start)
        .hexpand(true)
        .build();

    let power_switch = Switch::builder()
        .valign(Align::Center)
        .build();

    // Set initial state
    let power_switch_clone = power_switch.clone();
    let ctx = gtk4::glib::MainContext::default();
    ctx.spawn_local(async move {
        if let Ok(conn) = zbus::Connection::session().await {
            if let Ok(proxy) = BluetoothProxy::new(&conn).await {
                if let Ok(power) = proxy.power().await {
                    power_switch_clone.set_active(power);
                }
            }
        }
    });

    power_switch.connect_active_notify(|switch| {
        let state = switch.is_active();
        let ctx = gtk4::glib::MainContext::default();
        ctx.spawn_local(async move {
            if let Ok(conn) = zbus::Connection::session().await {
                if let Ok(proxy) = BluetoothProxy::new(&conn).await {
                    let _ = proxy.set_power(state).await;
                }
            }
        });
    });

    switch_box.append(&switch_label);
    switch_box.append(&power_switch);
    container.append(&switch_box);

    // Search button
    let search_button = Button::builder()
        .label("Cerca Dispositivi")
        .halign(Align::Start)
        .build();

    // Mock list of devices
    let list_box = ListBox::builder()
        .selection_mode(gtk4::SelectionMode::None)
        .css_classes(["boxed-list"])
        .build();

    let list_box_clone = list_box.clone();

    search_button.connect_clicked(move |_| {
        let list_box = list_box_clone.clone();
        while let Some(child) = list_box.first_child() {
            list_box.remove(&child);
        }
        
        let ctx = gtk4::glib::MainContext::default();
        ctx.spawn_local(async move {
            if let Ok(conn) = zbus::Connection::session().await {
                if let Ok(proxy) = BluetoothProxy::new(&conn).await {
                    if let Ok(devices) = proxy.get_devices().await {
                        for device in devices {
                            let row_box = Box::builder()
                                .orientation(Orientation::Horizontal)
                                .spacing(12)
                                .margin_top(12)
                                .margin_bottom(12)
                                .margin_start(12)
                                .margin_end(12)
                                .build();
                                
                            let label = Label::new(Some(&device));
                            label.set_halign(Align::Start);
                            label.set_hexpand(true);
                            
                            let connect_btn = Button::builder()
                                .label("Connetti")
                                .valign(Align::Center)
                                .build();
                                
                            row_box.append(&label);
                            row_box.append(&connect_btn);
                            
                            list_box.append(&row_box);
                        }
                    }
                }
            }
        });
    });

    container.append(&search_button);
    container.append(&list_box);

    container
}
