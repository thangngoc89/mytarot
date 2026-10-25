#!/usr/bin/env python3
"""
build.py - Builds the SPA artifact into docs/ for GitHub Pages deployment.
Zero external dependencies (uses standard Python library).
"""
import os
import shutil
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DOCS_DIR = os.path.join(BASE_DIR, "docs")

REQUIRED_FILES = [
    "index.html",
    os.path.join("css", "metallic_winter.css"),
    os.path.join("js", "app.js"),
    os.path.join("data", "tarot_dataset.js"),
    os.path.join("images", "card_back.jpg"),
]


def build():
    print(f"🚀 Building SPA artifact to docs/ for GitHub Pages...")
    if not os.path.isdir(STATIC_DIR):
        print(f"❌ Source directory not found: {STATIC_DIR}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(DOCS_DIR, exist_ok=True)

    # Copy all files and subdirectories from static/ to docs/
    print(f"📁 Copying static assets from {STATIC_DIR} to {DOCS_DIR}...")
    shutil.copytree(STATIC_DIR, DOCS_DIR, dirs_exist_ok=True)

    # Ensure .nojekyll exists so GitHub Pages does not run Jekyll
    nojekyll_path = os.path.join(DOCS_DIR, ".nojekyll")
    if not os.path.exists(nojekyll_path):
        with open(nojekyll_path, "w", encoding="utf-8") as f:
            f.write("")
        print(f"📄 Created .nojekyll in {DOCS_DIR}")

    # Validate essential files
    for rel_path in REQUIRED_FILES:
        full_path = os.path.join(DOCS_DIR, rel_path)
        if not os.path.exists(full_path):
            print(f"⚠️ Warning: Expected file missing: {full_path}", file=sys.stderr)

    print(f"✅ Build complete! All assets successfully copied to: {DOCS_DIR}")
    print(f"   - Entry point: {os.path.join(DOCS_DIR, 'index.html')}")
    print(f"   - Bypass Jekyll: {nojekyll_path}")


if __name__ == "__main__":
    build()
