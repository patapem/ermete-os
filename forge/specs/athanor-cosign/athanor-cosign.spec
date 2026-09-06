%global debug_package %{nil}
# Prebuilt Go binary from the upstream release: never strip it.
%global __os_install_post %{nil}
Name:           athanor-cosign
Version:        2.4.0
Release:        2%{?dist}
Summary:        Container Signing Tool for Athanor OS

License:        Apache-2.0
URL:            https://github.com/sigstore/cosign
Source0:        https://github.com/sigstore/cosign/releases/download/v%{version}/cosign-linux-amd64#/cosign-%{version}-linux-amd64

%description
Sigstore cosign for air-gapped container image signing, packaged from the
upstream release binary verified against SOURCES/sources.sha256.

%prep
# Nothing to unpack: Source0 is the binary itself.

%build
# Nothing to build: the release ships a static binary.

%install
install -D -m 0755 %{SOURCE0} %{buildroot}%{_bindir}/cosign

%files
%{_bindir}/cosign

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 2.4.0-2
- Package the upstream release binary instead of an empty placeholder file

* Wed Aug 12 2026 Athanor Architect <admin@athanor.os> - 2.4.0-1
- Initial Cosign binary packaging.
