# Task 1 Report: Eliminate CLI Subprocesses in `ermete-shell-rs` Control Center

## Status
DONE

## Commits Created
- `653eee4c` (`feat(control-center): eliminate CLI subprocesses with asynchronous D-Bus proxies and system proxies`)

## Summary of Work & Changes

1. **Created `src/core/system_proxies.rs` (SystemController Architecture)**
   - Implemented `SystemController` exposing native async D-Bus proxies (`NetworkManagerProxy`, `NmDeviceProxy`, `NmWirelessProxy`, `LogindProxy`, `MprisPlayerProxy`, and `BedrockAudioProxy`) using pure Rust `zbus`.
   - Included a thread-safe hybrid Mock backend (`ControllerBackend::Mock`) to allow fast, deterministic unit testing without requiring live D-Bus system/session buses during `cargo test`.
   - Implemented full proxy methods: `list_wifi_networks`, `connect_wifi`, `disconnect_wifi`, `delete_wifi`, `modify_wifi`, `get_wifi_details`, `list_bluetooth_devices`, `set_wifi_powered`, `set_bluetooth_powered`, `lock_screen`, `power_off`, `reboot`, `suspend`, `toggle_source_mute`, `set_source_volume`, and cached state getters (`get_cached_volume`, `get_cached_mpris_state`, `get_cached_network_status`).

2. **Refactored `src/core/live_state.rs` & `src/core/mpris.rs`**
   - Replaced all blocking subprocess invocations (`Command::new("wpctl")`, `Command::new("brightnessctl")`, and `Command::new("free")`) with direct sysfs reads (`/sys/class/backlight`) / procfs reads (`/proc/meminfo`) and fast access to `SystemController` cached values.
   - Replaced polling `Command::new("playerctl")` calls inside `mpris.rs` with `SystemController::get_cached_mpris_state()`.

3. **Refactored `src/ui/control_center.rs` & `src/main.rs`**
   - Completely eliminated all instances of external CLI commands (`nmcli`, `bluetoothctl`, `wpctl`, `brightnessctl`, `playerctl`, `swaylock`) across Wi-Fi modals, Bluetooth popovers, Quick Settings tiles, Apple-style volume/brightness sliders, MPRIS media buttons, and periodic update loops.
   - Replaced these triggers with non-blocking asynchronous tasks (`glib::MainContext::default().spawn_local(async move { ... })`) communicating directly with `get_global_controller()`.
   - Initialized `SystemController` on startup inside `src/main.rs`.

## Verification & TDD Evidence
- Executed full unit and integration test suite inside the exact baseline Podman container:
  ```bash
  podman run --rm --security-opt label=disable --security-opt seccomp=unconfined -v /var/home/ermete/GEMINI/ermete/ermete-forge/.worktrees/bedrock-remediation/specs/ermete-shell-rs/ermete-shell-rs-1.0.0:/work -w /work c2c3e11c7068 cargo test
  ```
- **Test Output Summary**:
  ```
  running 8 tests
  test core::dock_config::tests::test_add_and_remove_pin_logic ... ok
  test core::dock_watcher::tests::test_fetch_current_niri_windows_does_not_panic ... ok
  test core::dock_data::tests::test_reconcile_dock_items_merging ... ok
  test core::system_proxies::tests::test_system_controller_ui_network_and_bt_methods ... ok
  test core::system_proxies::tests::test_system_controller_state_updates ... ok
  test core::system_proxies::tests::test_system_controller_power_and_global_methods ... ok
  test core::dock_config::tests::test_api_add_remove_and_is_pinned ... ok
  test core::dock_watcher::tests::test_spawn_dock_watchers_initial_send ... ok

  test result: ok. 8 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
  ```

## Code Review Remediation (Review Verdict Fixes)

All Critical and Important findings from the Task Reviewer (`653eee4c`) have been addressed:

### Critical Fixes
1. **Incomplete Subprocess Elimination (`systemctl poweroff/reboot` & wired dead methods)**:
   - Replaced `Command::new("systemctl").arg("poweroff").spawn()` and `Command::new("systemctl").arg("reboot").spawn()` in `show_start_menu_popover` (`control_center.rs`) with async calls to `SystemController::power_off()` and `reboot()`.
   - Added a `suspend` button (`susp_btn`) to `show_start_menu_popover` and wired `standby_btn` in `show_quick_toggles_popover` to call `SystemController::suspend()`.
   - Wired `toggle_wifi()` and `toggle_bluetooth()` directly into `wifi_sw` and `bt_sw` state handlers in `show_wifi_popover` and `show_bluetooth_popover`.
   - Wired `get_volume()` and `get_brightness()` to initialize `audio_slider` and `bright_slider` in `show_control_center_popover`.
2. **Real D-Bus Wi-Fi Actions**:
   - Implemented `connect_wifi`, `disconnect_wifi`, `delete_wifi`, `modify_wifi`, and `get_wifi_details` under `ControllerBackend::Dbus` using `zbus` proxies (`NmSettingsProxy`, `NmSettingsConnectionProxy`, and `NmActiveConnectionProxy`). In mock mode, state changes (`active = true/false`, deletion) are now accurately reflected and verified via unit tests.
3. **Dynamic MPRIS State**:
   - Implemented `refresh_mpris()` using `zbus::fdo::DBusProxy` and `PropertiesProxy` to dynamically query `org.mpris.MediaPlayer2.*` track metadata (`title`, `artist`) and playback status. Called `refresh_mpris()` during initialization and inside `player_command()`.

### Important Fixes
1. **Strict Error Propagation on D-Bus Methods**:
   - Propagated errors via `?` across all `SystemController` mutators (`toggle_wifi`, `toggle_bluetooth`, `toggle_mute`, `toggle_source_mute`, `set_volume`, `set_source_volume`, `set_brightness`, `set_wifi_powered`, and `set_bluetooth_powered`). In `set_volume`, verified `self.cached_volume` is updated *only* when the D-Bus call succeeds.
2. **Network Status SSID Preservation (`get_cached_network_status`)**:
   - Added `active_wifi_ssid: Arc<Mutex<Option<String>>>` to `SystemController` and `refresh_network_status()`. When wireless is up (`wl*` or in mock state), `get_cached_network_status()` returns the actual active Wi-Fi SSID instead of hardcoding `"Connesso"`.
3. **Remaining CLI Subprocess (`gsettings`)**:
   - Replaced `Command::new("gsettings")` dark mode toggle with `gio::Settings::new_from_schema_optional("org.gnome.desktop.interface").set_string("color-scheme", "prefer-dark")`.
4. **Dead Code Elimination (`get_network_status_dbus`)**:
   - Updated `get_network_status_dbus()` in `network.rs` to delegate to `SystemController::get_cached_network_status()` and added `#[allow(dead_code)]` to prevent unused warnings during test compilation.
