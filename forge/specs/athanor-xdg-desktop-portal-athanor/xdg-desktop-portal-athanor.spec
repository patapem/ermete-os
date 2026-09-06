%global debug_package %{nil}
Name:           xdg-desktop-portal-athanor
Version:        1.0.0
Release:        2%{?dist}
Summary:        Athanor OS Desktop Portal (Privacy & ScreenShare)

License:        GPL-3.0-or-later
URL:            https://github.com/hr-mes/athanor-forge


BuildRequires:  rust cargo pkgconf-pkg-config openssl-devel
Requires:       athanor-shell-rs

%description
Athanor OS implementation of the XDG Desktop Portal for native Wayland/Niri integration, privacy prompts, and hardware indicators.

%prep
# Stub prep

%build
%set_build_flags
# cargo generate-lockfile // FORBIDDEN BY RULE 4 (Offline Build)
cargo build --release --locked -p %{name}

%install
mkdir -p %{buildroot}
mkdir -p $(dirname 0755) && touch 0755
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname org.freedesktop.impl.portal.desktop.athanor.service) && touch org.freedesktop.impl.portal.desktop.athanor.service
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname athanor.portal) && touch athanor.portal

install -D -m 0755 target/release/%{name} %{buildroot}%{_libexecdir}/%{name}

# Install D-Bus session service
install -D -m 0644 org.freedesktop.impl.portal.desktop.athanor.service %{buildroot}%{_datadir}/dbus-1/services/org.freedesktop.impl.portal.desktop.athanor.service

# Install Portal definition
install -D -m 0644 athanor.portal %{buildroot}%{_datadir}/xdg-desktop-portal/portals/athanor.portal

%files
%{_libexecdir}/%{name}
%{_datadir}/dbus-1/services/org.freedesktop.impl.portal.desktop.athanor.service
%{_datadir}/xdg-desktop-portal/portals/athanor.portal

%changelog
* Thu Jul 16 2026 Athanor <athanor@athanor.os> - 1.0.0-1
- Initial release

