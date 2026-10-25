#!/usr/bin/env python3
"""
deploy.py - Builds the SPA artifact to docs/, commits changes, and pushes to GitHub.
Zero external dependencies (uses standard Python library).
"""
import datetime
import os
import subprocess
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_cmd(cmd, check=True):
    return subprocess.run(cmd, cwd=BASE_DIR, shell=isinstance(cmd, str), check=check)


def get_cmd_output(cmd):
    result = subprocess.run(cmd, cwd=BASE_DIR, shell=isinstance(cmd, str), capture_output=True, text=True)
    return result.stdout.strip()


def deploy():
    print("🔮 Starting single-command build & deploy pipeline...")

    # Step 1: Run build
    build_script = os.path.join(BASE_DIR, "scripts", "build.py")
    res = subprocess.run([sys.executable, build_script], cwd=BASE_DIR)
    if res.returncode != 0:
        print("❌ Build step failed. Aborting deployment.", file=sys.stderr)
        sys.exit(res.returncode)

    # Step 2: Stage source, docs/ and related deployment files
    print("\n📦 Staging static/, docs/ and deploy scripts in git...")
    files_to_stage = ["static", "docs", ".gitignore", ".nojekyll", "scripts/build.py", "scripts/deploy.py", "deploy.py", "AGENTS.md"]
    existing_files = [f for f in files_to_stage if os.path.exists(os.path.join(BASE_DIR, f))]
    run_cmd(["git", "add"] + existing_files)

    # Step 3: Check if there are changes to commit
    diff_res = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=BASE_DIR)
    has_changes = (diff_res.returncode != 0)

    if has_changes:
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        commit_msg = f"Deploy to docs for GitHub Pages ({now_str})"
        print(f"📝 Committing changes: \"{commit_msg}\"...")
        run_cmd(["git", "commit", "-m", commit_msg])
    else:
        print("ℹ️ No changes detected in docs/. Working tree clean.")

    # Step 4: Determine current branch and push
    current_branch = get_cmd_output(["git", "branch", "--show-current"]) or "master"
    print(f"\n🚀 Pushing to origin/{current_branch}...")
    try:
        run_cmd(["git", "push", "origin", current_branch])
        print("\n🎉 Deployment completed successfully!")
        print("🌐 GitHub Pages will serve from /docs on branch:", current_branch)
        print("👉 URL: https://thangngoc89.github.io/mytarot/\n")
    except subprocess.CalledProcessError:
        print("\n⚠️ Note: 'git push' failed (e.g., SSH key auth or remote permission).", file=sys.stderr)
        print(f"   Once authenticated, push manually using:\n   git push origin {current_branch}\n", file=sys.stderr)


if __name__ == "__main__":
    deploy()
