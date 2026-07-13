%global debug_package %{nil}
Name:           ermete-shell-rs
Version:        1.0.0
Release:        9%{?dist}
Summary:        Ermete OS Native Rust GTK4 Shell

License:        MIT
Source0:        ermete-shell-rs-%{version}.tar.gz

BuildRequires:  rust cargo gcc gcc-c++ gtk4-devel glib2-devel pkgconf-pkg-config gtk4-layer-shell-devel
Requires:       gtk4 gtk4-layer-shell glib2 cage

%description
Pure Rust native shell for Ermete OS, replacing AGS/GJS.

%prep
%autosetup

%build
cargo build --release --locked

%install
mkdir -p %{buildroot}%{_bindir}
install -m 0755 target/release/ermete-shell-rs %{buildroot}%{_bindir}/ermete-shell-rs

%files
%{_bindir}/ermete-shell-rs

%changelog
* Tue Jul 14 2026 Ermete Forge <forge@ermete.os> - 1.0.0-9
- Add cage dependency for native Wayland greeter kiosk mode (--greeter)

* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 1.0.0-8
- Integrate cage Wayland kiosk execution and Big Tech Glassmorphism Greeter upgrade

* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 1.0.0-7
- Redesign greeter login UI to BigTech macOS Lock Screen & Glassmorphism style with live clock and power actions

* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 1.0.0-6
- Fix greeter PAM authentication username resolution and add premium GTK4 CSS design

* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 1.0.0-5
- Add Control Center header Settings button and quick setting tile deeplinks (--page <id>)

* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 1.0.0-4
- Implement single-instance command dispatching, Powermenu modal (--powermenu), and Clipboard Manager modal (--clipboard).

* Sat Jul 11 2026 Ermete Forge <forge@ermete.os> - 1.0.0-2
- Implement Full Rust GTK4 Layer Shell Top Bar with 3-zone layout and native styling

* Fri Jul 10 2026 Ermete Forge <forge@ermete.os> - 1.0.0-1
- Initial Rust Shell encapsulation
