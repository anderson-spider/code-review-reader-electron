#!/usr/bin/env bash

set -euo pipefail

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
electron_dir="$project_root/node_modules/electron"
electron_bin="$project_root/node_modules/.bin/electron"

if "$electron_bin" --version >/dev/null 2>&1; then
  exit 0
fi

echo ">>> Runtime ausente ou inválido; reconstruindo Electron..."

platform=$(uname -s)
zip_path=''
if [[ $platform == "Darwin" ]]; then
  zip_path=$(cd "$project_root" && node -e '
  const { downloadArtifact } = require("@electron/get");
  const electronPackage = require("electron/package.json");
  const checksums = require("electron/checksums.json");

  downloadArtifact({
    version: electronPackage.version,
    artifactName: "electron",
    platform: process.platform,
    arch: process.arch,
    checksums,
  }).then((artifactPath) => process.stdout.write(artifactPath));
')
fi

backup_dir=$(mktemp -d "$electron_dir/.repair.XXXXXX")
dist_backed_up=false
path_backed_up=false
repair_started=false

restore_runtime() {
  if [[ $repair_started == true ]]; then
    rm -rf "$electron_dir/dist"
    rm -f "$electron_dir/path.txt"
  fi
  if [[ $dist_backed_up == true ]]; then
    mv "$backup_dir/dist" "$electron_dir/dist"
  fi
  if [[ $path_backed_up == true ]]; then
    mv "$backup_dir/path.txt" "$electron_dir/path.txt"
  fi
  rmdir "$backup_dir" 2>/dev/null || true
}
trap restore_runtime ERR

if [[ -d "$electron_dir/dist" ]]; then
  mv "$electron_dir/dist" "$backup_dir/dist"
  dist_backed_up=true
fi
if [[ -f "$electron_dir/path.txt" ]]; then
  mv "$electron_dir/path.txt" "$backup_dir/path.txt"
  path_backed_up=true
fi
repair_started=true

if [[ $platform == "Darwin" ]]; then
  mkdir "$electron_dir/dist"
  ditto -x -k "$zip_path" "$electron_dir/dist"
  printf '%s' 'Electron.app/Contents/MacOS/Electron' > "$electron_dir/path.txt"
  codesign --force --deep --sign - "$electron_dir/dist/Electron.app"
else
  npm rebuild electron
fi
"$electron_bin" --version >/dev/null

trap - ERR
rm -rf "$backup_dir"
