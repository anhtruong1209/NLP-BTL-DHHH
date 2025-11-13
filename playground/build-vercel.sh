#!/bin/bash
set -e

# Build all workspace dependencies first
echo "Building workspace dependencies..."
pnpm build --filter "@vben-core/*" --filter "@vben/*" || echo "Some dependencies may not have build scripts, continuing..."

# Build playground
echo "Building playground..."
pnpm --filter @vben/playground build

