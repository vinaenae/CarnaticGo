"""Deprecated: sam-carnatic / sarayusapa clips replaced by Sanidha.

Use: python services/raga-classifier/scripts/export_sanidha_guess_samples.py
"""

from __future__ import annotations

import sys


def main() -> int:
    print(
        "This script is deprecated.\n"
        "Use: python services/raga-classifier/scripts/export_sanidha_guess_samples.py\n"
        "See data/sanidha/README.md",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
