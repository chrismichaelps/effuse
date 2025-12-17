#!/bin/bash

# Exit on error
set -e

echo "Cleaning existing node_modules and lock file..."
rm -rf node_modules pnpm-lock.yaml
pnpm -r exec rm -rf node_modules

echo "Starting dependency update process..."

echo "Updating root package.json..."
pnpm dlx npm-check-updates -u

echo "Updating workspace packages..."
pnpm -r exec pnpm dlx npm-check-updates -u

echo "Installing dependencies..."
pnpm install

echo "All dependencies updated successfully!"
