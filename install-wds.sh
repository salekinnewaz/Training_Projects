#!/usr/bin/env bash
# Whiteport Design Studio (WDS) installer — generated from official install.md
# Version: 1.0.0  |  Released: 2026-04-26
# Repo: https://github.com/whiteport-collective/whiteport-design-studio
#
# Run this in Terminal:
#   bash install-wds.sh

set -euo pipefail

home="$HOME"
echo "==> Home directory: $home"

# ── Step 2: Check for existing installation ───────────────────────────────
if [ -d "$home/.claude/wds" ]; then
  echo "==> Existing WDS installation found at $home/.claude/wds"
  if [ -f "$home/.claude/wds/install.md" ]; then
    existing_version=$(head -20 "$home/.claude/wds/install.md" | grep -E '^wds-version:' | head -1 | sed 's/.*"\(.*\)".*/\1/' || echo "unknown")
    echo "    Existing version: $existing_version"
    read -p "    Remove existing install and reinstall? (yes/no): " ans
    if [ "$ans" = "yes" ]; then
      rm -rf "$home/.claude/wds"
      # Clean old WDS command files
      for cmd in saga freya mimir sync; do
        rm -f "$home/.claude/commands/$cmd.md"
      done
      echo "    Removed old installation."
    else
      echo "    Aborted. Manually remove $home/.claude/wds and re-run."
      exit 1
    fi
  else
    echo "    Found an older WDS install that is not version-managed."
    read -p "    Remove it and continue? (yes/no): " ans
    if [ "$ans" = "yes" ]; then
      rm -rf "$home/.claude/wds"
      for cmd in saga freya mimir sync; do
        rm -f "$home/.claude/commands/$cmd.md"
      done
    else
      echo "    Aborted."
      exit 1
    fi
  fi
fi

# ── Step 3: Prepare and install ──────────────────────────────────────────
echo "==> Creating $home/.claude/ and $home/.claude/commands/"
mkdir -p "$home/.claude/commands"

echo "==> Cloning WDS repo to $home/.claude/wds/"
git clone https://github.com/whiteport-collective/whiteport-design-studio.git "$home/.claude/wds/"

# ── Step 4: Pull latest ──────────────────────────────────────────────────
echo "==> Pulling latest"
cd "$home/.claude/wds" && git pull

# ── Step 5: Confirm installed version ────────────────────────────────────
installed_version=$(head -20 "$home/.claude/wds/install.md" | grep -E '^wds-version:' | head -1 | sed 's/.*"\(.*\)".*/\1/' || echo "unknown")
echo "==> Installed WDS version: $installed_version"

# ── Step 6: Write wds-config.yaml ────────────────────────────────────────
if [ ! -f "$home/.claude/wds-config.yaml" ]; then
  echo "==> Writing $home/.claude/wds-config.yaml"
  cat > "$home/.claude/wds-config.yaml" <<'YAML'
sync-source: https://github.com/whiteport-collective/whiteport-design-studio
branch: main
YAML
else
  echo "==> Leaving existing $home/.claude/wds-config.yaml unchanged"
fi

# ── Step 7: Write command files ─────────────────────────────────────────
echo "==> Writing command files to $home/.claude/commands/"

cat > "$home/.claude/commands/saga.md" <<'CMD'
# Saga — WDS Strategic Analyst
WDS base: /Users/bs00902/.claude/wds/src/skills/saga
Read the file at /Users/bs00902/.claude/wds/src/skills/saga/SKILL.md and follow the instructions exactly. Resolve all relative file references (workflows/, agents/, references/) against the WDS base path above.
CMD

cat > "$home/.claude/commands/freya.md" <<'CMD'
# Freya — WDS UX Designer
WDS base: /Users/bs00902/.claude/wds/src/skills/freya
Read the file at /Users/bs00902/.claude/wds/src/skills/freya/SKILL.md and follow the instructions exactly. Resolve all relative file references (workflows/, agents/, references/) against the WDS base path above.
CMD

cat > "$home/.claude/commands/mimir.md" <<'CMD'
# Mimir — WDS Implementation Agent
WDS base: /Users/bs00902/.claude/wds/src/skills/mimir
Read the file at /Users/bs00902/.claude/wds/src/skills/mimir/SKILL.md and follow the instructions exactly. Resolve all relative file references (workflows/, agents/, references/) against the WDS base path above.
CMD

cat > "$home/.claude/commands/sync.md" <<'CMD'
# WDS Sync
WDS base: /Users/bs00902/.claude/wds
Read the file at /Users/bs00902/.claude/wds/src/tools/sync/SKILL.md and follow the instructions exactly.
CMD

# ── Step 8: Verify ───────────────────────────────────────────────────────
echo "==> Verifying installation"
[ -d "$home/.claude/wds" ] && echo "    [OK] $home/.claude/wds/"
[ -f "$home/.claude/wds/install.md" ] && echo "    [OK] $home/.claude/wds/install.md"
[ -f "$home/.claude/wds-config.yaml" ] && echo "    [OK] $home/.claude/wds-config.yaml"
for cmd in saga freya mimir sync; do
  [ -f "$home/.claude/commands/$cmd.md" ] && echo "    [OK] $home/.claude/commands/$cmd.md"
done

cat <<EOF

🎯 Whiteport Design Studio installed
  Version: $installed_version
  Location: $home/.claude/wds/
  Sync source: https://github.com/whiteport-collective/whiteport-design-studio
  Commands: /saga  /freya  /mimir  /sync
EOF
