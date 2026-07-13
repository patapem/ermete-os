%global debug_package %{nil}
Name:           ermete-daemon-rs
Version:        0.1.0
Release:        2%{?dist}
Summary:        Ermete OS Native D-Bus Bedrock Daemon

License:        MIT
Source0:        ermete-daemon-rs-%{version}.tar.gz

BuildRequires:  rust cargo gcc gcc-c++ pkgconf-pkg-config
Requires:       pipewire wireplumber

%description
Pure Rust native D-Bus IPC service for Ermete OS audio and system bedrock management.

%prep
%autosetup

%build
cargo build --release

%install
mkdir -p %{buildroot}%{_bindir}
install -m 0755 target/release/ermete-daemon-rs %{buildroot}%{_bindir}/ermete-daemon-rs

%files
%{_bindir}/ermete-daemon-rs

%changelog
* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 0.1.0-1
- Initial native Rust D-Bus daemon package
