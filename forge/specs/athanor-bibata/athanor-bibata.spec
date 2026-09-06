%global debug_package %{nil}
%global theme Bibata-Modern-Classic
Name:           athanor-bibata-cursor
Version:        2.0.7
Release:        2%{?dist}
Summary:        Open source, compact, and material designed cursor set
License:        GPL-3.0-only
URL:            https://github.com/ful1e5/Bibata_Cursor
Source0:        https://github.com/ful1e5/Bibata_Cursor/releases/download/v%{version}/%{theme}.tar.xz#/%{theme}-%{version}.tar.xz

BuildArch:      noarch

%description
Bibata cursor theme (Modern Classic), packaged for Athanor OS from the upstream
release archive verified against SOURCES/sources.sha256.

%prep
%autosetup -n %{theme}

%build
# Nothing to build: the release ships the rendered cursors.

%install
install -d %{buildroot}%{_datadir}/icons/%{theme}
cp -a cursor.theme index.theme cursors %{buildroot}%{_datadir}/icons/%{theme}/

%files
%{_datadir}/icons/%{theme}

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 2.0.7-2
- Package the upstream release archive instead of an empty placeholder tree

* Sun Jun 28 2026 Athanor Forge <forge@athanor.os> - 2.0.7-1
- Repackaged binary asset into RPM for zero-network OS build
