#!/usr/bin/env nix-shell
#! nix-shell -i bash -p wasm-pack rustc cargo lld
set -e

cd "$(dirname "$0")"

echo "Building tiktoken-wasm..."
(
  cd tiktoken-wasm
  wasm-pack build --target web --out-dir ../source/static/tokenizer-viewer/wasm/ --release
  rm -f ../source/static/tokenizer-viewer/wasm/.gitignore
  rm -f ../source/static/tokenizer-viewer/wasm/package.json
  rm -f ../source/static/tokenizer-viewer/wasm/README.md
)

# Write hash so build.sh can skip next time if unchanged
find tiktoken-wasm/src tiktoken-wasm/Cargo.toml -type f 2>/dev/null \
  | sort | xargs cat | shasum -a 256 | cut -d' ' -f1 \
  > tiktoken-wasm/.src_hash

echo ""
echo "WASM build complete -> source/static/tokenizer-viewer/wasm/"
ls -lh source/static/tokenizer-viewer/wasm/
