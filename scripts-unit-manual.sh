#!/usr/bin/env bash
# Jalankan sebagian suite unit (atau seluruhnya) dengan basis data disposable,
# tanpa mengubah apa pun di repo.
set -euo pipefail

REPO="aplikasi-manajemen-bimbel-offline-jurnal-mengajar"
cd "$(dirname "$0")/$REPO"

PROJECT="starter-pg-test-manual"
export STARTER_TEST_PASSWORD
STARTER_TEST_PASSWORD="$(node -e 'console.log(require("crypto").randomBytes(18).toString("hex"))')"

cleanup() {
  docker compose -p "$PROJECT" -f compose.test.yaml down --volumes --remove-orphans || true
}
trap cleanup EXIT

docker compose -p "$PROJECT" -f compose.test.yaml up -d --wait --wait-timeout 60 postgres
PORT="$(docker compose -p "$PROJECT" -f compose.test.yaml port postgres 5432 | sed 's/.*://')"
URL="postgresql://starter_test:${STARTER_TEST_PASSWORD}@127.0.0.1:${PORT}/starter_test"

export DATABASE_URL="$URL"
export MIGRATION_DATABASE_URL="$URL"
export STARTER_TEST_DATABASE_URL="$URL"
export STARTER_TEST_RUN="$PROJECT"
export BETTER_AUTH_SECRET
BETTER_AUTH_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
export BETTER_AUTH_URL="http://localhost:3101"

node scripts/migrate.mjs
node --conditions=react-server --test "$@"
