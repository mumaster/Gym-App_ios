#!/bin/sh
# Renders exercise animation frames for review (docs/exercise-animations.md):
# front and side views at 0, 300, 450, 700 and 900 of the rep, plus a
# 12-frame side strip of the whole rep, one PNG per exercise.
# Usage: scripts/animation-frames/render.sh <outdir> <exercise-id> [...]
set -e
OUT=$(realpath -m "$1"); shift
DIR=$(dirname "$(realpath "$0")")
TMP=$(mktemp -d)
cd "$DIR/../.."
npx esbuild "$DIR/entry.tsx" --bundle --platform=node --format=esm --jsx=automatic \
  --outfile="$TMP/entry.mjs" --log-level=error --external:react --external:react-dom
mkdir -p "$OUT"
cp "$TMP/entry.mjs" "$DIR/.entry-$$.mjs"
node "$DIR/.entry-$$.mjs" "$TMP/frames.html" "$@"
rm -f "$DIR/.entry-$$.mjs"
node "$DIR/shot.mjs" "$TMP/frames.html" "$OUT" "$@"
rm -rf "$TMP"
