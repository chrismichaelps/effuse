#!/bin/bash

set -e

echo "Clearing caches..."

rm -rf packages/core/dist
rm -rf packages/store/dist
rm -rf packages/router/dist
rm -rf packages/ink/dist
rm -rf packages/query/dist
rm -rf packages/i18n/dist
rm -rf app/dist

rm -rf app/node_modules/.vite
rm -rf app/.vite
rm -rf node_modules/.cache
rm -rf .turbo

find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

echo "Building all packages..."
pnpm -r run build

echo "Clean build complete!"