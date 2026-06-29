%bcond check 1

%global gomodulesmode GO111MODULE=on

# https://github.com/Aylur/ags
%global goipath         ags
%global forgeurl        https://github.com/Aylur/ags
Version:                2.3.0

%global common_description %{expand:
Scaffoling CLI for Astal+TypeScript.}

Name:           aylurs-gtk-shell2
Release:        %autorelease
Summary:        Scaffoling CLI for Astal+TypeScript

License:        Apache-2.0 AND BSD-3-Clause AND GPL-3.0-only AND MIT
URL:            https://github.com/Aylur/ags
Source0:        https://github.com/Aylur/ags/archive/v%{version}/ags-%{version}.tar.gz

BuildRequires:  golang
BuildRequires:  pkgconfig(astal-gjs)

Requires:       astal-gjs%{?_isa}
Requires:       astal-libs%{?_isa}
Requires:       gtk4-layer-shell%{?_isa}

Supplements:    astal
Recommends:     astal-gtk4

%description %{common_description}

%prep
%autosetup -n ags-%{version} -p1

%build
export GO111MODULE=on
export GOPATH=$(pwd)/_build
export GOPROXY=https://proxy.golang.org,direct

go build -v -ldflags "-X ags/main.gtk4LayerShell=/usr/lib64/libgtk4-layer-shell.so.0 -X ags/main.astalGjs=$(pkg-config --variable=srcdir astal-gjs)" -o bin/ags .

%install
install -m 0755 -vd                     %{buildroot}%{_bindir}
install -m 0755 -vp bin/* %{buildroot}%{_bindir}/

bin/ags completion bash > %{name}.bash
bin/ags completion fish > %{name}.fish
bin/ags completion zsh > %{name}.zsh

install -Dpm0644 %{name}.bash %{buildroot}%{_datadir}/bash-completion/completions/ags
install -Dpm0644 %{name}.fish %{buildroot}%{_datadir}/fish/vendor_completions.d/ags.fish
install -Dpm0644 %{name}.zsh  %{buildroot}%{_datadir}/zsh/site-functions/_ags

%files
%doc docs README.md
%{_bindir}/ags
%{_datadir}/bash-completion/completions/ags
%{_datadir}/fish/vendor_completions.d/ags.fish
%{_datadir}/zsh/site-functions/_ags

%changelog
%autochangelog
