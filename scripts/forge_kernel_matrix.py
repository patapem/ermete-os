#!/usr/bin/env python3
import argparse
import sys

def parse_args(args=None):
    parser = argparse.ArgumentParser(description="Universal Kernel Patch Matrix")
    parser.add_argument('--patch-dir', required=True, help="Directory containing patch files")
    parser.add_argument('--kernel-src', required=True, help="Kernel source directory")
    return parser.parse_args(args)

if __name__ == '__main__':
    args = parse_args()
