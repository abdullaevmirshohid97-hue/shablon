#!/usr/bin/env bash
# Runs every migration and then the assertion suites against a throwaway
# Postgres container, so a schema change is verified before it reaches
# Supabase — where a broken migration is a production incident, not a
# failing test.
#
#   ./packages/database/supabase/tests/run.sh
#
# Needs Docker. Nothing else; no Supabase project, no network.
set -euo pipefail

# Git Bash on Windows rewrites /tmp/... arguments into Windows paths.
export MSYS_NO_PATHCONV=1

# `pwd -W` yields a Windows path under Git Bash, which is what `docker cp`
# needs there; plain `pwd` is right everywhere else.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && { pwd -W 2>/dev/null || pwd; })"
MIGRATIONS="$HERE/../migrations"
CONTAINER=mubosher-db-test
IMAGE=postgres:16

# 10_ carries its own fixture (it asserts on a virgin org); the later suites
# share 01_fixture.sql.
SUITES=(10_roles_audit.sql 20_reversal_periods.sql 30_ledger_currency.sql)
NEEDS_FIXTURE=(no yes yes)

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

start_db() {
  cleanup
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=app "$IMAGE" >/dev/null
  until docker exec "$CONTAINER" pg_isready -U postgres -d app >/dev/null 2>&1; do sleep 0.3; done
  docker cp "$HERE/." "$CONTAINER":/tmp/tests/ >/dev/null
  docker cp "$MIGRATIONS/." "$CONTAINER":/tmp/migrations/ >/dev/null
  # The realtime publication warns about wal_level on a stock image; harmless here.
  docker exec "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d app -f /tmp/tests/00_bootstrap.sql >/dev/null 2>&1

  for f in $(ls "$MIGRATIONS"/*.sql | xargs -n1 basename | sort); do
    if ! docker exec "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d app \
        -f "/tmp/migrations/$f" >/tmp/mig.log 2>&1; then
      echo "MIGRATION FAILED: $f"
      docker exec "$CONTAINER" psql -q -U postgres -d app -f "/tmp/migrations/$f" 2>&1 | tail -20
      exit 1
    fi
  done
}

total_pass=0
total_fail=0

for i in "${!SUITES[@]}"; do
  suite="${SUITES[$i]}"
  start_db
  if [ "${NEEDS_FIXTURE[$i]}" = "yes" ]; then
    docker exec "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d app \
      -f /tmp/tests/01_fixture.sql >/dev/null
  fi

  out=$(docker exec "$CONTAINER" psql -U postgres -d app -q -f "/tmp/tests/$suite" 2>&1)
  pass=$(echo "$out" | grep -c '\[PASS\]' || true)
  fail=$(echo "$out" | grep -c '\[FAIL\]' || true)
  total_pass=$((total_pass + pass))
  total_fail=$((total_fail + fail))

  printf '%-28s %3d pass  %d fail\n' "$suite" "$pass" "$fail"
  echo "$out" | grep -E '\[FAIL\]|ERROR' | sed 's/^/    /' || true
done

echo '--------------------------------------------'
echo "total: $total_pass pass, $total_fail fail"
[ "$total_fail" -eq 0 ]
