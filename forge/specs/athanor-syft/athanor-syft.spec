%global debug_package %{nil}
# Prebuilt Go binary from the upstream release: never strip it.
%global __os_install_post %{nil}
Name:           athanor-syft
Version:        1.10.0
Release:        2%{?dist}
Summary:        SBOM (Software Bill of Materials) Generator for Athanor OS

License:        Apache-2.0
URL:            https://github.com/anchore/syft
Source0:        https://github.com/anchore/syft/releases/download/v%{version}/syft_%{version}_linux_amd64.tar.gz

%description
Anchore Syft SBOM generator, packaged for the Athanor OS builder images from the
upstream release archive verified against SOURCES/sources.sha256, so that no
build step downloads it at run time.

%prep
%autosetup -c -n syft-%{version}

%build
# Nothing to build: the release ships a static binary.

%install
install -D -m 0755 syft %{buildroot}%{_bindir}/syft

%files
%license LICENSE
%{_bindir}/syft

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 1.10.0-2
- Package the upstream release archive instead of an empty placeholder binary

* Wed Aug 12 2026 Athanor Architect <admin@athanor.os> - 1.10.0-1
- Real Syft binary packaging to eradicate curl-piping.
