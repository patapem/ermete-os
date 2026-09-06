%global debug_package %{nil}
# Prebuilt static binary from the upstream release: never strip it.
%global __os_install_post %{nil}
%global triple x86_64-unknown-linux-musl
Name:           athanor-bpf-linker
Version:        0.11.0
Release:        2%{?dist}
Summary:        Rust eBPF Linker for Athanor OS Live Patching

License:        MIT OR Apache-2.0
URL:            https://github.com/aya-rs/bpf-linker
Source0:        https://github.com/aya-rs/bpf-linker/releases/download/v%{version}/bpf-linker-%{triple}.tar.zst#/bpf-linker-%{version}-%{triple}.tar.zst

%description
bpf-linker for eBPF live-patching and security auditing, packaged from the
upstream static musl release archive verified against SOURCES/sources.sha256,
so that no cargo install is needed at run time.

%prep
%autosetup -c -n bpf-linker-%{version}

%build
# Nothing to build: the release ships a static binary.

%install
install -D -m 0755 bpf-linker %{buildroot}%{_bindir}/bpf-linker

%files
%{_bindir}/bpf-linker

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 0.11.0-2
- Package the upstream release archive instead of an empty placeholder binary

* Wed Aug 12 2026 Athanor Architect <admin@athanor.os> - 0.11.0-1
- Real bpf-linker static binary packaging for air-gapped CI.
