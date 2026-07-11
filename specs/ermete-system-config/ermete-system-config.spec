%global debug_package %{nil}
Name:           ermete-system-config
Version:        1.0.0
Release:        6%{?dist}
Summary:        Ermete OS ermete-system-config
License:        MIT
URL:            https://github.com/patapem/ermete-forge
BuildArch:      noarch

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

%files
%dir /usr/share/ermete-system-config
/usr/lib/systemd/system-preset/99-Ermete.preset
/usr/lib/tmpfiles.d/10-ermete-greetd.conf
/usr/share/ermete-system-config/greetd.toml
/usr/share/ermete-system-config/niri-greeter.kdl
/usr/share/ermete-system-config/greeter-bundle.js


%changelog
* Sat Jul 11 2026 Ermete Forge <forge@ermete.os> - 1.0.0-6
- Fix %install source path expansion to copy directly from %{_sourcedir}/usr.

* Sat Jul 11 2026 Ermete Forge <forge@ermete.os> - 1.0.0-5
- Package updated greeter-bundle.js and shadow tmpfiles overrides for instant greeter transitions.

* Wed Jul 01 2026 Ermete Forge <forge@ermete.os> - 1.0.0-1
- Initial Bedrock encapsulation
