use gtk4::prelude::*;
use gtk4::{Box, Button, Label, ListBox, Orientation};

#[zbus::dbus_proxy(
    interface = "os.ermete.Bedrock.Network",
    default_service = "os.ermete.Bedrock",
    default_path = "/os/ermete/Bedrock/Network"
)]
trait Network {
    fn scan_networks(&self) -> zbus::Result<Vec<String>>;
}

pub fn build_page() -> Box {
    let container = Box::new(Orientation::Vertical, 16);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    // Title
    let title = Label::new(Some("Rete (Wi-Fi)"));
    title.add_css_class("title-1");
    title.set_halign(gtk4::Align::Start);
    container.append(&title);

    // Scan Button
    let scan_btn = Button::with_label("Scansiona Reti");
    scan_btn.set_halign(gtk4::Align::Start);
    container.append(&scan_btn);

    // ListBox for networks
    let list_box = ListBox::new();
    list_box.add_css_class("boxed-list");
    container.append(&list_box);

    let list_box_clone = list_box.clone();

    // Connect scan button click handler
    scan_btn.connect_clicked(move |_| {
        let list_box = list_box_clone.clone();
        // Clear list_box first
        while let Some(child) = list_box.first_child() {
            list_box.remove(&child);
        }

        let ctx = gtk4::glib::MainContext::default();
        ctx.spawn_local(async move {
            if let Ok(conn) = zbus::Connection::session().await {
                if let Ok(proxy) = NetworkProxy::new(&conn).await {
                    if let Ok(networks) = proxy.scan_networks().await {
                        for ssid in networks {
                            let label = Label::new(Some(&ssid));
                            label.set_halign(gtk4::Align::Start);
                            label.set_margin_top(12);
                            label.set_margin_bottom(12);
                            label.set_margin_start(12);
                            label.set_margin_end(12);
                            list_box.append(&label);
                        }
                    }
                }
            }
        });
    });

    container
}
