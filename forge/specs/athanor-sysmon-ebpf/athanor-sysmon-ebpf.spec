%global debug_package %{nil}
Name:           athanor-sysmon-ebpf
Version:        1.0.0
Release:        1%{?dist}
Summary:        eBPF System Monitoring & Telemetry Daemon for Athanor OS

License:        GPL-2.0-or-later
URL:            https://github.com/hr-mes/athanor-forge


BuildRequires:  rust >= 1.80.0
BuildRequires:  cargo
BuildRequires:  systemd-rpm-macros
BuildRequires:  gcc gcc-c++ pkgconf-pkg-config

%description
System monitoring and telemetry daemon leveraging Aya eBPF for kernel-level performance tracking in Athanor OS.

%prep
# Stub prep

%build
%set_build_flags
# cargo generate-lockfile // FORBIDDEN BY RULE 4 (Offline Build)
cargo build --release --locked

%install
mkdir -p %{buildroot}
mkdir -p $(dirname 0755) && touch 0755

mkdir -p %{buildroot}/usr/bin
install -m 0755 target/release/%{name} %{buildroot}/usr/bin/%{name}

%files
/usr/bin/%{name}

%changelog
* Wed Aug 05 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial release of athanor-sysmon-ebpf spec

