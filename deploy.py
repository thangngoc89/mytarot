#!/usr/bin/env python3
"""Convenience root entry point for scripts/deploy.py."""
import os
import sys

scripts_deploy = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scripts", "deploy.py")
if __name__ == "__main__":
    import runpy
    runpy.run_path(scripts_deploy, run_name="__main__")
