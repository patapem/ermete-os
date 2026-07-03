#!/usr/bin/env python3
import argparse
import sys
import os
import subprocess

def parse_args(args=None):
    parser = argparse.ArgumentParser(description="Universal Kernel Patch Matrix")
    parser.add_argument('--patch-dir', required=True, help="Directory containing patch files")
    parser.add_argument('--kernel-src', required=True, help="Kernel source directory")
    return parser.parse_args(args)

def dry_run_patch(patch_path, src_dir):
    patch_path = os.path.abspath(patch_path)
    result = subprocess.run(
        ["patch", "-p1", "--dry-run", "-i", patch_path],
        cwd=src_dir,
        capture_output=True
    )
    stdout = result.stdout.decode('utf-8', errors='ignore')
    success = (result.returncode == 0)
    needs_ast = "fuzz" in stdout.lower() or "offset" in stdout.lower()
    
    files = []
    for line in stdout.splitlines():
        if line.startswith("patching file "):
            files.append(line.replace("patching file ", "").strip())
            
    return success, needs_ast, files

if __name__ == '__main__':
    args = parse_args()
