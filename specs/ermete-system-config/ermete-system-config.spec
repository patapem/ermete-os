%global debug_package %{nil}
Name:           ermete-system-config
Version:        1.0.0
Release:        4%{?dist}
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
mkdir -p %{buildroot}/usr/share/ermete-system-config
mkdir -p %{buildroot}/usr/lib/systemd/system-preset
mkdir -p %{buildroot}/usr/lib/tmpfiles.d
cp -a %{_sourcedir}/usr/lib/systemd/system-preset/* %{buildroot}/usr/lib/systemd/system-preset/ || true
cp -a %{_sourcedir}/usr/lib/tmpfiles.d/* %{buildroot}/usr/lib/tmpfiles.d/ || true
cp -a %{_sourcedir}/usr/share/ermete-system-config/greetd.toml %{buildroot}/usr/share/ermete-system-config/greetd.toml || true
cp -a %{_sourcedir}/usr/share/ermete-system-config/niri-greeter.kdl %{buildroot}/usr/share/ermete-system-config/niri-greeter.kdl || true
cp -a %{_sourcedir}/usr/share/ermete-system-config/greeter-bundle.js %{buildroot}/usr/share/ermete-system-config/greeter-bundle.js 2>/dev/null || true

%post

%files
%dir /usr/share/ermete-system-config
/usr/lib/systemd/system-preset/99-Ermete.preset
/usr/lib/tmpfiles.d/10-ermete-greetd.conf
/usr/share/ermete-system-config/greetd.toml
/usr/share/ermete-system-config/niri-greeter.kdl
%ghost /usr/share/ermete-system-config/greeter-bundle.js


%changelog
* Wed Jul 01 2026 Ermete Forge <forge@ermete.os> - 1.0.0-1
- Initial Bedrock encapsulation
