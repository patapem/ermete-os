#!/usr/bin/env python3
"""
The Holy Grail of Kernel Patching (Universal Compatibility Matrix)
Implementation of the AST Surgical Validation and Hybrid Pipeline for Ermete OS.
"""

import os
import subprocess
import logging
import argparse
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

@dataclass
class PatchConfig:
    name: str
    path: Path
    priority: int

class ASTValidator:
    """Handles the surgical AST validation of C files modified by a patch."""
    def __init__(self, kernel_dir: Path):
        self.kernel_dir = kernel_dir
    
    def extract_modified_c_files(self, patch_path: Path) -> List[Path]:
        """Extracts the list of C files modified by the patch."""
        c_files = []
        try:
            # Parse the patch file to find modified files
            result = subprocess.run(['grep', '^+++', str(patch_path)], capture_output=True, text=True)
            for line in result.stdout.splitlines():
                # example line: +++ b/kernel/sched/core.c
                parts = line.split()
                if len(parts) >= 2:
                    file_path = parts[1]
                    # Strip 'b/' prefix if present
                    if file_path.startswith('b/'):
                        file_path = file_path[2:]
                    # Only care about C files for AST validation
                    if file_path.endswith('.c'):
                        c_files.append(self.kernel_dir / file_path)
        except Exception as e:
            logging.error(f"Error parsing patch {patch_path} for C files: {e}")
        return c_files

    def extract_cflags(self, c_file: Path) -> List[str]:
        """
        Extracts compilation flags dynamically from kernel Makefiles for a specific file.
        In a full implementation, this could use `make path/to/file.i` in dry-run,
        or parse compile_commands.json from a tool like `bear`.
        """
        # Mock basic include flags for the architecture script.
        # In reality, this needs to extract dynamic flags (e.g. from .<file>.o.cmd)
        return ['-I./include', '-I./arch/x86/include', '-nostdinc']
        
    def validate(self, patch_path: Path) -> bool:
        """
        Validates the patch by checking the AST purity of modified files.
        Returns True if successful, False if syntax is broken.
        """
        c_files = self.extract_modified_c_files(patch_path)
        if not c_files:
            logging.info(f"No C files modified by {patch_path.name}, AST validation passed implicitly.")
            return True
            
        for c_file in c_files:
            if not c_file.exists():
                logging.warning(f"File {c_file} does not exist in kernel tree for AST validation, skipping.")
                continue
                
            flags = self.extract_cflags(c_file)
            cmd = ['clang', '-fsyntax-only'] + flags + [str(c_file)]
            logging.debug(f"Running AST validation: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, cwd=self.kernel_dir, capture_output=True, text=True)
            if result.returncode != 0:
                logging.error(f"AST validation failed for {c_file}:\n{result.stderr}")
                return False
                
        return True

class PatchOrchestrator:
    """Orchestrates the priority cascading, dry-runs, application, and rollbacks."""
    def __init__(self, kernel_dir: Path):
        self.kernel_dir = kernel_dir
        self.ast_validator = ASTValidator(kernel_dir)
        
    def apply_patch_dry_run(self, patch_path: Path, fuzz: int) -> bool:
        cmd = ['patch', '-p1', '--dry-run', f'--fuzz={fuzz}', '-i', str(patch_path)]
        logging.info(f"Testing patch {patch_path.name} with fuzz={fuzz} (Dry-Run)")
        result = subprocess.run(cmd, cwd=self.kernel_dir, capture_output=True, text=True)
        return result.returncode == 0

    def apply_patch(self, patch_path: Path, fuzz: int) -> bool:
        cmd = ['patch', '-p1', f'--fuzz={fuzz}', '-i', str(patch_path)]
        result = subprocess.run(cmd, cwd=self.kernel_dir, capture_output=True, text=True)
        return result.returncode == 0
        
    def rollback_patch(self, patch_path: Path) -> bool:
        logging.warning(f"Rolling back patch {patch_path.name} to preserve domain integrity.")
        cmd = ['patch', '-p1', '-R', '-i', str(patch_path)]
        result = subprocess.run(cmd, cwd=self.kernel_dir, capture_output=True, text=True)
        return result.returncode == 0

    def process_patch(self, patch: PatchConfig) -> bool:
        logging.info(f"--- Processando patch: {patch.name} [Priority: {patch.priority}] ---")
        
        # Step 2: Dry-run fallback logic (Fuzz 0 -> Fuzz 3)
        fuzz_level = None
        if self.apply_patch_dry_run(patch.path, fuzz=0):
            fuzz_level = 0
        elif self.apply_patch_dry_run(patch.path, fuzz=3):
            fuzz_level = 3
            
        if fuzz_level is None:
            logging.error(f"Patch {patch.name} failed dry-run at fuzz 0 and 3. Conflict detected. Skipping.")
            return False
            
        # Step 3: Apply the patch
        logging.info(f"Applying patch {patch.name} with fuzz={fuzz_level}")
        if not self.apply_patch(patch.path, fuzz=fuzz_level):
            logging.error(f"Failed to apply patch {patch.name} despite dry-run success. Forcing skip.")
            return False
            
        # Step 4: Surgical AST Validation
        logging.info(f"Validating AST purity for patch {patch.name}")
        if not self.ast_validator.validate(patch.path):
            logging.error(f"AST validation broken by patch {patch.name}. Initiating rollback.")
            self.rollback_patch(patch.path)
            return False
            
        logging.info(f"Success! Patch {patch.name} successfully integrated into the Chimera Kernel.")
        return True

def get_universal_matrix(patches_dir: Path) -> List[PatchConfig]:
    """
    Defines the cascaded priority for the kernel patches.
    Lower priority number = applied first.
    """
    return [
        PatchConfig(name="linux-tkg (Agnosticità base)", path=patches_dir / "linux-tkg.patch", priority=10),
        PatchConfig(name="CachyOS (BORE Scheduler)", path=patches_dir / "cachyos-bore.patch", priority=20),
        PatchConfig(name="XanMod (Ottimizzazione Rete)", path=patches_dir / "xanmod-net.patch", priority=30),
        PatchConfig(name="Liquorix (Multimedia/Zen)", path=patches_dir / "liquorix.patch", priority=40),
        PatchConfig(name="Clear Linux (Performance Pura)", path=patches_dir / "clearlinux.patch", priority=50),
        PatchConfig(name="Gentoo (Patch Set)", path=patches_dir / "gentoo.patch", priority=60),
    ]

def main():
    parser = argparse.ArgumentParser(description="Ermete Forge - Universal Compatibility Matrix for Kernel Patching")
    parser.add_argument('--kernel-dir', type=Path, default=Path("./linux"), help="Path to the kernel source directory")
    parser.add_argument('--patches-dir', type=Path, default=Path("./patches"), help="Path to the directory containing patch files")
    args = parser.parse_args()

    if not args.kernel_dir.exists():
        logging.warning(f"Kernel directory {args.kernel_dir} not found. Running orchestrator simulation.")
        
    # 1. Cascata di Priorità
    patches = get_universal_matrix(args.patches_dir)
    
    # Sort by priority to ensure strict domain cascading
    patches.sort(key=lambda p: p.priority)
    
    orchestrator = PatchOrchestrator(args.kernel_dir)
    
    for patch in patches:
        if not patch.path.exists():
            logging.warning(f"Patch file missing: {patch.path}. Skipping.")
            continue
            
        orchestrator.process_patch(patch)
        logging.info("-" * 60)
        
if __name__ == "__main__":
    main()
