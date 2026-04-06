#!/bin/bash
set -e

echo "=== Container Startup Diagnostics ==="
echo "PATH: $PATH"
echo ""
echo "Searching for runtimes..."
which deno || echo "deno not in PATH"
which node || echo "node not in PATH"
which ffmpeg || echo "ffmpeg not in PATH"
echo ""

# Try to find in Nix store
if [ -d "/nix/store" ]; then
    echo "Nix store exists, searching..."
    find /nix/store -name "deno" -type f 2>/dev/null | head -5 || echo "No deno found in Nix store"
    find /nix/store -name "node" -type f 2>/dev/null | head -5 || echo "No node found in Nix store"
fi
echo "======================================"
echo ""

# Start the application
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --log-level info
