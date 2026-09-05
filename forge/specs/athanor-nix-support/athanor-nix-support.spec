%global debug_package %{nil}
Name:           athanor-nix-support
Version:        1.0.0
Release:        2%{?dist}
Summary:        Athanor OS athanor-nix-support
License:        MIT
URL:            https://github.com/hr-mes/athanor-forge
BuildArch:      noarch

%description
Provides athanor-nix-support for Athanor OS.

%prep
# Nothing to prep

%build
# Nothing to build

%install
mkdir -p %{buildroot}/usr/lib/tmpfiles.d
mkdir -p %{buildroot}/usr/share/nix-initial-state/var/nix/profiles
mkdir -p %{buildroot}/usr/lib/systemd/system

cp -a %{_sourcedir}/usr/lib/tmpfiles.d/* %{buildroot}/usr/lib/tmpfiles.d/ || true
cp -a %{_sourcedir}/usr/lib/systemd/system/* %{buildroot}/usr/lib/systemd/system/ || true

%files
%dir /usr/share/nix-initial-state
%dir /usr/share/nix-initial-state/var
%dir /usr/share/nix-initial-state/var
%dir /usr/share/nix-initial-state/var/nix
%dir /usr/share/nix-initial-state/var/nix/profiles
/usr/lib/tmpfiles.d/10-athanor-nix.conf
/usr/lib/systemd/system/nix-daemon.socket
/usr/lib/systemd/system/nix-daemon.service

%changelog
* Wed Jul 01 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial Bedrock encapsulation with tmpfiles.d
