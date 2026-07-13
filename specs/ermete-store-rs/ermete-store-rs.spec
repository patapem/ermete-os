%global debug_package %{nil}
Name:           ermete-store-rs
Version:        0.1.0
Release:        1%{?dist}
Summary:        Ermete OS Native App Store

License:        MIT
Source0:        ermete-store-rs-%{version}.tar.gz

BuildRequires:  rust cargo gcc gcc-c++ gtk4-devel glib2-devel pkgconf-pkg-config
Requires:       gtk4 glib2

%description
Pure Rust native App Store for Ermete OS.

%prep
%autosetup

%build
cargo build --release --locked

%install
mkdir -p %{buildroot}%{_bindir}
install -m 0755 target/release/ermete-store-rs %{buildroot}%{_bindir}/ermete-store-rs

%files
%{_bindir}/ermete-store-rs

%changelog
* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 0.1.0-1
- Initial native Rust App Store package
