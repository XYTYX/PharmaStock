#!/bin/sh
# One-time script to upload your existing dev.db to R2 before the first Railway deploy.
# Run from the project root after setting these env vars:
#
#   export LITESTREAM_ACCESS_KEY_ID=<your R2 access key>
#   export LITESTREAM_SECRET_ACCESS_KEY=<your R2 secret key>
#   export R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
#   export R2_BUCKET=pharmastock-backup
#
# Then run:  sh scripts/seed-r2.sh

set -e

DB_PATH="$(pwd)/backend/prisma/dev.db"

if [ ! -f "$DB_PATH" ]; then
  echo "Error: $DB_PATH not found. Run this from the project root."
  exit 1
fi

: "${LITESTREAM_ACCESS_KEY_ID:?Must set LITESTREAM_ACCESS_KEY_ID}"
: "${LITESTREAM_SECRET_ACCESS_KEY:?Must set LITESTREAM_SECRET_ACCESS_KEY}"
: "${R2_ENDPOINT:?Must set R2_ENDPOINT}"
: "${R2_BUCKET:?Must set R2_BUCKET}"

echo "Uploading $DB_PATH to R2..."
echo "Watch for 'snapshot written' in the output, then press Ctrl+C."
echo ""

docker run --rm \
  -v "$DB_PATH:/db/pharmastock.db:ro" \
  -e LITESTREAM_ACCESS_KEY_ID="$LITESTREAM_ACCESS_KEY_ID" \
  -e LITESTREAM_SECRET_ACCESS_KEY="$LITESTREAM_SECRET_ACCESS_KEY" \
  litestream/litestream \
  replicate \
  -replica "s3://$R2_BUCKET/pharmastock?endpoint=$R2_ENDPOINT&force-path-style=true" \
  /db/pharmastock.db
