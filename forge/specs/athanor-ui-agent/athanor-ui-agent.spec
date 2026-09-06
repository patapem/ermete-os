%global src_dir forge/specs/%{name}/%{name}-%{version}
Name:           athanor-ui-agent
Version:        1.0.0
Release:        4%{?dist}
Summary:        Athanor Generative UI Agent

License:        MIT


BuildArch:      noarch
Requires:       python3
Requires:       python3-aiohttp

%description
Context-aware generative UI daemon for Athanor OS. Interfaces with local LLMs (Ollama) to orchestrate desktop widgets natively based on system context.

%prep
# Built in place from the workspace checkout: nothing to unpack.

%build
# Nothing to build: a Python script.

%install
install -D -m 0755 %{src_dir}/agent.py %{buildroot}/usr/libexec/athanor-ui-agent/agent.py
install -D -m 0644 %{src_dir}/SYSTEM_PROMPT.md %{buildroot}/usr/libexec/athanor-ui-agent/SYSTEM_PROMPT.md
install -D -m 0644 %{src_dir}/athanor-ui-agent.service %{buildroot}/usr/lib/systemd/user/athanor-ui-agent.service

%files
/usr/libexec/athanor-ui-agent/agent.py
/usr/libexec/athanor-ui-agent/SYSTEM_PROMPT.md
/usr/lib/systemd/user/athanor-ui-agent.service

%changelog
* Sun Sep 06 2026 Athanor Forge <forge@athanor.os> - 1.0.0-4
- Install the agent, its prompt and the user unit from the source directory
  instead of empty placeholder files

* Sun Jul 19 2026 Athanor Forge <forge@athanor.os> - 1.0.0-1
- Initial release of the Generative UI agent
