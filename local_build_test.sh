#!/bin/bash
PACKAGE=$1
TYPE=$2

if [ "$TYPE" == "custom" ]; then
    podman run --privileged --rm -v $(pwd):/work -w /work registry.fedoraproject.org/fedora:43 bash -c "
        set -e
        dnf install -y rpm-build rpmdevtools gcc gcc-c++ cargo rust cmake mold tar xz curl pkgconf-pkg-config zlib-devel openssl-devel checkpolicy policycoreutils spdlog-devel systemd-devel nlohmann-json-devel fmt-devel which autoconf automake libtool
        cp config/rpmmacros ~/.rpmmacros
        rpmdev-setuptree
        
        if [ -d \"specs/ermete-$PACKAGE/SOURCES\" ]; then 
            cp -a specs/ermete-$PACKAGE/SOURCES/* ~/rpmbuild/SOURCES/
        fi
        
        dnf builddep -y specs/ermete-$PACKAGE/*.spec
        spectool -g -R specs/ermete-$PACKAGE/*.spec
        cp specs/ermete-$PACKAGE/*.spec ~/rpmbuild/SPECS/
        rpmbuild -bb --nocheck ~/rpmbuild/SPECS/*.spec
        echo 'BUILD SUCCESSFUL FOR $PACKAGE'
        ls -la ~/rpmbuild/RPMS/*/*.rpm
    "
elif [ "$TYPE" == "upstream" ]; then
    podman run --privileged --rm -v $(pwd):/work -w /work registry.fedoraproject.org/fedora:43 bash -c "
        set -e
        dnf install -y rpm-build dnf-plugins-core rpmdevtools mold gcc-c++ which autoconf automake libtool
        cp config/rpmmacros ~/.rpmmacros
        rpmdev-setuptree
        cd ~/rpmbuild/SRPMS
        
        dnf install -y https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-43.noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-43.noarch.rpm
        dnf download --source $PACKAGE
        rpm -ivh *.src.rpm
        
        dnf builddep -y ~/rpmbuild/SPECS/*.spec
        
        for spec in ~/rpmbuild/SPECS/*.spec; do
            if ! grep -q \"debug_package %nil\" \"\$spec\"; then
                awk '/^Name:/ { print \"%global debug_package %nil\"; print \$0; next } 1' \"\$spec\" > \"\$spec.tmp\" && mv \"\$spec.tmp\" \"\$spec\"
            fi
        done
        
        rpmbuild -bb --nocheck ~/rpmbuild/SPECS/*.spec
        echo 'BUILD SUCCESSFUL FOR $PACKAGE'
        ls -la ~/rpmbuild/RPMS/*/*.rpm
    "
fi
