"""Extract info.json and melody stems (vocals, violin) from Sanidha tar.gz (streaming)."""

from __future__ import annotations

import argparse
import sys
import tarfile
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_OUT = _ROOT / "data" / "sanidha"

_EXTRACT_SUFFIXES = ("/info.json", "/vocals.wav", "/violin.wav")


def _want(member: tarfile.TarInfo) -> bool:
    name = member.name.replace("\\", "/")
    return name.endswith(_EXTRACT_SUFFIXES)


def extract_partial(archive: Path, out_dir: Path) -> tuple[int, int]:
    ok = 0
    skip = 0
    out_dir.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "r:gz") as tf:
        while True:
            try:
                member = tf.next()
            except StopIteration:
                break
            except (tarfile.TarError, EOFError, OSError) as e:
                print("Archive ended early:", e, file=sys.stderr)
                break
            if member is None:
                break
            if not _want(member):
                continue
            try:
                tf.extract(member, path=out_dir, filter="data")
                ok += 1
                print("OK", member.name)
            except (tarfile.TarError, OSError, EOFError) as e:
                skip += 1
                print("SKIP", member.name, e, file=sys.stderr)
    return ok, skip


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("archives", nargs="+", type=Path)
    p.add_argument("--out-dir", type=Path, default=_DEFAULT_OUT)
    args = p.parse_args()
    total_ok = 0
    for arch in args.archives:
        if not arch.is_file():
            print("Missing:", arch, file=sys.stderr)
            continue
        print("===", arch.name, "===")
        ok, skip = extract_partial(arch.resolve(), args.out_dir.resolve())
        total_ok += ok
        print(f"  extracted {ok}, skipped {skip}")
    if total_ok == 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
