Name:           ermete-updater-rs
Version:        1.0.0
Release:        1%{?dist}
Summary:        Ermete OS Over-The-Air Update Daemon

License:        GPL-3.0-or-later
URL:            https://github.com/patapem/ermete-forge
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  rust cargo systemd-rpm-macros

%description
Ermete OS Over-The-Air Update Daemon for Dual-Layer OTA updates (bootc and rpm-ostree).

%prep
%autosetup

%build
cd %{name}-%{version}
cargo build --release --locked

%install
cd %{name}-%{version}
install -D -m 0755 target/release/%{name} %{buildroot}%{_bindir}/%{name}

# Create a systemd service file (dummy for now)
mkdir -p %{buildroot}%{_unitdir}
cat <<EOF > %{buildroot}%{_unitdir}/%{name}.service
[Unit]
Description=Ermete OS Updater Daemon
After=network-online.target

[Service]
Type=simple
ExecStart=%{_bindir}/%{name}
Restart=always

[Install]
WantedBy=multi-user.target
EOF

%files
%{_bindir}/%{name}
%{_unitdir}/%{name}.service

%changelog
* Thu Jul 16 2026 Ermete <ermete@ermete.os> - 1.0.0-1
- Initial release
