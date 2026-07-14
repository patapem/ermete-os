use crate::core::dock_config::{add_pin, remove_pin, DockConfig};
use crate::core::dock_data::{reconcile_dock_items, DockItem, NiriWindowInfo};
use crate::core::dock_watcher::spawn_dock_watchers;
use gtk4::glib;
use gtk4::prelude::*;
use gtk4::{
    Align, Application, ApplicationWindow, Box as GtkBox, Button, CssProvider, EventControllerMotion,
    EventControllerScroll, EventControllerScrollFlags, GestureClick, Image, Orientation, Popover,
};
use gtk4_layer_shell::{Edge, Layer, LayerShell};
use std::cell::RefCell;
use std::process::Command;
use std::rc::Rc;

const DOCK_CSS: &str = r#"
window.dock-window {
    background-color: transparent;
}

.dock-container {
    background: @shell_bg;
    border: 1px solid @shell_border;
    border-radius: 24px;
    padding: 6px 12px;
    box-shadow: 0 14px 38px rgba(0, 0, 0, 0.65);
    transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.dock-hidden {
    transform: translateY(120px);
    opacity: 0;
}

.dock-item-btn {
    background: transparent;
    border: none;
    border-radius: 16px;
    padding: 6px 8px;
    transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.dock-item-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: scale(1.12) translateY(-4px);
}

.dock-item-btn:active {
    transform: scale(0.96);
}

.dock-indicator {
    min-height: 4px;
    min-width: 4px;
    border-radius: 99px;
    background-color: rgba(255, 255, 255, 0.5);
    margin-top: 2px;
}

.dock-indicator-focused {
    min-height: 4px;
    min-width: 16px;
    border-radius: 99px;
    background-color: @shell_primary;
    margin-top: 2px;
}

.dock-popover {
    background: rgba(26, 27, 38, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 6px;
}

.dock-popover-btn {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    color: #ffffff;
}

.dock-popover-btn:hover {
    background: rgba(255, 255, 255, 0.1);
}
"#;

struct DockState {
    pinned: Vec<String>,
    windows: Vec<NiriWindowInfo>,
}

thread_local! {
    static DOCK_WINDOW: RefCell<Option<glib::WeakRef<ApplicationWindow>>> = RefCell::new(None);
}

#[allow(dead_code)]
pub fn build_ui(app: &Application) -> ApplicationWindow {
    let window = ApplicationWindow::builder()
        .application(app)
        .title("Ermete Dock")
        .css_classes(["dock-window"])
        .build();

    window.init_layer_shell();
    window.set_layer(Layer::Top);
    window.set_namespace("dock");
    window.set_anchor(Edge::Bottom, true);
    window.set_margin(Edge::Bottom, 12);

    let provider = CssProvider::new();
    provider.load_from_data(DOCK_CSS);
    gtk4::style_context_add_provider_for_display(
        &gtk4::gdk::Display::default().expect("Display default"),
        &provider,
        gtk4::STYLE_PROVIDER_PRIORITY_APPLICATION,
    );

    let container = GtkBox::new(Orientation::Horizontal, 8);
    container.add_css_class("dock-container");
    container.set_halign(Align::Center);
    container.set_valign(Align::Center);

    window.set_child(Some(&container));

    // Trigger Window for Auto-hide
    let trigger_win = ApplicationWindow::builder()
        .application(app)
        .title("Ermete Dock Trigger")
        .css_classes(["dock-window"])
        .build();
    trigger_win.init_layer_shell();
    trigger_win.set_layer(Layer::Top);
    trigger_win.set_anchor(Edge::Bottom, true);
    trigger_win.set_anchor(Edge::Left, true);
    trigger_win.set_anchor(Edge::Right, true);
    trigger_win.set_height_request(2);

    let motion_trigger = EventControllerMotion::new();
    let container_weak = container.downgrade();
    motion_trigger.connect_enter(move |_, _, _| {
        if let Some(cont) = container_weak.upgrade() {
            cont.remove_css_class("dock-hidden");
        }
    });
    trigger_win.add_controller(motion_trigger);
    trigger_win.present();

    let motion_dock = EventControllerMotion::new();
    let container_weak2 = container.downgrade();
    motion_dock.connect_leave(move |_| {
        // Auto-hide only when windows overlap bottom area
        if let Some(cont) = container_weak2.upgrade() {
            let windows = crate::core::dock_watcher::fetch_current_niri_windows();
            let should_hide = windows.iter().any(|w| w.is_focused);
            if should_hide {
                cont.add_css_class("dock-hidden");
            }
        }
    });
    container.add_controller(motion_dock);

    let state = Rc::new(RefCell::new(DockState {
        pinned: Vec::new(),
        windows: Vec::new(),
    }));

    let (tx_win, rx_win) = glib::MainContext::channel::<Vec<NiriWindowInfo>>(glib::Priority::DEFAULT);
    let (tx_cfg, rx_cfg) = glib::MainContext::channel::<DockConfig>(glib::Priority::DEFAULT);

    spawn_dock_watchers(tx_win, tx_cfg);

    let container_clone = container.clone();
    let state_clone = state.clone();
    rx_win.attach(None, move |windows| {
        state_clone.borrow_mut().windows = windows;
        refresh_dock_ui(&container_clone, &state_clone.borrow());
        glib::ControlFlow::Continue
    });

    let container_clone2 = container.clone();
    let state_clone2 = state.clone();
    rx_cfg.attach(None, move |cfg| {
        state_clone2.borrow_mut().pinned = cfg.pinned;
        refresh_dock_ui(&container_clone2, &state_clone2.borrow());
        glib::ControlFlow::Continue
    });

    window.present();

    DOCK_WINDOW.with(|w| {
        *w.borrow_mut() = Some(window.downgrade());
    });

    window
}

#[allow(dead_code)]
pub fn toggle_dock_visibility() {
    DOCK_WINDOW.with(|w| {
        if let Some(weak) = w.borrow().as_ref() {
            if let Some(win) = weak.upgrade() {
                if win.is_visible() {
                    win.set_visible(false);
                } else {
                    win.set_visible(true);
                    win.present();
                }
            }
        }
    });
}

fn refresh_dock_ui(container: &GtkBox, state: &DockState) {
    while let Some(child) = container.first_child() {
        container.remove(&child);
    }

    let items = reconcile_dock_items(&state.pinned, &state.windows);
    let mut added_unpinned_separator = false;

    for item in items {
        if !item.is_pinned && !added_unpinned_separator {
            let sep = gtk4::Separator::new(Orientation::Vertical);
            sep.set_margin_top(8);
            sep.set_margin_bottom(8);
            container.append(&sep);
            added_unpinned_separator = true;
        }

        let btn = Button::builder().css_classes(["dock-item-btn"]).build();
        let box_inner = GtkBox::new(Orientation::Vertical, 2);
        box_inner.set_halign(Align::Center);

        let icon = Image::from_icon_name(&item.icon_name);
        icon.set_pixel_size(44);
        box_inner.append(&icon);

        let indicator = GtkBox::new(Orientation::Horizontal, 0);
        indicator.set_halign(Align::Center);
        if item.is_focused {
            indicator.add_css_class("dock-indicator-focused");
        } else if !item.window_ids.is_empty() {
            indicator.add_css_class("dock-indicator");
        } else {
            indicator.set_opacity(0.0);
            indicator.set_size_request(4, 4);
        }
        box_inner.append(&indicator);

        btn.set_child(Some(&box_inner));

        // Click Handler (Left click / Right click)
        let click_ctrl = GestureClick::new();
        click_ctrl.set_button(0); // All buttons
        let item_capture = item.clone();
        let btn_clone = btn.clone();
        click_ctrl.connect_pressed(move |gesture, n_press, _, _| {
            let button = gesture.current_button();
            if button == 1 && n_press == 1 {
                if item_capture.window_ids.is_empty() {
                    let _ = Command::new("gtk-launch").arg(&item_capture.key_id).spawn();
                } else if item_capture.window_ids.len() == 1 {
                    let win_id = item_capture.window_ids[0];
                    let _ = Command::new("niri")
                        .args(["msg", "action", "focus-window", "--id", &win_id.to_string()])
                        .spawn();
                } else {
                    show_window_picker_popover(&btn_clone, &item_capture);
                }
            } else if button == 3 && n_press == 1 {
                show_dock_context_menu(&btn_clone, &item_capture);
            }
        });
        btn.add_controller(click_ctrl);

        // Scroll Handler (Cycle windows)
        let scroll_ctrl = EventControllerScroll::new(EventControllerScrollFlags::VERTICAL);
        let win_ids = item.window_ids.clone();
        scroll_ctrl.connect_scroll(move |_, _, dy| {
            if !win_ids.is_empty() {
                let idx = if dy > 0.0 { 0 } else { win_ids.len() - 1 };
                let win_id = win_ids[idx];
                let _ = Command::new("niri")
                    .args(["msg", "action", "focus-window", "--id", &win_id.to_string()])
                    .spawn();
            }
            glib::Propagation::Stop
        });
        btn.add_controller(scroll_ctrl);

        container.append(&btn);
    }
}

fn show_window_picker_popover(anchor: &Button, item: &DockItem) {
    let popover = Popover::builder()
        .autohide(true)
        .css_classes(["dock-popover"])
        .build();
    popover.set_parent(anchor);

    let box_inner = GtkBox::new(Orientation::Vertical, 4);
    for (i, title) in item.window_titles.iter().enumerate() {
        let win_id = item.window_ids[i];
        let btn = Button::builder()
            .label(title)
            .css_classes(["dock-popover-btn"])
            .build();
        let pop_close = popover.clone();
        btn.connect_clicked(move |_| {
            let _ = Command::new("niri")
                .args(["msg", "action", "focus-window", "--id", &win_id.to_string()])
                .spawn();
            pop_close.popdown();
        });
        box_inner.append(&btn);
    }
    popover.set_child(Some(&box_inner));
    popover.popup();
}

fn show_dock_context_menu(anchor: &Button, item: &DockItem) {
    let popover = Popover::builder()
        .autohide(true)
        .css_classes(["dock-popover"])
        .build();
    popover.set_parent(anchor);

    let box_inner = GtkBox::new(Orientation::Vertical, 4);

    let pin_label = if item.is_pinned {
        "Rimuovi dalla Dock"
    } else {
        "Fissa nella Dock"
    };
    let btn_pin = Button::builder()
        .label(pin_label)
        .css_classes(["dock-popover-btn"])
        .build();
    let key_id = item.key_id.clone();
    let is_pinned = item.is_pinned;
    let pop_close = popover.clone();
    btn_pin.connect_clicked(move |_| {
        if is_pinned {
            let _ = remove_pin(&key_id);
        } else {
            let _ = add_pin(&key_id);
        }
        pop_close.popdown();
    });
    box_inner.append(&btn_pin);

    let btn_new = Button::builder()
        .label("Nuova Finestra")
        .css_classes(["dock-popover-btn"])
        .build();
    let key_id2 = item.key_id.clone();
    let pop_close2 = popover.clone();
    btn_new.connect_clicked(move |_| {
        let _ = Command::new("gtk-launch").arg(&key_id2).spawn();
        pop_close2.popdown();
    });
    box_inner.append(&btn_new);

    if !item.window_ids.is_empty() {
        let btn_close = Button::builder()
            .label("Chiudi finestre")
            .css_classes(["dock-popover-btn"])
            .build();
        let win_ids = item.window_ids.clone();
        let pop_close3 = popover.clone();
        btn_close.connect_clicked(move |_| {
            for id in &win_ids {
                let _ = Command::new("niri")
                    .args(["msg", "action", "close-window", "--id", &id.to_string()])
                    .spawn();
            }
            pop_close3.popdown();
        });
        box_inner.append(&btn_close);
    }

    popover.set_child(Some(&box_inner));
    popover.popup();
}
