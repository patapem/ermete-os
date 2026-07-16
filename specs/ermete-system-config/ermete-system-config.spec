%global debug_package %{nil}
Name:           ermete-system-config
Version:        1.0.0
Release:        11%{?dist}
Summary:        Ermete OS ermete-system-config
License:        MIT
URL:            https://github.com/patapem/ermete-forge
BuildArch:      noarch

Requires:       cage greetd ermete-shell-rs greenboot

%description
Provides ermete-system-config for Ermete OS.

%prep
# Nothing to prep

%build
# Nothing to build

%install
mkdir -p %{buildroot}
cp -a %{_sourcedir}/usr %{buildroot}/
cp -a %{_sourcedir}/etc %{buildroot}/ 2>/dev/null || true

%post
mkdir -p /etc/greetd
ln -sf /usr/share/ermete-system-config/greetd.toml /etc/greetd/config.toml 2>/dev/null || true

%files
%dir /usr/share/ermete-system-config
%attr(0755,root,root) /usr/bin/ermete-session
/usr/lib/systemd/system-preset/99-Ermete.preset
/usr/lib/tmpfiles.d/10-ermete-greetd.conf
/usr/share/ermete-system-config/greetd.toml
%dir /etc/yum.repos.d
%config(noreplace) /etc/yum.repos.d/ermete-forge.repo
%attr(0755,root,root) /etc/greenboot/check/required.d/10-greetd-running.sh
%attr(0755,root,root) /etc/greenboot/check/required.d/20-niri-running.sh


%changelog
* Thu Jul 16 2026 Ermete Forge <forge@ermete.os> - 1.0.0-11
- Add /etc/yum.repos.d/ermete-forge.repo for live DNF rolling release updates

* Tue Jul 14 2026 Ermete Forge <forge@ermete.os> - 1.0.0-10
- Encapsulate /usr/bin/ermete-session native script and add %post symlink for /etc/greetd/config.toml

* Tue Jul 14 2026 Ermete Forge <forge@ermete.os> - 1.0.0-9
- Add Requires: cage greetd ermete-shell-rs and remove obsolete niri-greeter.kdl and greeter-bundle.js

* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 1.0.0-8
- Remove direct /etc/greetd/config.toml to eliminate RPM transaction file conflict with greetd package (using tmpfiles L+ symlink override)

* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 1.0.0-7
- Configure default_session command for cage Wayland kiosk executing ermete-shell-rs --greeter

* Sat Jul 11 2026 Ermete Forge <forge@ermete.os> - 1.0.0-6
- Fix %install source path expansion to copy directly from %{_sourcedir}/usr.

* Sat Jul 11 2026 Ermete Forge <forge@ermete.os> - 1.0.0-5
- Package updated greeter-bundle.js and shadow tmpfiles overrides for instant greeter transitions.

* Wed Jul 01 2026 Ermete Forge <forge@ermete.os> - 1.0.0-1
- Initial Bedrock encapsulation
