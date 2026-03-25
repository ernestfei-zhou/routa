#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Deprecated: use node --import tsx tools/hook-runtime/src/check-markdown-links.ts directly."

exec node --import tsx "$ROOT_DIR/tools/hook-runtime/src/check-markdown-links.ts" "$@"
