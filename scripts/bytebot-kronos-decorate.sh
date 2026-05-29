#!/usr/bin/env bash
set -euo pipefail

DOCKER_CONFIG_DIR="${DOCKER_CONFIG_DIR:-/tmp/kronos-docker-config}"
CONTAINER="${BYTEBOT_CONTAINER:-bytebot-desktop}"

docker --config "$DOCKER_CONFIG_DIR" exec -u root "$CONTAINER" sh -s <<'SH'
set -eu
mkdir -p /home/user/Desktop /home/user/Pictures /home/user/.local/share/applications /home/user/.config/xfce4/terminal
cat > /home/user/Pictures/kronos-bytebot-wallpaper.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960" viewBox="0 0 1280 960">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#090b16"/>
      <stop offset="0.55" stop-color="#14172b"/>
      <stop offset="1" stop-color="#27133d"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="55%">
      <stop offset="0" stop-color="#7c3aed" stop-opacity="0.55"/>
      <stop offset="0.42" stop-color="#06b6d4" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="960" fill="url(#bg)"/>
  <rect width="1280" height="960" fill="url(#glow)"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.08">
    <path d="M0 760 C260 650 390 820 640 720 S1020 610 1280 720"/>
    <path d="M0 800 C260 690 390 860 640 760 S1020 650 1280 760"/>
    <path d="M0 840 C260 730 390 900 640 800 S1020 690 1280 800"/>
  </g>
  <text x="90" y="135" fill="#e5e7eb" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="800">KronosCode Desktop</text>
  <text x="94" y="188" fill="#a5b4fc" font-family="Inter, Arial, sans-serif" font-size="28">Bytebot sandbox · MCP computer-use runtime · KronTerm controlled</text>
  <g transform="translate(90 250)">
    <rect width="470" height="180" rx="28" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.14"/>
    <text x="32" y="58" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700">Agent Runtime</text>
    <text x="32" y="104" fill="#cbd5e1" font-family="Inter, Arial, sans-serif" font-size="20">KronosCode agent: computer-use</text>
    <text x="32" y="139" fill="#cbd5e1" font-family="Inter, Arial, sans-serif" font-size="20">MCP: http://localhost:9990/mcp</text>
  </g>
  <g transform="translate(610 250)">
    <rect width="470" height="180" rx="28" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.14"/>
    <text x="32" y="58" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700">Desktop Tools</text>
    <text x="32" y="104" fill="#cbd5e1" font-family="Inter, Arial, sans-serif" font-size="20">screenshot · mouse · keyboard · apps</text>
    <text x="32" y="139" fill="#cbd5e1" font-family="Inter, Arial, sans-serif" font-size="20">noVNC: /novnc/vnc.html</text>
  </g>
  <text x="94" y="850" fill="#64748b" font-family="Inter, Arial, sans-serif" font-size="18">This is an isolated VM-like desktop. Keep secrets out unless explicitly intended.</text>
</svg>
SVG

cat > /home/user/Desktop/kronoscode-terminal.desktop <<'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=KronosCode Terminal
Comment=Open a terminal prepared for KronosCode computer-use work
Exec=xfce4-terminal --title="KronosCode Computer Use" --command="bash -lc 'clear; echo KronosCode Computer Use Desktop; echo MCP: http://localhost:9990/mcp; echo noVNC: http://localhost:9990/novnc/vnc.html; echo; if command -v kronoscode >/dev/null 2>&1; then kronoscode --help; else echo kronoscode CLI is not installed inside this container yet.; echo Use this desktop through KronTerm/KronosCode MCP from the host.; fi; exec bash'"
Icon=utilities-terminal
Terminal=false
Categories=Development;TerminalEmulator;
DESKTOP

cat > /home/user/Desktop/bytebot-mcp.desktop <<'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=Bytebot MCP Endpoint
Comment=Open the Bytebot MCP/SSE endpoint
Exec=firefox http://localhost:9990/mcp
Icon=network-server
Terminal=false
Categories=Development;Network;
DESKTOP

cat > /home/user/Desktop/kronterm-novnc.desktop <<'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=Bytebot noVNC Desktop
Comment=Open the local noVNC desktop endpoint
Exec=firefox http://localhost:9990/novnc/vnc.html
Icon=computer
Terminal=false
Categories=Development;Network;
DESKTOP

cat > /home/user/Desktop/README-KRONOSCODE.txt <<'TXT'
KronosCode-ready Bytebot desktop

Host endpoints:
- noVNC: http://localhost:9990/novnc/vnc.html
- MCP:   http://localhost:9990/mcp
- API:   POST http://localhost:9990/computer-use

KronTerm/KronosCode route:
- KronosCode agent: computer-use
- Required MCP: computer-use-mcp -> http://localhost:9990/mcp
- KronTerm sandbox runtime: WAVE_SANDBOX_RUNTIME=bytebot
TXT

chmod +x /home/user/Desktop/*.desktop
chown -R user:user /home/user/Desktop /home/user/Pictures

if command -v xfconf-query >/dev/null 2>&1; then
  export DISPLAY=:0
  for prop in $(xfconf-query -c xfce4-desktop -l 2>/dev/null | grep 'last-image$' || true); do
    xfconf-query -c xfce4-desktop -p "$prop" -s /home/user/Pictures/kronos-bytebot-wallpaper.svg || true
  done
fi
SH

docker --config "$DOCKER_CONFIG_DIR" exec "$CONTAINER" sh -lc 'DISPLAY=:0 xfdesktop --reload >/dev/null 2>&1 || true'
echo "Decorated $CONTAINER for KronosCode computer-use."
