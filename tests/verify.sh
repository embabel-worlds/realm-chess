#!/bin/sh
# The realm's battery against a live appliance: tests/verify.py (every view by name on its
# defaults, and ground truth from the board and the Lichess openings list), then
# tests/live/views.mjs (the fixture positions against their recorded envelopes, and every empty
# answer explained by ChessStatus). The last line on success is exactly `ALL CHECKS PASS`; any
# failure exits non-zero.
#
#   APPLIANCE=http://127.0.0.1:11043 AUTH=user:pass sh tests/verify.sh
#
# Needs no key. A Lichess token bound in the appliance (LICHESS_TOKEN) makes the Lichess views
# answer with rows, which both scripts then check for their columns.
cd "$(dirname "$0")/.." || exit 2
APPLIANCE=${APPLIANCE:-${APPLIANCE_URL:-http://127.0.0.1:11043}}
AUTH=${AUTH:-${EMBABEL_AUTH:-}}
[ -n "$AUTH" ] || { [ -n "${EMBABEL_USER:-}" ] && AUTH="$EMBABEL_USER:$EMBABEL_PASSWORD"; }
: "${AUTH:?set AUTH=user:pass}"
APPLIANCE_AUTH="Basic $(printf '%s' "$AUTH" | base64)"
export APPLIANCE AUTH APPLIANCE_AUTH

fail=0
python3 tests/verify.py || fail=1
echo "== the fixture positions, against their recorded envelopes"
node tests/live/views.mjs || fail=1

[ $fail = 0 ] && echo "ALL CHECKS PASS" || { echo "CHECKS FAILED"; exit 1; }
