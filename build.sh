#!/usr/bin/env nix-shell
#! nix-shell -i bash -p yarn nodejs caddy wasm-pack rustc cargo lld
set -e

WASM_SRC="tiktoken-wasm/src"
WASM_CARGO="tiktoken-wasm/Cargo.toml"
WASM_OUT="source/static/tokenizer-viewer/wasm/tiktoken_wasm_bg.wasm"
WASM_HASH_FILE="tiktoken-wasm/.src_hash"

function maybe_build_wasm() {
  # Compute hash of all source files that affect the WASM output
  local current_hash
  current_hash=$(find "$WASM_SRC" "$WASM_CARGO" -type f 2>/dev/null | sort | xargs cat | shasum -a 256 | cut -d' ' -f1)

  local prev_hash=""
  if [ -f "$WASM_HASH_FILE" ]; then
    prev_hash=$(cat "$WASM_HASH_FILE")
  fi

  if [ "$current_hash" = "$prev_hash" ] && [ -f "$WASM_OUT" ]; then
    echo "[wasm] tiktoken-wasm unchanged, skipping build"
    return
  fi

  echo "[wasm] tiktoken-wasm sources changed, rebuilding..."
  (
    cd tiktoken-wasm
    wasm-pack build --target web --out-dir ../source/static/tokenizer-viewer/wasm/ --release
    rm -f ../source/static/tokenizer-viewer/wasm/.gitignore
    rm -f ../source/static/tokenizer-viewer/wasm/package.json
    rm -f ../source/static/tokenizer-viewer/wasm/README.md
  )
  echo "$current_hash" > "$WASM_HASH_FILE"
  echo "[wasm] build complete -> $WASM_OUT"
}

function publish() {
  cp -r ./public /var/www/blog/
  chown -R www-data /var/www/blog/
}

function develop() {
  echo "Visit: http://127.0.0.1:11451"

  if [ -x "$(command -v xdg-open)" ]; then
    xdg-open http://127.0.0.1:11451
  elif [ -x "$(command -v open)" ]; then # MacOS
    open http://127.0.0.1:11451
  fi

  caddy file-server --root public --listen :11451
}

while getopts "p:d" opt; do
  case "${opt}" in
    p)
      echo "publishing on kagura's server"
      git pull

      maybe_build_wasm
      yarn install
      npx hexo generate

      publish
      ;;
    d)
      echo "Development mode"

      maybe_build_wasm
      yarn install
      npx hexo generate

      develop
      ;;
  esac
done