#!/bin/bash
podman run --privileged --rm -v $(pwd):/work -w /work registry.fedoraproject.org/fedora:43 bash -c "
    set -e
    dnf install -y rpm-build rpmdevtools gcc gcc-c++ meson vala gobject-introspection-devel gtk3-devel gtk4-devel gjs-devel lua-devel make tar xz curl pkgconf-pkg-config which autoconf automake libtool
    cp config/rpmmacros ~/.rpmmacros
    rpmdev-setuptree
    
    # Let's test just ONE astal subpackage to prove it works
    pkg=astal
    
    cp -r specs/ermete-astal/\$pkg ~/rpmbuild/SPECS/\$pkg
    dnf builddep -y ~/rpmbuild/SPECS/\$pkg/*.spec
    spectool -g -R ~/rpmbuild/SPECS/\$pkg/*.spec
    rpmbuild -bb --nocheck ~/rpmbuild/SPECS/\$pkg/*.spec
    
    echo 'BUILD SUCCESSFUL FOR ASTAL/\$pkg'
    ls -la ~/rpmbuild/RPMS/*/*.rpm
"
