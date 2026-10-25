#!/usr/bin/env python3
"""
build.py - Builds the SPA artifact into docs/ for GitHub Pages deployment.
Injects current date + git commit hash as the application version in the footer.
Zero external dependencies (uses standard Python library).
"""
import datetime
import os
import re
import shutil
import subprocess
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


def get_version_string():
    """Generates version formatted as vYYYY.MM.DD (commit_hash)."""
    date_str = datetime.datetime.now().strftime("%Y.%m.%d")
    git_hash = "unknown"
    try:
        git_hash = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=BASE_DIR,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception:
        pass
    return f"v{date_str} ({git_hash})"


def inject_version(file_path, version_str):
    """Replaces or injects the version string inside <span id="app-version">...</span>."""
    if not os.path.exists(file_path):
        return
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = re.sub(
        r'<span id="app-version">.*?</span>',
        f'<span id="app-version">{version_str}</span>',
        content,
    )

    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)


def build():
    print(f"🚀 Building SPA artifact to docs/ for GitHub Pages...")
    if not os.path.isdir(STATIC_DIR):
        print(f"❌ Source directory not found: {STATIC_DIR}", file=sys.stderr)
        sys.exit(1)

    version_str = get_version_string()
    print(f"🔖 Version: {version_str}")

    # Ensure source index.html has the updated version
    inject_version(os.path.join(STATIC_DIR, "index.html"), version_str)

    os.makedirs(DOCS_DIR, exist_ok=True)

    # Copy all files and subdirectories from static/ to docs/
    print(f"📁 Copying static assets from {STATIC_DIR} to {DOCS_DIR}...")
    shutil.copytree(STATIC_DIR, DOCS_DIR, dirs_exist_ok=True)

    # Inject version into docs/index.html as well
    inject_version(os.path.join(DOCS_DIR, "index.html"), version_str)

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
    print(f"   - Version displayed: {version_str}")
    print(f"   - Bypass Jekyll: {nojekyll_path}")


if __name__ == "__main__":
    build()
