Name:           athanor-compositor
Version:        1.0.0
Release:        1%{?dist}
Summary:        Athanor OS Core Component - athanor-compositor

License:        GPLv3
URL:            https://github.com/hr-mes/athanor

%description
Core component implementation for athanor-compositor.

%prep
# No prep needed for local workspace build, sources are mounted directly

%build
%set_build_flags
cd /forge/system/athanor-compositor
cargo build --release --offline -p %{name}

%install
mkdir -p %{buildroot}/usr/bin
install -m 755 /forge/system/athanor-compositor/target/release/athanor-compositor %{buildroot}/usr/bin/athanor-compositor

%files
/usr/bin/athanor-compositor

