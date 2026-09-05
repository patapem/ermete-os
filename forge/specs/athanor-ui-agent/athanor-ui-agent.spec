Name:           athanor-ui-agent
Version:        1.0.0
Release:        3%{?dist}
Summary:        Athanor Generative UI Agent

License:        MIT


BuildArch:      noarch
Requires: python3
Requires:       python3-aiohttp

%description
Context-aware generative UI daemon for Athanor OS. Interfaces with local LLMs (Ollama) to orchestrate desktop widgets natively based on system context.

%prep
# Stub prep

%build
# Nothing to build, Python script

%install
mkdir -p %{buildroot}
mkdir -p $(dirname 0755) && touch 0755
mkdir -p $(dirname agent.py) && touch agent.py
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname SYSTEM_PROMPT.md) && touch SYSTEM_PROMPT.md
mkdir -p $(dirname 0644) && touch 0644
mkdir -p $(dirname athanor-ui-agent.service) && touch athanor-ui-agent.service

mkdir -p %{buildroot}/usr/libexec/athanor-ui-agent
install -m 0755 agent.py %{buildroot}/usr/libexec/athanor-ui-agent/agent.py
install -m 0644 SYSTEM_PROMPT.md %{buildroot}/usr/libexec/athanor-ui-agent/SYSTEM_PROMPT.md

mkdir -p %{buildroot}/usr/lib/systemd/user
install -m 0644 athanor-ui-agent.service %{buildroot}/usr/lib/systemd/user/athanor-ui-agent.service

%files
/usr/libexec/athanor-ui-agent/agent.py
/usr/libexec/athanor-ui-agent/SYSTEM_PROMPT.md
/usr/lib/systemd/user/athanor-ui-agent.service

%changelog
* Sun Jul 19 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial release of the Generative UI agent

