#!/usr/bin/env sh
# Regenerate the RTK Query client to a temp file and diff it against the committed one.
# Never overwrites src/api/endpoints.ts. Deliberately NOT part of `build` (see .githooks/pre-push).
# The temp file sits beside api.ts so its relative imports are identical; it is removed on exit.
CHECK=src/api/endpoints.gen.check.ts
trap 'rm -f "$CHECK"' EXIT
npx @rtk-query/codegen-openapi openapi/rtk-query.check.config.cjs >/dev/null || exit 1
if diff -u src/api/endpoints.ts "$CHECK" | head -40 >/tmp/rs-storefront-api-diff.$$ && [ ! -s /tmp/rs-storefront-api-diff.$$ ]; then
  rm -f /tmp/rs-storefront-api-diff.$$
  echo "check:api-types OK - src/api/endpoints.ts matches openapi/swagger.json"
else
  cat /tmp/rs-storefront-api-diff.$$; rm -f /tmp/rs-storefront-api-diff.$$
  echo
  echo "check:api-types FAILED: src/api/endpoints.ts is out of step with openapi/swagger.json."
  echo "Run: npm run codegen:api   (then commit src/api/endpoints.ts)"
  echo "Why: a stale client silently calls an old API shape - this is how the original spec drift happened."
  exit 1
fi
