#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "Deprecated: use node --import tsx tools/hook-runtime/src/check-schedules-db.ts directly."

exec node --import tsx "$ROOT_DIR/tools/hook-runtime/src/check-schedules-db.ts" "$@"
