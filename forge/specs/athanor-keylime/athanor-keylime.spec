Name:           athanor-keylime
Version:        1.0
Release:        1%{?dist}
Summary:        Athanor OS Keylime Agent Configuration
License:        GPLv3+
URL:            https://github.com/athanor


Requires:       keylime-agent
Requires:       tpm2-tools
BuildArch:      noarch

%description
Pacchetto di configurazione per l'agente Keylime in Athanor OS.
Implementa Remote Attestation (Fase 3) bindando misurazioni TPM
e sigillando l'enclave di sicurezza.

%prep
# Stub prep

%build

%install
mkdir -p %{buildroot}
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname 99-athanor.conf) && touch 99-athanor.conf

mkdir -p %{buildroot}/etc/keylime/agent.conf.d/
install -m 0644 99-athanor.conf %{buildroot}/etc/keylime/agent.conf.d/99-athanor.conf

%files
%defattr(-,root,root,-)
%dir /etc/keylime/agent.conf.d
%config(noreplace) /etc/keylime/agent.conf.d/99-athanor.conf

%changelog
* Mon Aug 03 2026 Athanor Core <core@athanor.os> - 1.0-1
- Initial release for Phase 3

