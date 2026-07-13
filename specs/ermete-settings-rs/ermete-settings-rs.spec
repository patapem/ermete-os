Name:           ermete-settings-rs
Version:        1.0.0
Release:        2%{?dist}
Summary:        Pure Rust native System Settings for Ermete OS

License:        GPLv3+
URL:            https://github.com/patapem/ermete-forge
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  rust cargo
BuildRequires:  gtk4-devel

%description
Ermete Settings is the native control panel for Ermete OS, written in pure Rust with GTK4.

%prep
%autosetup

%build
cargo build --release --offline

%install
rm -rf $RPM_BUILD_ROOT
install -d $RPM_BUILD_ROOT/%{_bindir}
install -m 0755 target/release/%{name} $RPM_BUILD_ROOT/%{_bindir}/%{name}
install -d $RPM_BUILD_ROOT/%{_datadir}/applications
install -m 0644 os.ermete.Settings.desktop $RPM_BUILD_ROOT/%{_datadir}/applications/os.ermete.Settings.desktop

%files
%{_bindir}/%{name}
%{_datadir}/applications/os.ermete.Settings.desktop

%changelog
* Mon Jul 13 2026 Ermete Forge <forge@ermete.os> - 1.0.0-2
- Complete audio sync, desktop entry and bump spec release to 2

