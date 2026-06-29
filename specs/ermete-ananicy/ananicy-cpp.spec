Name:           ananicy-cpp
Version:        1.1.1
Release:        1%{?dist}
Summary:        Ananicy rewritten in C++

License:        GPLv3
URL:            https://gitlab.com/ananicy-cpp/ananicy-cpp
Source0:        https://gitlab.com/ananicy-cpp/ananicy-cpp/-/archive/v%{version}/ananicy-cpp-v%{version}.tar.gz

BuildRequires:  cmake
BuildRequires:  gcc-c++
BuildRequires:  spdlog-devel
BuildRequires:  fmt-devel
BuildRequires:  systemd-devel
BuildRequires:  nlohmann-json-devel

%description
Ananicy-cpp is a rewrite of ananicy in C++ for lower resource usage and faster startup.

%prep
%autosetup -n ananicy-cpp-v%{version}
# Patch per glibc > 2.40 che include nativamente sched_attr
sed -i 's/\bsched_getattr\b/sys_sched_getattr/g' src/platform/linux/syscalls.h src/platform/linux/priority.cpp
sed -i 's/\bsched_setattr\b/sys_sched_setattr/g' src/platform/linux/syscalls.h src/platform/linux/priority.cpp
sed -i 's/struct \[\[gnu::packed\]\] sched_attr/struct sys_sched_attr/g' src/platform/linux/syscalls.h
sed -i 's/struct sched_attr/struct sys_sched_attr/g' src/platform/linux/syscalls.h src/platform/linux/priority.cpp

%build
%cmake -DUSE_EXTERNAL_SPDLOG=ON -DUSE_EXTERNAL_FMTLIB=ON -DUSE_EXTERNAL_JSON=ON -DENABLE_SYSTEMD=ON
%cmake_build

%install
%cmake_install
mkdir -p %{buildroot}/etc/ananicy.d/
mkdir -p %{buildroot}%{_unitdir}
install -Dm644 ananicy-cpp.service %{buildroot}%{_unitdir}/ananicy-cpp.service

%files
%license LICENSE
%doc README.md
%{_bindir}/ananicy-cpp
%{_unitdir}/ananicy-cpp.service
%config(noreplace) /etc/ananicy.d/

%changelog
* Mon Jun 29 2026 Ermete Forge <forge@ermete> - 1.1.1-1
- Initial forge build
