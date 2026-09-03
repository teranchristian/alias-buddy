#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -p "require('${project_dir}/manifest.json').version")"
output_dir="${project_dir}/dist"
archive="${output_dir}/alias-buddy-v${version}.zip"
staging_dir="$(mktemp -d)"

cleanup() {
  rm -rf "${staging_dir}"
}
trap cleanup EXIT

cd "${project_dir}"
node --test
node scripts/validate-extension.mjs
mkdir -p "${output_dir}"
cp manifest.json "${staging_dir}/"
cp -R src icons "${staging_dir}/"

rm -f "${archive}"
(
  cd "${staging_dir}"
  zip -qr "${archive}" manifest.json src icons
)

echo "Created ${archive}"
