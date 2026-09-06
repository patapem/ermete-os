%global debug_package %{nil}
Name:           athanor-dock
Version:        1.0.0
Release:        2%{?dist}
Summary:        Visual Dock and taskbar application logic for Athanor OS

License:        GPL-3.0-or-later
URL:            https://github.com/hr-mes/athanor-forge


BuildRequires:  rust >= 1.80.0
BuildRequires:  cargo
BuildRequires:  gcc gcc-c++ pkgconf-pkg-config
BuildRequires:  gtk4-devel
BuildRequires:  gtk4-layer-shell-devel
BuildRequires:  glib2-devel

%description
Visual Dock and taskbar application for Athanor OS built with GTK4 and gtk4-layer-shell.
The same crate is linked into athanor-shell-rs as a library.

%prep
# Built in place from the workspace checkout: nothing to unpack.

%build
%set_build_flags
# cargo generate-lockfile // FORBIDDEN BY RULE 4 (Offline Build)
cargo build --release --locked -p %{name}

%install
install -D -m 0755 target/release/%{name} %{buildroot}%{_bindir}/%{name}

%files
%{_bindir}/%{name}

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 1.0.0-2
- Package the athanor-dock executable; the static rlib shipped before has no
  use outside the build

* Wed Aug 05 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial release of athanor-dock spec
