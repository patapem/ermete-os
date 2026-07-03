import glob

# The scripts to replace
old_script = """          echo "--- Downloading Source RPM per ${{ matrix.package }} ---"
          dnf download --source ${{ matrix.package }}
          dnf builddep -y *.src.rpm          
          
          echo "--- Estrazione SRPM per applicare Ponytail Ultra ---"
          rpm -ivh *.src.rpm"""

new_script = """          echo "--- Abilitazione RPM Fusion (Rawhide) ---"
          dnf install -y --nogpgcheck https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-rawhide.noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-rawhide.noarch.rpm || true
          
          echo "--- Downloading Source RPM per ${{ matrix.package }} ---"
          dnf download --source ${{ matrix.package }}
          
          echo "--- Estrazione SRPM per applicare Ponytail Ultra ---"
          rpm -ivh *.src.rpm
          
          echo "--- Risoluzione Dipendenze Estrema (su SPEC) ---"
          dnf builddep -y ~/rpmbuild/SPECS/*.spec"""

for filepath in glob.glob('.github/workflows/build-upstream-*.yml'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    content = content.replace(old_script, new_script)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Workflows fixed!")
