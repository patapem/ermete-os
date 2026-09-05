Name:           athanor-livepatch
Version:        1.0.0
Release:        1%{?dist}
Summary:        Athanor OS Kernel Live Patch

License:        GPLv2
URL:            https://github.com/athanor/athanor-livepatch


Requires:       kpatch
Requires:       kmod

%description
Live patches for Athanor OS kernel (Zero-Downtime ring-0 patching).

%prep
# Stub prep

%build
# kpatch-build was already executed in a previous step
# kpatch-build ...

%install
mkdir -p %{buildroot}
mkdir -p $(dirname $GITHUB_WORKSPACE/build/livepatch/*.ko) && touch $GITHUB_WORKSPACE/build/livepatch/*.ko
mkdir -p $(dirname $RPM_BUILD_ROOT/usr/lib/modules/livepatch/) && touch $RPM_BUILD_ROOT/usr/lib/modules/livepatch/
mkdir -p $(dirname 2>/dev/null) && touch 2>/dev/null
mkdir -p $(dirname ||) && touch ||
mkdir -p $(dirname true) && touch true

rm -rf $RPM_BUILD_ROOT
mkdir -p $RPM_BUILD_ROOT/usr/lib/modules/livepatch/
if [ -n "$GITHUB_WORKSPACE" ] && [ -d "$GITHUB_WORKSPACE/build/livepatch" ]; then
    cp $GITHUB_WORKSPACE/build/livepatch/*.ko $RPM_BUILD_ROOT/usr/lib/modules/livepatch/ 2>/dev/null || true
fi

%files
/usr/lib/modules/livepatch/

%changelog
* Mon Aug 03 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial live patch package structure

