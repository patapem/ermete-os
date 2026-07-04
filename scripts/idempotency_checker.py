#!/usr/bin/env python3

import argparse
import hashlib
import os
import subprocess
import sys
from pathlib import Path

def hash_directory(directory: Path) -> str:
    """
    Calculates a deterministic SHA-256 hash of a directory's contents.
    Includes both the relative paths of files and their contents.
    """
    hasher = hashlib.sha256()
    files = []
    
    for root, _, filenames in os.walk(directory):
        for filename in filenames:
            files.append(Path(root) / filename)
            
    # Sort files to ensure deterministic hashing order
    files.sort()
    
    for file_path in files:
        # Hash the relative file path to detect renames
        rel_path = file_path.relative_to(directory).as_posix()
        hasher.update(rel_path.encode('utf-8'))
        
        # Hash the file content
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                hasher.update(chunk)
                
    return hasher.hexdigest()

def hash_upstream(orchestrator_path: Path, package_name: str) -> str:
    """
    Calculates a deterministic hash for upstream packages that lack specs.
    Hashes the package name and a cache seed, ignoring the orchestrator YAML.
    """
    hasher = hashlib.sha256()
    
    # Hash the package name
    hasher.update(package_name.encode('utf-8'))
    
    # Hash a static cache seed (bump this to force rebuild all upstream packages)
    cache_seed = "upstream-cache-v1"
    hasher.update(cache_seed.encode('utf-8'))
    
    return hasher.hexdigest()

def main():
    parser = argparse.ArgumentParser(description="Idempotency checker for Ermete Forge")
    parser.add_argument("--package", required=True, help="Package name (e.g. ags-config)")
    parser.add_argument("--registry", required=True, help="Container registry (e.g., ghcr.io)")
    parser.add_argument("--owner", required=True, help="Repository owner")
    parser.add_argument("--image-name", required=False, help="Explicit image name (e.g., ermete-builder)")
    
    args = parser.parse_args()
    
    # Establish paths relative to this script
    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent
    
    spec_dir = repo_root / "specs" / f"ermete-{args.package}"
    orchestrator_yml = repo_root / ".github" / "workflows" / "ermete-forge-orchestrator.yml"
    
    # Determine the hash based on package type
    if args.package == "builder":
        builder_dir = repo_root / "builder"
        content_hash = hash_directory(builder_dir)
    elif spec_dir.is_dir():
        content_hash = hash_directory(spec_dir)
    else:
        content_hash = hash_upstream(orchestrator_yml, args.package)
        
    # Check if this exact hash already exists in GHCR
    img_name = args.image_name if args.image_name else f"ermete-forge-{args.package}"
    image_url = f"docker://{args.registry}/{args.owner}/{img_name}:{content_hash}"
    cache_hit = "false"
    
    try:
        subprocess.run(
            ["skopeo", "inspect", image_url],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        cache_hit = "true"
    except subprocess.CalledProcessError:
        # The image does not exist, or permission denied
        cache_hit = "false"
    except FileNotFoundError:
        # Skopeo is not installed/found in PATH
        cache_hit = "false"
        print(f"Warning: skopeo not found in PATH. Assuming cache miss.", file=sys.stderr)
        
    # Output bash-compatible variables
    print(f"CACHE_HIT={cache_hit}")
    print(f"CONTENT_HASH={content_hash}")

if __name__ == "__main__":
    main()
