#!/usr/bin/env python3
"""Compatibility entry point. The maintained browser suite is verify_app.cjs."""
import pathlib
import subprocess
import sys

if __name__ == "__main__":
    sys.exit(subprocess.call(["node", str(pathlib.Path(__file__).with_suffix(".cjs"))]))
