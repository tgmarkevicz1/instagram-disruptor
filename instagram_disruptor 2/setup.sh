#!/usr/bin/env bash
# =============================================================================
# Instagram Disruptor – Automated Setup Script
# Compatible with: macOS, Linux (Debian/Ubuntu/Arch), Windows (Git Bash / WSL)
# =============================================================================

set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

info()    { echo -e "${BOLD}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}   $*"; }
error()   { echo -e "${RED}[ERROR]${RESET}  $*" >&2; }

# ---------------------------------------------------------------------------
# 0. Detect OS
# ---------------------------------------------------------------------------
OS="unknown"
case "$(uname -s 2>/dev/null || echo "Windows")" in
  Darwin*)  OS="mac"   ;;
  Linux*)   OS="linux" ;;
  MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
  *)
    # Running under Windows CMD / PowerShell without a unix layer
    if [[ "${OS:-}" == "Windows_NT" ]]; then OS="windows"; fi
    ;;
esac

info "Detected OS: $OS"

# ---------------------------------------------------------------------------
# 1. Check Node.js ≥ 16
# ---------------------------------------------------------------------------
info "Checking Node.js…"
if ! command -v node &>/dev/null; then
  error "Node.js is not installed."
  echo ""
  echo "  macOS  : brew install node"
  echo "  Ubuntu : sudo apt install nodejs npm"
  echo "  Windows: https://nodejs.org/en/download"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR="${NODE_VER%%.*}"
if (( NODE_MAJOR < 16 )); then
  error "Node.js ≥ 16 required (found $NODE_VER). Please upgrade."
  exit 1
fi
success "Node.js $NODE_VER"

# ---------------------------------------------------------------------------
# 2. Locate project root (directory containing this script)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
info "Project root: $SCRIPT_DIR"

# ---------------------------------------------------------------------------
# 3. Install npm deps (none declared yet, but future-proofs the project)
# ---------------------------------------------------------------------------
if [[ -f "$SCRIPT_DIR/package.json" ]]; then
  info "Installing npm dependencies…"
  (cd "$SCRIPT_DIR" && npm install --silent)
  success "npm install done"
else
  # Create a minimal package.json so `npm start` works
  cat > "$SCRIPT_DIR/package.json" <<'JSON'
{
  "name": "instagram-disruptor-helper",
  "version": "1.1.0",
  "description": "Local helper server for Instagram Disruptor Chrome extension",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "license": "MIT"
}
JSON
  success "Created package.json"
fi

# ---------------------------------------------------------------------------
# 4. Platform-specific extras
# ---------------------------------------------------------------------------
if [[ "$OS" == "mac" ]]; then
  # osascript is built-in – no extra install needed
  success "macOS: osascript available (no extra install needed)"

elif [[ "$OS" == "linux" ]]; then
  info "Linux: ensuring alsa-utils (amixer) is installed…"
  if ! command -v amixer &>/dev/null; then
    if command -v apt-get &>/dev/null; then
      sudo apt-get install -y alsa-utils &>/dev/null || warn "Could not install alsa-utils – unmute may not work"
    elif command -v pacman &>/dev/null; then
      sudo pacman -S --noconfirm alsa-utils &>/dev/null || warn "Could not install alsa-utils"
    else
      warn "Please install alsa-utils manually for system unmute to work."
    fi
  fi
  success "alsa-utils present"

elif [[ "$OS" == "windows" ]]; then
  # nircmd should be downloaded and placed next to server.js
  if [[ ! -f "$SCRIPT_DIR/nircmd.exe" ]]; then
    warn "nircmd.exe not found in project root."
    warn "Download from https://www.nirsoft.net/utils/nircmd.html and place nircmd.exe in:"
    warn "  $SCRIPT_DIR"
    warn "System unmute will be skipped until nircmd.exe is present."
  else
    success "nircmd.exe found"
  fi
fi

# ---------------------------------------------------------------------------
# 5. Create a launch script appropriate for the OS
# ---------------------------------------------------------------------------
if [[ "$OS" == "windows" ]]; then
  LAUNCHER="$SCRIPT_DIR/start_helper.bat"
  cat > "$LAUNCHER" <<'BAT'
@echo off
echo Starting Instagram Disruptor helper...
node "%~dp0server.js"
pause
BAT
  success "Created start_helper.bat – double-click it to start the helper server"
else
  LAUNCHER="$SCRIPT_DIR/start_helper.sh"
  cat > "$LAUNCHER" <<SHELL
#!/usr/bin/env bash
echo "Starting Instagram Disruptor helper…"
cd "$(dirname "\$0")"
node server.js
SHELL
  chmod +x "$LAUNCHER"
  success "Created start_helper.sh"
fi

# ---------------------------------------------------------------------------
# 6. Print extension load instructions
# ---------------------------------------------------------------------------
EXTENSION_PATH="$SCRIPT_DIR/extension"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  Setup complete!  Next steps:${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo -e "  ${BOLD}1. Start the helper server${RESET}"
if [[ "$OS" == "windows" ]]; then
  echo "     Double-click: start_helper.bat"
  echo "     or run:       node server.js"
else
  echo "     ./start_helper.sh"
  echo "     (or: node server.js)"
fi
echo ""
echo -e "  ${BOLD}2. Load the Chrome extension (one-time)${RESET}"
echo "     a) Open Chrome and go to: chrome://extensions"
echo "     b) Enable 'Developer mode' (top-right toggle)"
echo "     c) Click 'Load unpacked'"
echo -e "     d) Select this folder:\n        ${YELLOW}$EXTENSION_PATH${RESET}"
echo ""
echo -e "  ${BOLD}3. Visit instagram.com${RESET}"
echo "     The extension will trigger a break reminder after 3–5 min."
echo ""
echo -e "  ${BOLD}4. Check status any time${RESET}"
echo "     Click the extension icon in Chrome to see time tracked."
echo ""
