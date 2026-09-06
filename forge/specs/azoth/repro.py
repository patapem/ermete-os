#!/usr/bin/env python3
"""Reproducibility comparison between two builds of the same pin (spec, section 3 step 8
and section 7 gate 6): A is the published kernel, B the rebuild of the weekly job.

    repro.py --a DIR --b DIR --out DIR

DIR holds the kernel RPMs (kernel-core, kernel-modules*) and, for B, kernel-devel: that
is where scripts/extract-vmlinux comes from. It compares `config` (byte for byte),
`System.map`, `vmlinuz` (byte for byte, then the extracted vmlinux section by section,
offset and size from llvm-readelf) and every module without its appended signature. The
key that signs modules and image is born and dies within each build (CONFIG_MODULE_SIG
with a generated key), so the signature of the .ko files and the certificate inside
vmlinux (.init.data) are expected differences: nothing else is. Writes OUT/summary.md
and OUT/results.json; exits 1 on an unexpected difference.
"""

import argparse
import gzip
import hashlib
import lzma
import json
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

SIG_MARKER = b"~Module signature appended~\n"
# Sections of vmlinux where the ephemeral key leaves a trace: the certificate in
# system_certificate_list (.init.data) and the build-id, which depends on it (.notes).
EXPECTED_SECTIONS = {".init.data", ".notes"}


def run(*cmd, **kw):
    done = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if done.returncode != 0:
        sys.exit(f"{cmd[0]}: {done.stderr.strip()}")
    return done.stdout


def extract(rpms, dest, patterns):
    """rpm2cpio | cpio of only the paths needed, from every RPM that has them."""
    dest.mkdir(parents=True, exist_ok=True)
    for rpm in rpms:
        with subprocess.Popen(["rpm2cpio", str(rpm)], stdout=subprocess.PIPE) as p:
            subprocess.run(
                ["cpio", "-idm", "--quiet", *patterns],
                stdin=p.stdout,
                cwd=dest,
                check=True,
            )


def sha(data):
    return hashlib.sha256(data).hexdigest()


def module_payload(data):
    """The module without its signature: [payload][signer][key id][signature][struct 12][marker]."""
    if not data.endswith(SIG_MARKER):
        return data
    info = data[-len(SIG_MARKER) - 12 : -len(SIG_MARKER)]
    _algo, _hash, _id_type, signer_len, key_id_len, _p1, _p2, _p3, sig_len = (
        struct.unpack(">8BI", info)
    )
    return data[: len(data) - len(SIG_MARKER) - 12 - sig_len - signer_len - key_id_len]


def module_bytes(path):
    """The decompressed module (Fedora ships .ko.xz: the signature is inside the stream)."""
    data = path.read_bytes()
    if path.suffix == ".xz":
        return lzma.decompress(data)
    if path.suffix == ".gz":
        return gzip.decompress(data)
    if path.suffix == ".zst":
        sys.exit(f"{path.name}: .zst modules, decompressor missing")
    return data


def modules(tree):
    return {
        p.relative_to(tree).as_posix(): sha(module_payload(module_bytes(p)))
        for p in tree.rglob("*.ko*")
    }


def sections(vmlinux):
    """{section: sha256 of the content}: offset and size from llvm-readelf, bytes from the file."""
    data = vmlinux.read_bytes()
    (elf,) = json.loads(
        run("llvm-readelf", "-S", "--elf-output-style=JSON", str(vmlinux))
    )
    out = {}
    for entry in elf["Sections"]:
        section = entry["Section"]
        name, kind = section["Name"]["Name"], section["Type"]["Name"]
        if not name or kind in ("SHT_NULL", "SHT_NOBITS"):
            continue
        out[name] = sha(data[section["Offset"] : section["Offset"] + section["Size"]])
    return out


