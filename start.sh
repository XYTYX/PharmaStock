#!/bin/sh
set -e

export DATABASE_URL="${DATABASE_URL:-file:/data/pharmastock.db}"
# Strip the file: prefix to get the raw filesystem path
DB_PATH="${DATABASE_URL#file:}"

mkdir -p "$(dirname "$DB_PATH")"

# Restore from R2 if no database exists yet and R2 is configured
if [ ! -f "$DB_PATH" ] && [ -n "$R2_BUCKET" ] && [ -n "$R2_ENDPOINT" ]; then
  echo "No database found at $DB_PATH, attempting restore from R2..."
  if litestream restore -if-replica-exists -config ./litestream.yml "$DB_PATH"; then
    echo "Database restored from R2"
  else
    echo "No backup found in R2, will create fresh database..."
  fi
fi

# Apply schema (creates tables on first run, safe on subsequent runs)
echo "Syncing database schema..."
./node_modules/.bin/prisma db push

# Use Litestream only when R2 is configured
if [ -n "$R2_BUCKET" ] && [ -n "$R2_ENDPOINT" ]; then
  echo "Starting application with Litestream replication..."
  exec litestream replicate -config ./litestream.yml -exec "node dist/index.js"
else
  echo "R2 not configured, starting application without replication..."
  exec node dist/index.js
fi
