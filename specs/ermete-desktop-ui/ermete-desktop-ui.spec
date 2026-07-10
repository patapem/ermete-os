%global debug_package %{nil}
Name:           ermete-desktop-ui
Version:        1.0.0
Release:        1%{?dist}
Summary:        Ermete OS Desktop UI configurations
License:        MIT
URL:            https://github.com/patapem/ermete-forge
BuildArch:      noarch

Provides:       ermete-ags-config = 1.0.1-3
Obsoletes:      ermete-ags-config < 1.0.1-3
Provides:       ermete-niri-session = 1.0.0-3
Obsoletes:      ermete-niri-session < 1.0.0-3

Requires:       ags
Requires:       lxpolkit
Requires:       swayidle
Requires:       ddcutil
Requires:       dart-sass

%description
Provides the unified Desktop UI (AGS and Niri) configuration for Ermete OS.
Includes dependencies for Wayland (lxpolkit, swayidle, ddcutil)
and configures UDEV for i2c access.

%prep
# Nothing to prep

%build
# Nothing to build

%install
mkdir -p %{buildroot}/etc/skel/.config/ags
mkdir -p %{buildroot}/etc/skel/.config/niri
mkdir -p %{buildroot}/etc/udev/rules.d
mkdir -p %{buildroot}/etc/skel/.config/systemd/user

# Copy only relevant AGS files (skip .bak)
cp -p %{_sourcedir}/etc/skel/.config/ags/app.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/modals.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/notifications.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/state.ts %{buildroot}/etc/skel/.config/ags/
cp -pr %{_sourcedir}/etc/skel/.config/ags/style %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/wallpaper.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/clipboard.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/polkit.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/firewall.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/geoclue.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/greeter.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/udisks.ts %{buildroot}/etc/skel/.config/ags/
cp -p %{_sourcedir}/etc/skel/.config/ags/updater.ts %{buildroot}/etc/skel/.config/ags/

# Copy systemd user services
cp -p %{_sourcedir}/etc/skel/.config/systemd/user/* %{buildroot}/etc/skel/.config/systemd/user/ || true

# Copy only relevant Niri files
cp -p %{_sourcedir}/etc/skel/.config/niri/config.kdl %{buildroot}/etc/skel/.config/niri/

# Copy UDEV rules
cp -p %{_sourcedir}/etc/udev/rules.d/99-ddcutil-i2c.rules %{buildroot}/etc/udev/rules.d/

%files
/etc/skel/.config/ags/app.ts
/etc/skel/.config/ags/modals.ts
/etc/skel/.config/ags/notifications.ts
/etc/skel/.config/ags/state.ts
/etc/skel/.config/ags/style/*
/etc/skel/.config/ags/wallpaper.ts
/etc/skel/.config/ags/clipboard.ts
/etc/skel/.config/ags/polkit.ts
/etc/skel/.config/ags/firewall.ts
/etc/skel/.config/ags/geoclue.ts
/etc/skel/.config/ags/greeter.ts
/etc/skel/.config/ags/udisks.ts
/etc/skel/.config/ags/updater.ts
/etc/skel/.config/systemd/user/*
/etc/skel/.config/niri/config.kdl
/etc/udev/rules.d/99-ddcutil-i2c.rules

%changelog
* Tue Jul 07 2026 Ermete Forge <forge@ermete.os> - 1.0.0-1
- Unified AGS and Niri configs into ermete-desktop-ui.
- Integrated smembrated AGS app.ts into state, modals, notifications.
- Added essential Wayland deps: lxpolkit, swayidle, ddcutil.
- Added UDEV rules for ddcutil i2c.
