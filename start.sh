#!/bin/sh
set -e

export DATABASE_URL="${DATABASE_URL:-file:/data/pharmastock.db}"
# Strip the file: prefix to get the raw filesystem path
DB_PATH="${DATABASE_URL#file:}"

mkdir -p "$(dirname "$DB_PATH")"

# Restore from R2 if no database exists yet
if [ ! -f "$DB_PATH" ]; then
  echo "No database found at $DB_PATH, attempting restore from R2..."
  if litestream restore -if-replica-exists -o "$DB_PATH" "s3://${R2_BUCKET}/pharmastock"; then
    echo "Database restored from R2"
  else
    echo "No backup found in R2, creating fresh database..."
  fi
fi

# Apply schema (creates tables on first run, safe on subsequent runs)
echo "Syncing database schema..."
./node_modules/.bin/prisma db push

# Litestream replicates the DB and keeps the app running as a subprocess
echo "Starting application with Litestream replication..."
exec litestream replicate -exec "node dist/index.js"
