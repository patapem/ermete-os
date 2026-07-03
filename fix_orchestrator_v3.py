import re

with open('.github/workflows/ermete-forge-orchestrator.yml', 'r') as f:
    content = f.read()

# 1. Reverse spectool and builddep in Custom Packages
old_custom = """          spectool -g -R specs/ermete-${{ matrix.package }}/*.spec || true
          
          dnf builddep -y specs/ermete-${{ matrix.package }}/*.spec || true"""
new_custom = """          dnf builddep -y specs/ermete-${{ matrix.package }}/*.spec || true
          spectool -g -R specs/ermete-${{ matrix.package }}/*.spec || true"""
content = content.replace(old_custom, new_custom)

# 2. Reverse spectool and builddep in AGS
old_ags = """              spectool -g -R specs/ermete-astal/$pkg/*.spec || true
              dnf builddep -y specs/ermete-astal/$pkg/*.spec || true"""
new_ags = """              dnf builddep -y specs/ermete-astal/$pkg/*.spec || true
              spectool -g -R specs/ermete-astal/$pkg/*.spec || true"""
content = content.replace(old_ags, new_ags)

# 3. Fix RPMFusion in ALL upstream jobs (replace the cat block with the dnf install)
rpmfusion_old = """          echo "--- Abilitazione RPM Fusion (Rawhide) ---"
                    cat << 'REPO' > /etc/yum.repos.d/rpmfusion-rawhide.repo
          [rpmfusion-free-rawhide]
          name=RPM Fusion for Fedora Rawhide - Free
          baseurl=http://mirrors.rpmfusion.org/free/fedora/development/rawhide/$basearch/os/
          enabled=1
          gpgcheck=0
          
          [rpmfusion-nonfree-rawhide]
          name=RPM Fusion for Fedora Rawhide - Nonfree
          baseurl=http://mirrors.rpmfusion.org/nonfree/fedora/development/rawhide/$basearch/os/
          enabled=1
          gpgcheck=0
          REPO"""
rpmfusion_new = """          echo "--- Abilitazione RPM Fusion ---"
          dnf install -y https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-43.noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-43.noarch.rpm || true"""

content = content.replace(rpmfusion_old, rpmfusion_new)

with open('.github/workflows/ermete-forge-orchestrator.yml', 'w') as f:
    f.write(content)

print("Done fixing orchestrator v3.")
