Name:           athanor-keylime
Version:        1.0
Release:        2%{?dist}
Summary:        Athanor OS Keylime Agent Configuration
License:        GPL-3.0-or-later
URL:            https://github.com/hr-mes/athanor
Source0:        99-athanor.conf

Requires:       keylime-agent
Requires:       tpm2-tools
BuildArch:      noarch

%description
Configuration package for the Keylime agent in Athanor OS: binds the TPM
measurements for remote attestation (phase 3) and seals the security enclave.

%prep
# Nothing to unpack: the drop-in is Source0.

%build

%install
install -D -m 0644 %{SOURCE0} %{buildroot}/etc/keylime/agent.conf.d/99-athanor.conf

%files
%defattr(-,root,root,-)
%dir /etc/keylime/agent.conf.d
%config(noreplace) /etc/keylime/agent.conf.d/99-athanor.conf

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 1.0-2
- Install the drop-in from Source0 instead of an empty placeholder file

* Mon Aug 03 2026 Athanor Core <core@athanor.os> - 1.0-1
- Initial release for Phase 3
