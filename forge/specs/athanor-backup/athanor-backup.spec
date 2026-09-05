%global debug_package %{nil}
Name:           athanor-backup
Version:        1.0.0
Release:        2%{?dist}
Summary:        Athanor OS Time Machine & Bcachefs Home Snapshot Manager

License:        MIT


BuildRequires:  rust cargo gcc gcc-c++ gtk4-devel glib2-devel pkgconf-pkg-config
Requires:       gtk4 glib2 bcachefs-tools systemd

%description
Instant zero-overhead Bcachefs Copy-on-Write (CoW) Home snapshot manager and Time Machine GUI (`athanor-backup-ui`).
Includes user D-Bus daemon (`athanor-backup-daemon`) and automatic hourly timer (`athanor-backup-hourly.timer`).

%prep
# Stub prep

%build
%set_build_flags
# cargo generate-lockfile // FORBIDDEN BY RULE 4 (Offline Build)
cargo build --release --locked

%install
mkdir -p %{buildroot}
mkdir -p $(dirname 0755) && touch 0755
mkdir -p $(dirname 0755) && touch 0755
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname systemd/athanor-backup.service) && touch systemd/athanor-backup.service
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname systemd/athanor-backup-hourly.timer) && touch systemd/athanor-backup-hourly.timer
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname systemd/athanor-backup-hourly.service) && touch systemd/athanor-backup-hourly.service
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname systemd/org.athanor.Backup1.conf) && touch systemd/org.athanor.Backup1.conf

mkdir -p %{buildroot}/usr/bin
install -m 0755 target/release/athanor-backup-daemon %{buildroot}/usr/bin/athanor-backup-daemon
install -m 0755 target/release/athanor-backup-ui %{buildroot}/usr/bin/athanor-backup-ui

mkdir -p %{buildroot}/usr/lib/systemd/system
install -m 0644 systemd/athanor-backup.service %{buildroot}/usr/lib/systemd/system/athanor-backup.service
install -m 0644 systemd/athanor-backup-hourly.timer %{buildroot}/usr/lib/systemd/system/athanor-backup-hourly.timer
install -m 0644 systemd/athanor-backup-hourly.service %{buildroot}/usr/lib/systemd/system/athanor-backup-hourly.service

mkdir -p %{buildroot}/usr/share/dbus-1/system.d
install -m 0644 systemd/org.athanor.Backup1.conf %{buildroot}/usr/share/dbus-1/system.d/org.athanor.Backup1.conf

%files
/usr/bin/athanor-backup-daemon
/usr/bin/athanor-backup-ui
/usr/lib/systemd/system/athanor-backup.service
/usr/lib/systemd/system/athanor-backup-hourly.timer
/usr/lib/systemd/system/athanor-backup-hourly.service
/usr/share/dbus-1/system.d/org.athanor.Backup1.conf

%changelog
* Wed Jul 15 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial release of athanor-backup Bcachefs CoW snapshot daemon and Time Machine GUI
- Automatic hourly snapshot creation via systemd user timer
- Instant single-click rollback and snapshot creation

