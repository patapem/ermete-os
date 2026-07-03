import sys
import re

def process_workflow(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    packages = [
        'build-starship', 'build-bat', 'build-selinux', 'build-ananicy', 'build-base-config', 'build-ags-config',
        'build-niri-session', 'build-ide-bootstrap', 'build-system-services', 'build-nix-support',
        'build-system-config', 'build-system-tweaks', 'build-matugen', 'build-bibata'
    ]
    
    # Split the document into top-level blocks by regex finding "  <job-name>:\n"
    # We can tokenize the document into job blocks.
    # A job block starts with "  [a-z-]+:\n" and goes until the next one.
    
    # Find all job starts
    matches = list(re.finditer(r'^  ([a-z0-9-]+):\n', content, re.MULTILINE))
    
    out_parts = []
    last_end = 0
    
    for i in range(len(matches)):
        start = matches[i].start()
        end = matches[i+1].start() if i+1 < len(matches) else len(content)
        
        # Add any preamble before the first match
        if i == 0:
            out_parts.append(content[:start])
            
        job_block = content[start:end]
        job_name = matches[i].group(1)
        
        if job_name not in packages:
            out_parts.append(job_block)
            continue
            
        print(f"Patching {job_name}...")
        
        # We are inside a target job. Let's find "    steps:\n"
        steps_split = job_block.split('    steps:\n', 1)
        if len(steps_split) != 2:
            out_parts.append(job_block)
            continue
            
        job_header = steps_split[0]
        steps_text = steps_split[1]
        
        # Split steps by "      - "
        steps_raw = steps_text.split('\n      - ')
        
        new_steps = []
        
        pkg_name = job_name.replace('build-', '')
        
        for idx, step in enumerate(steps_raw):
            if not step.strip() and idx != 0:
                continue
                
            full_step = "      - " + step if idx > 0 else step
            
            if 'uses: actions/checkout@v4' in full_step:
                new_steps.append(full_step)
                
                if 'id: hash' not in steps_text:
                    hash_step = f"""      - name: Calculate Hash
        id: hash
        run: echo "hash=${{{{ hashFiles('specs/ermete-{pkg_name}/**', 'config/rpmmacros') }}}}" >> $GITHUB_OUTPUT"""
                    new_steps.append(hash_step)
                
                check_step = f"""      - name: Check Idempotency
        id: check
        run: |
          dnf install -y skopeo
          IMAGE="docker://${{{{ env.REGISTRY }}}}/${{{{ github.repository_owner }}}}/ermete-forge-{pkg_name}:${{{{ steps.hash.outputs.hash }}}}"
          IMAGE_LOWER=$(echo "$IMAGE" | tr '[:upper:]' '[:lower:]')
          if skopeo inspect "$IMAGE_LOWER" >/dev/null 2>&1; then
            echo "Immagine trovata, skip."
            echo "skip=true" >> $GITHUB_OUTPUT
          else
            echo "skip=false" >> $GITHUB_OUTPUT
          fi"""
                new_steps.append(check_step)
                continue
                
            if 'name: Calculate Hash' in full_step:
                if 'id: hash' in steps_text:
                     new_steps.append(full_step)
                continue
                
            is_publish = 'name: Publish Micro-Container OCI' in full_step
            
            lines = full_step.split('\n')
            new_lines = []
            has_if = False
            
            for line in lines:
                if line.lstrip().startswith('if:'):
                    new_lines.append(line + " && steps.check.outputs.skip != 'true'")
                    has_if = True
                elif line.lstrip().startswith('run:') or line.lstrip().startswith('uses:'):
                    if not has_if:
                        indent = line[:len(line) - len(line.lstrip())]
                        new_lines.append(indent + "if: steps.check.outputs.skip != 'true'")
                    new_lines.append(line)
                else:
                    new_lines.append(line)
                    
            if is_publish:
                publish_text = '\n'.join(new_lines)
                
                # Replace :latest
                publish_text = re.sub(
                    r'IMAGE_LOWER=\$\(echo "(.*?):latest" \| tr(.*?)\)',
                    r'IMAGE_LOWER=$(echo "\1" | tr\2)',
                    publish_text
                )
                
                # Replace commit and push
                publish_text = re.sub(
                    r' +buildah commit \$ctr \$IMAGE_LOWER\n +buildah push \$IMAGE_LOWER',
                    f"""          buildah commit $ctr $IMAGE_LOWER:latest
          buildah tag $IMAGE_LOWER:latest $IMAGE_LOWER:${{{{ steps.hash.outputs.hash }}}}
          buildah push $IMAGE_LOWER:latest
          buildah push $IMAGE_LOWER:${{{{ steps.hash.outputs.hash }}}}""",
                    publish_text
                )
                
                new_steps.append(publish_text)
            else:
                new_steps.append('\n'.join(new_lines))
                
        # Join steps
        joined = "\n".join(new_steps)
        # Fix the first step if it got "      - " doubled
        joined = joined.replace('      -       - ', '      - ')
        out_parts.append(job_header + "    steps:\n" + joined)
        
    with open(file_path, 'w') as f:
        f.write(''.join(out_parts))

if __name__ == '__main__':
    process_workflow('.github/workflows/ermete-forge-orchestrator.yml')
