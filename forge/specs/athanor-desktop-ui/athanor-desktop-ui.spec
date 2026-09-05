%global debug_package %{nil}
Name:           athanor-desktop-ui
Version:        1.0.0
Release:        8%{?dist}
Summary:        Athanor OS Desktop UI configurations
License:        MIT
URL:            https://github.com/hr-mes/athanor-forge
BuildArch:      noarch

Provides:       athanor-ags-config = 1.0.1-3
Obsoletes:      athanor-ags-config < 1.0.1-3
Provides:       athanor-niri-session = 1.0.0-3
Obsoletes:      athanor-niri-session < 1.0.0-3

Requires: lxpolkit
Requires: cliphist
Requires: swayidle
Requires: ddcutil
Requires: foot
Requires: grim
Requires: slurp
Requires: wl-clipboard
Requires: brightnessctl
Requires: playerctl
Requires:       athanor-shell-rs athanor-settings-rs wireplumber nautilus firefox

%description
Provides the unified Desktop UI (Niri) configuration for Athanor OS.
Includes dependencies for Wayland (lxpolkit, swayidle, ddcutil)
and configures UDEV for i2c access.

%prep
# Nothing to prep

%build
# Nothing to build

%install
mkdir -p %{buildroot}/etc/skel/.config/niri
mkdir -p %{buildroot}/usr/lib/udev/rules.d
mkdir -p %{buildroot}/usr/lib/systemd/user

# Copy only relevant Niri files
cp -p %{_sourcedir}/etc/skel/.config/niri/config.kdl %{buildroot}/etc/skel/.config/niri/

# Copy UDEV rules
cp -p %{_sourcedir}/etc/udev/rules.d/99-ddcutil-i2c.rules %{buildroot}/usr/lib/udev/rules.d/

%files
/etc/skel/.config/niri/config.kdl
/usr/lib/udev/rules.d/99-ddcutil-i2c.rules

%changelog
* Wed Jul 15 2026 Athanor Forge <forge@athanor.os> - 1.0.0-5
- Map Mod+D keyboard bind to athanor-shell-rs --dock single-instance toggle

* Mon Jul 13 2026 Athanor Forge <forge@athanor.os> - 1.0.0-4
- Shift Niri keyboard shortcuts from ags toggle to native pure Rust athanor-shell-rs and athanor-settings-rs.

* Sat Jul 11 2026 Athanor Forge <forge@athanor.os> - 1.0.0-2
- Implement instant greeter termination on login success (killall -9 greeter session) and PAM CancelSession retry.

* Tue Jul 07 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Unified AGS and Niri configs into athanor-desktop-ui.
- Integrated smembrated AGS app.ts into state, modals, notifications.
- Added essential Wayland deps: lxpolkit, swayidle, ddcutil.
- Added UDEV rules for ddcutil i2c.
