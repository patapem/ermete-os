%global debug_package %{nil}
Name:           ermete-system-services
Version:        1.0.1
Release:        2%{?dist}
Summary:        Ermete OS ermete-system-services
License:        MIT
URL:            https://github.com/patapem/ermete-forge
BuildArch:      noarch
Requires:       systemd
Requires:       aylurs-gtk-shell2

%description
Provides core systemd user targets, desktop panel lifecycle services, and skeleton synchronization for Ermete OS.

%prep
# Nothing to prep

%build
# Nothing to build

%install
mkdir -p %{buildroot}/usr/share/ermete-system-services
mkdir -p %{buildroot}/usr/lib/systemd/user
mkdir -p %{buildroot}/usr/lib/systemd/user-preset
cp -a %{_sourcedir}/usr/lib/systemd/user/* %{buildroot}/usr/lib/systemd/user/ || true
cp -a %{_sourcedir}/usr/lib/systemd/user-preset/* %{buildroot}/usr/lib/systemd/user-preset/ || true

%files
%dir /usr/share/ermete-system-services
/usr/lib/systemd/user/niri-session.target
/usr/lib/systemd/user/ermete-skel-sync.service
/usr/lib/systemd/user/ermete-ags.service
/usr/lib/systemd/user-preset/99-ermete-desktop.preset

%changelog
* Tue Jul 07 2026 Ermete Forge <forge@ermete.os> - 1.0.1-2
- Fix Wayland socket race condition by changing After to graphical-session.target for ags and wallpaper

* Tue Jul 07 2026 Ermete Forge <forge@ermete.os> - 1.0.1-1
- Implement systemd user target niri-session.target
- Implement Astal AGS desktop panel lifecycle service
- Implement skeleton sync for seamless user upgrade migration
