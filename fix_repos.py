import glob

old_repo_cmd = "dnf install -y --nogpgcheck https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-rawhide.noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-rawhide.noarch.rpm || true"

new_repo_cmd = """cat << 'REPO' > /etc/yum.repos.d/rpmfusion-rawhide.repo
[rpmfusion-free-rawhide]
name=RPM Fusion for Fedora Rawhide - Free
baseurl=http://mirrors.rpmfusion.org/free/fedora/development/rawhide/Everything/$basearch/os/
enabled=1
gpgcheck=0

[rpmfusion-nonfree-rawhide]
name=RPM Fusion for Fedora Rawhide - Nonfree
baseurl=http://mirrors.rpmfusion.org/nonfree/fedora/development/rawhide/Everything/$basearch/os/
enabled=1
gpgcheck=0
REPO"""

for filepath in glob.glob('.github/workflows/build-upstream-*.yml'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    content = content.replace(old_repo_cmd, new_repo_cmd)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Repos fixed!")
