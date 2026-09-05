%global debug_package %{nil}
Name:           athanor-dock
Version:        1.0.0
Release:        1%{?dist}
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
Visual Dock and taskbar application library component for Athanor OS built with GTK4 and gtk4-layer-shell.

%prep
# Stub prep

%build
%set_build_flags
# cargo generate-lockfile // FORBIDDEN BY RULE 4 (Offline Build)
cargo build --release --locked

%install
mkdir -p %{buildroot}
mkdir -p $(dirname 0644) && touch 0644

mkdir -p %{buildroot}/usr/lib64/athanor
if [ -f target/release/libathanor_dock.rlib ]; then
    install -m 0644 target/release/libathanor_dock.rlib %{buildroot}/usr/lib64/athanor/
fi

%files
/usr/lib64/athanor/

%changelog
* Wed Aug 05 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial release of athanor-dock spec

