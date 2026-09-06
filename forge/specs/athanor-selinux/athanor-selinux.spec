%global debug_package %{nil}
Name:           athanor-selinux
Version:        1.0
Release:        4%{?dist}
Summary:        Custom SELinux policies for Athanor OS
License:        MIT
URL:            https://github.com/hr-mes/athanor-forge
Source0:        bootupd_lsblk.te
Source1:        athanor_scx.te

BuildArch:      noarch
BuildRequires:  checkpolicy

%description
Custom SELinux Type Enforcement policies for Athanor OS.
Includes mitigations for bootupd and scx eBPF schedulers.

%prep
%setup -q -c -T
cp %{SOURCE0} %{SOURCE1} .

%build
# checkmodule compiles each .te into a CIL module (the require block resolves
# against the base policy when the module is installed). CIL needs no
# semodule_package step: `semodule -i module.cil` loads it as it is.
for module in bootupd_lsblk athanor_scx; do
  checkmodule -M -m -C -o "${module}.cil" "${module}.te"
done

%install
install -D -m 0644 bootupd_lsblk.cil %{buildroot}%{_datadir}/selinux/packages/bootupd_lsblk.cil
install -D -m 0644 athanor_scx.cil %{buildroot}%{_datadir}/selinux/packages/athanor_scx.cil

%files
%{_datadir}/selinux/packages/bootupd_lsblk.cil
%{_datadir}/selinux/packages/athanor_scx.cil

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 1.0-4
- Ship the modules as CIL: checkmodule -C produces them directly and the
  builder has no semodule_package

* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 1.0-3
- Compile the policy modules with checkmodule and semodule_package instead of
  installing empty placeholder .pp files

* Tue Jul 07 2026 Athanor Forge <forge@athanor.os> - 1.0-2
- Purged dangerous %post scriptlet for OSTree compatibility
- Removed global allow_execmem 1 security risk

* Sun Jun 28 2026 Athanor Forge <forge@athanor.os> - 1.0-1
- Initial release migrating SELinux policies from Containerfile to RPM
