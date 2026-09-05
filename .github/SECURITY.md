# Security Policy

Athanor OS treats security as its highest priority. The system is designed around Zero-Trust enclaves and Post-Quantum Cryptography.

## Supported Versions
| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a vulnerability in Athanor OS (e.g., in `athanor-ebpf-sched`, `athanor-mesh-bus`, or `athanor-hypervisor-daemon`), **DO NOT** open a public issue.

Instead, please email **security@athanor.org** with a detailed description and steps to reproduce. Our Security Response Team (SRT) will acknowledge your report within 24 hours.

### Bug Bounty
We offer bug bounties for verified remote code execution (RCE) or hypervisor escape vulnerabilities that bypass our KVM/SEV-SNP enclaves.
