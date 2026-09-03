#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -p "require('${project_dir}/package.json').version")"
output_dir="${project_dir}/dist"

cd "${project_dir}"
npm run check
mkdir -p "${output_dir}"

for target in chrome-mv3 edge-mv3 firefox-mv3; do
  browser="${target%-mv3}"
  archive="${output_dir}/alias-buddy-v${version}-${browser}.zip"
  rm -f "${archive}"
  (
    cd ".output/${target}"
    zip -qr "${archive}" .
  )
  unzip -tq "${archive}" >/dev/null
  echo "Created ${archive}"
done
