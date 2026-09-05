Name:           athanor-qa
Version:        1.0.0
Release:        1%{?dist}
Summary:        Athanor OS Quality Assurance Scripts

License:        GPL-3.0-or-later
URL:            https://github.com/hr-mes/athanor-forge

BuildArch:      noarch

%description
Diagnostic and testing scripts for Athanor OS CI/CD.

%prep
# No prep

%build
# No build

%install
mkdir -p %{buildroot}/usr/bin
install -m 0755 %{_sourcedir}/test-nvidia-modules.sh %{buildroot}/usr/bin/test-nvidia-modules.sh

%files
/usr/bin/test-nvidia-modules.sh

%changelog
* Mon Aug 03 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial release
