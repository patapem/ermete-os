import re

with open('.github/workflows/ermete-forge-orchestrator.yml', 'r') as f:
    content = f.read()

# 1. Fix RPMFusion URLs
content = content.replace('/rawhide/Everything/$basearch/', '/rawhide/$basearch/')

# 2. Fix Dependencies (inject missing build tools)
content = content.replace(
    'dnf install -y rpm-build dnf-plugins-core rpmdevtools mold gcc-c++',
    'dnf install -y rpm-build dnf-plugins-core rpmdevtools mold gcc-c++ which autoconf automake libtool'
)
content = content.replace(
    'dnf install -y rpm-build rpmdevtools meson ninja-build gcc gcc-c++ vala pkgconf-pkg-config buildah skopeo',
    'dnf install -y rpm-build rpmdevtools meson ninja-build gcc gcc-c++ vala pkgconf-pkg-config buildah skopeo which autoconf automake libtool'
)
content = content.replace(
    'dnf install -y rpm-build rpmdevtools gcc gcc-c++ cargo rust cmake mold tar xz curl pkgconf-pkg-config zlib-devel openssl-devel checkpolicy policycoreutils spdlog-devel systemd-devel nlohmann-json-devel fmt-devel',
    'dnf install -y rpm-build rpmdevtools gcc gcc-c++ cargo rust cmake mold tar xz curl pkgconf-pkg-config zlib-devel openssl-devel checkpolicy policycoreutils spdlog-devel systemd-devel nlohmann-json-devel fmt-devel which autoconf automake libtool'
)
content = content.replace(
    'dnf install -y rpm-build rpmdevtools gcc gcc-c++ make cmake flex bison ncurses-devel elfutils-libelf-devel openssl-devel bc rsync tar wget curl cpio perl zstd git llvm clang lld ccache qemu-kvm stress-ng iperf3 jq gnupg2 hostname elfutils-devel dwarves openssl',
    'dnf install -y rpm-build rpmdevtools gcc gcc-c++ make cmake flex bison ncurses-devel elfutils-libelf-devel openssl-devel bc rsync tar wget curl cpio perl zstd git llvm clang lld ccache qemu-kvm stress-ng iperf3 jq gnupg2 hostname elfutils-devel dwarves openssl which autoconf automake libtool'
)

# 3. Fix Spectool logic in Custom Packages
spectool_old_custom = """
          if grep -q "Source0:.*http" specs/ermete-${{ matrix.package }}/*.spec 2>/dev/null; then
             spectool -g -R specs/ermete-${{ matrix.package }}/*.spec
          fi
"""
spectool_new_custom = """
          spectool -g -R specs/ermete-${{ matrix.package }}/*.spec || true
"""
content = content.replace(spectool_old_custom, spectool_new_custom)

# 4. Fix Spectool logic in AGS Ecosystem
spectool_old_ags = """
              if grep -q "Source0:.*http" specs/ermete-astal/$pkg/*.spec 2>/dev/null; then
                 spectool -g -R specs/ermete-astal/$pkg/*.spec
              fi
"""
spectool_new_ags = """
              spectool -g -R specs/ermete-astal/$pkg/*.spec || true
"""
content = content.replace(spectool_old_ags, spectool_new_ags)

with open('.github/workflows/ermete-forge-orchestrator.yml', 'w') as f:
    f.write(content)

print("Done fixing orchestrator.")