def kver(tree):
    (mods,) = [p for p in (tree / "lib/modules").iterdir()]
    return mods.name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True, type=Path)
    ap.add_argument("--b", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp())
    trees = {}
    for label, src in (("a", args.a), ("b", args.b)):
        rpms = sorted(src.rglob("kernel-core-*.rpm")) + sorted(
            src.rglob("kernel-modules*.rpm")
        )
        if not any(r.name.startswith("kernel-core-") for r in rpms):
            sys.exit(f"{src}: kernel-core-*.rpm missing")
        tree = work / label
        extract(rpms, tree, ["./lib/modules/*"])
        trees[label] = tree
    devel = sorted(args.b.rglob("kernel-devel-[0-9]*.rpm"))
    if not devel:
        sys.exit(
            f"{args.b}: kernel-devel-*.rpm missing (scripts/extract-vmlinux is needed)"
        )
    extract(devel, work / "devel", ["./usr/src/kernels/*/scripts/extract-vmlinux"])
    (extract_vmlinux,) = list((work / "devel").rglob("extract-vmlinux"))
    extract_vmlinux.chmod(0o755)

    ka, kb = kver(trees["a"]), kver(trees["b"])
    results = {
        "kver": {"a": ka, "b": kb},
        "files": {},
        "vmlinux_sections": {},
        "modules": {},
    }
    findings = []
    if ka != kb:
        findings.append(f"different versions: {ka} and {kb}")
    for name in ("config", "System.map", "vmlinuz"):
        da = (trees["a"] / "lib/modules" / ka / name).read_bytes()
        db = (trees["b"] / "lib/modules" / kb / name).read_bytes()
        results["files"][name] = da == db
        if da != db and name != "vmlinuz":
            findings.append(f"{name} differs")
    # vmlinuz differs by construction (certificate): what matters is what differs inside.
    for label in ("a", "b"):
        vmlinux = work / f"vmlinux-{label}"
        with vmlinux.open("wb") as f:
            subprocess.run(
                [
                    str(extract_vmlinux),
                    str(
                        trees[label]
                        / "lib/modules"
                        / (ka if label == "a" else kb)
                        / "vmlinuz"
                    ),
                ],
                stdout=f,
                check=True,
            )
    sa, sb = (
        sections(work / "vmlinux-a"),
        sections(work / "vmlinux-b"),
    )
    differing = sorted(s for s in set(sa) | set(sb) if sa.get(s) != sb.get(s))
    results["vmlinux_sections"] = {
        "total": len(set(sa) | set(sb)),
        "differing": differing,
    }
    unexpected = [s for s in differing if s not in EXPECTED_SECTIONS]
    if unexpected:
        findings.append(
            f"vmlinux sections differing beyond the expected ones: {' '.join(unexpected)}"
        )
    ma, mb = modules(trees["a"]), modules(trees["b"])
    only_a, only_b = sorted(set(ma) - set(mb)), sorted(set(mb) - set(ma))
    diff_mods = sorted(m for m in set(ma) & set(mb) if ma[m] != mb[m])
    results["modules"] = {
        "total": len(set(ma) | set(mb)),
        "only_a": only_a,
        "only_b": only_b,
        "differing": diff_mods,
    }
    if only_a or only_b:
        findings.append(
            f"modules present in one build only: {len(only_a)} only in A, {len(only_b)} only in B"
        )
    # For the first differing modules, which sections differ: tells different code from
    # symbols, relocations or build-id only.
    mod_sections = {}
    for name in diff_mods[:3]:
        hashes = {}
        for label in ("a", "b"):
            ko = work / f"mod-{label}-{len(mod_sections)}.ko"
            ko.write_bytes(module_payload(module_bytes(trees[label] / name)))
            hashes[label] = sections(ko)
        mod_sections[name] = sorted(
            s
            for s in set(hashes["a"]) | set(hashes["b"])
            if hashes["a"].get(s) != hashes["b"].get(s)
        )
    results["modules"]["sections"] = mod_sections
    if diff_mods:
        findings.append(
            f"{len(diff_mods)} modules with different content (signature excluded)"
        )
    results["findings"] = findings
    (args.out / "results.json").write_text(json.dumps(results, indent=2) + "\n")

    ok = "identical" if not findings else "DIFFERENT"
    lines = [
        f"## Reproducibility {ka}: {ok}",
        "",
        "| object | result |",
        "| --- | --- |",
    ]
    for name, same in results["files"].items():
        lines.append(f"| `{name}` | {'identical' if same else 'different'} |")
    lines.append(
        f"| vmlinux, {results['vmlinux_sections']['total']} sections | {len(differing)} differing: {' '.join(differing) or 'none'} |"
    )
    lines.append(
        f"| modules, {results['modules']['total']} | {len(diff_mods)} differing without signature, {len(only_a) + len(only_b)} present in one build only |"
    )
    if findings:
        lines += ["", "Unexpected differences (a bug to open):", ""] + [
            f"- {f}" for f in findings
        ]
        if diff_mods:
            lines += ["", "| module | differing sections |", "| --- | --- |"] + [
                f"| `{name.rsplit('/', 1)[-1]}` | {' '.join(secs) or 'none'} |"
                for name, secs in mod_sections.items()
            ]
            lines += (
                ["", "<details><summary>differing modules</summary>", "", "```"]
                + diff_mods[:200]
                + ["```", "</details>"]
            )
    else:
        lines += [
            "",
            "The only differences lie where the ephemeral signing key leaves a trace (module signatures, certificate in vmlinux).",
        ]
    (args.out / "summary.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    sys.exit(1 if findings else 0)


if __name__ == "__main__":
    main()
