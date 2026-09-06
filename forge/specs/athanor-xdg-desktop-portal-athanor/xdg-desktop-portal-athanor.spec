%global debug_package %{nil}
%global crate_dir forge/specs/athanor-%{name}/%{name}-%{version}
Name:           xdg-desktop-portal-athanor
Version:        1.0.0
Release:        3%{?dist}
Summary:        Athanor OS Desktop Portal (Privacy & ScreenShare)

License:        GPL-3.0-or-later
URL:            https://github.com/hr-mes/athanor-forge


BuildRequires:  rust cargo pkgconf-pkg-config openssl-devel
Requires:       athanor-shell-rs

%description
Athanor OS implementation of the XDG Desktop Portal for native Wayland/Niri integration, privacy prompts, and hardware indicators.

%prep
# Built in place from the workspace checkout: nothing to unpack.

%build
%set_build_flags
# cargo generate-lockfile // FORBIDDEN BY RULE 4 (Offline Build)
cargo build --release --locked -p %{name}

%install
install -D -m 0755 target/release/%{name} %{buildroot}%{_libexecdir}/%{name}

# D-Bus session service and portal definition, from the crate directory.
install -D -m 0644 %{crate_dir}/org.freedesktop.impl.portal.desktop.athanor.service %{buildroot}%{_datadir}/dbus-1/services/org.freedesktop.impl.portal.desktop.athanor.service
install -D -m 0644 %{crate_dir}/athanor.portal %{buildroot}%{_datadir}/xdg-desktop-portal/portals/athanor.portal

%files
%{_libexecdir}/%{name}
%{_datadir}/dbus-1/services/org.freedesktop.impl.portal.desktop.athanor.service
%{_datadir}/xdg-desktop-portal/portals/athanor.portal

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 1.0.0-3
- Build only this crate from the workspace; install the D-Bus service and the
  portal definition from the crate directory instead of empty placeholder files

* Thu Jul 16 2026 Athanor <athanor@athanor.os> - 1.0.0-1
- Initial release
