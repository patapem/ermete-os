### Task 1: Eliminate CLI Subprocesses in `ermete-shell-rs` Control Center

**Files:**
- Create: `/var/home/ermete/GEMINI/ermete/ermete-forge/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/system_proxies.rs`
- Modify: `/var/home/ermete/GEMINI/ermete/ermete-forge/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/ui/control_center.rs`
- Modify: `/var/home/ermete/GEMINI/ermete/ermete-forge/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/main.rs`
- Test: `/var/home/ermete/GEMINI/ermete/ermete-forge/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/system_proxies.rs` (inline module `#[cfg(test)]`)

**Interfaces:**
- Consumes: `zbus::Connection::session()` and `zbus::Connection::system()`
- Produces: `SystemController` struct with async methods `toggle_wifi()`, `toggle_bluetooth()`, `toggle_mute()`, `set_volume()`, `set_brightness()`, and `player_command()`.

- [ ] **Step 1: Write failing test for `SystemController` state updates**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `system_proxies.rs` using asynchronous `zbus::proxy` definitions (`NetworkManager`, `BlueZ`, `Logind`, `MPRIS`) and `wireplumber` D-Bus calls**
- [ ] **Step 4: Refactor `control_center.rs` to replace `Command::new("nmcli")`, `bluetoothctl`, `wpctl`, `brightnessctl`, `playerctl`, and `swaylock` with `SystemController` methods**
- [ ] **Step 5: Run tests and verify build compiles cleanly with `cargo check --tests` inside `ermete-shell-rs`**
- [ ] **Step 6: Commit changes to `ermete-shell-rs`**

---

