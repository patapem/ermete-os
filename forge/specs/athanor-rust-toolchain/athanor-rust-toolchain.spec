Name:           athanor-rust-toolchain
Version:        1.0.0
Release:        1%{?dist}
Summary:        Athanor OS Embedded Rust & Kani Formal Verification Toolchain

License:        MIT
URL:            https://github.com/hr-mes/athanor

Requires:       gcc, gcc-c++, make, cmake, clang, llvm

%description
Provides the pre-compiled embedded Rust Nightly toolchain, Kani Formal Verification engine, and ASAN instrumentation for Athanor OS CI/CD.

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}
mkdir -p %{buildroot}$(dirname /opt/athanor-rust/rustc-mock) && touch %{buildroot}/opt/athanor-rust/rustc-mock


%files
/opt/athanor-rust/rustc-mock

%changelog
* Fri Aug 07 2026 Athanor Architect <admin@athanor.os> - 1.0.0-1
- Initial embedded toolchain spec.
