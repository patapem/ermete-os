%global debug_package %{nil}
Name:           ermete-shell-rs
Version:        1.0.0
Release:        3%{?dist}
Summary:        Ermete OS Native Rust GTK4 Shell

License:        MIT
Source0:        ermete-shell-rs-%{version}.tar.gz

BuildRequires:  rust cargo gcc gcc-c++ gtk4-devel glib2-devel pkgconf-pkg-config gtk4-layer-shell-devel
Requires:       gtk4 gtk4-layer-shell glib2

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
* Sat Jul 11 2026 Ermete Forge <forge@ermete.os> - 1.0.0-2
- Implement Full Rust GTK4 Layer Shell Top Bar with 3-zone layout and native styling

* Fri Jul 10 2026 Ermete Forge <forge@ermete.os> - 1.0.0-1
- Initial Rust Shell encapsulation
