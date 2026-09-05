%global debug_package %{nil}
Name:           athanor-system-services
Version:        1.0.1
Release:        6%{?dist}
Summary:        Athanor OS athanor-system-services
License:        MIT
URL:            https://github.com/hr-mes/athanor-forge
BuildArch:      noarch
Requires:       systemd
Requires:       athanor-shell-rs

%description
Provides core systemd user targets, desktop panel lifecycle services, and skeleton synchronization for Athanor OS.

%prep
# Nothing to prep

%build
# Nothing to build

%install
mkdir -p %{buildroot}/usr/share/athanor-system-services
mkdir -p %{buildroot}/usr/lib/systemd/user
mkdir -p %{buildroot}/usr/lib/systemd/user-preset
cp -a %{_sourcedir}/usr/lib/systemd/user/* %{buildroot}/usr/lib/systemd/user/ || true
cp -a %{_sourcedir}/usr/lib/systemd/user-preset/* %{buildroot}/usr/lib/systemd/user-preset/ || true
ln -s athanor-shell.service %{buildroot}/usr/lib/systemd/user/athanor-ags.service

%files
%dir /usr/share/athanor-system-services
/usr/lib/systemd/user/niri-session.target
/usr/lib/systemd/user/athanor-skel-sync.service
/usr/lib/systemd/user/athanor-shell.service
/usr/lib/systemd/user/athanor-dock.service
/usr/lib/systemd/user/athanor-ags.service
/usr/lib/systemd/user-preset/99-athanor-desktop.preset

%changelog
* Wed Jul 15 2026 Athanor Forge <forge@athanor.os> - 1.0.1-6
- Add athanor-dock.service as dedicated user systemd service for interactive Glassmorphic Dock

* Wed Jul 15 2026 Athanor Forge <forge@athanor.os> - 1.0.1-5
- Rename athanor-ags.service to athanor-shell.service with backward compatibility alias symlink

* Sat Jul 11 2026 Athanor Forge <forge@athanor.os> - 1.0.1-4
- Switch athanor-ags.service to run pure Rust athanor-shell-rs native binary instead of GJS/JS

* Tue Jul 07 2026 Athanor Forge <forge@athanor.os> - 1.0.1-3
- Refactored athanor-skel-sync to copy all missing dotfiles (Niri, Matugen, etc) securely without overwriting

* Tue Jul 07 2026 Athanor Forge <forge@athanor.os> - 1.0.1-2
- Fix Wayland socket race condition by changing After to graphical-session.target for ags and wallpaper

* Tue Jul 07 2026 Athanor Forge <forge@athanor.os> - 1.0.1-1
- Implement systemd user target niri-session.target
- Implement Astal AGS desktop panel lifecycle service
- Implement skeleton sync for seamless user upgrade migration
