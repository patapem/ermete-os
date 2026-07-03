import glob

old_check = """      - name: Check Idempotency (Upstream Version Match)
        id: check_idempotency
        run: |
          dnf install -y dnf5 skopeo jq
          IMAGE_LOWER=$(echo "${{ env.REGISTRY }}/${{ github.repository_owner }}/ermete-forge-rolling-${{ matrix.package }}:latest" | tr '[:upper:]' '[:lower:]')
          
          # Trova versione upstream su Fedora
          UPSTREAM_INFO=$(dnf5 info --repo=updates --repo=fedora ${{ matrix.package }})"""

new_check = """      - name: Check Idempotency (Upstream Version Match)
        id: check_idempotency
        run: |
          dnf install -y dnf5 skopeo jq
          dnf install -y --nogpgcheck https://mirrors.rpmfusion.org/free/fedora/rpmfusion-free-release-rawhide.noarch.rpm https://mirrors.rpmfusion.org/nonfree/fedora/rpmfusion-nonfree-release-rawhide.noarch.rpm || true
          IMAGE_LOWER=$(echo "${{ env.REGISTRY }}/${{ github.repository_owner }}/ermete-forge-rolling-${{ matrix.package }}:latest" | tr '[:upper:]' '[:lower:]')
          
          # Trova versione upstream su Fedora (inclusi RPM Fusion)
          UPSTREAM_INFO=$(dnf5 info ${{ matrix.package }})"""

for filepath in glob.glob('.github/workflows/build-upstream-*.yml'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    content = content.replace(old_check, new_check)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Idempotency checks fixed!")
