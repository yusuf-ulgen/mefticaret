#!/usr/bin/env bash
# k6 Cloud (Grafana Cloud k6) çalıştırıcı — 20.000 VU gibi tek makineden
# üretilemeyecek yükler için. Token bilgisayarınızda kalır, projeye yazılmaz.
#
# Kullanım:
#   export K6_CLOUD_TOKEN="grafana-cloud-k6-token"
#   export K6_CLOUD_PROJECT_ID="1234567"
#   BASE_URL=https://staging.example.test VUS=20000 DURATION=15m \
#     bash loadtest/k6/cloud-run.sh storefront
#   BASE_URL=https://staging.example.test VUS=1000 ORDERS=10000 \
#     bash loadtest/k6/cloud-run.sh checkout
set -euo pipefail

: "${K6_CLOUD_TOKEN:?Grafana Cloud k6 API token gerekli: export K6_CLOUD_TOKEN=...}"
: "${K6_CLOUD_PROJECT_ID:?Grafana Cloud k6 proje kimliği gerekli: export K6_CLOUD_PROJECT_ID=...}"
: "${BASE_URL:?HEDEF gerekli: export BASE_URL=https://staging.example.test}"

SCENARIO="${1:-storefront}"
case "$SCENARIO" in
  storefront) SCRIPT="loadtest/k6/storefront.js" ;;
  checkout)
    : "${LOADTEST_SECRET:?Staging checkout LOADTEST_SECRET gerekli}"
    SCRIPT="loadtest/k6/checkout.js" ;;
  *) echo "Bilinmeyen senaryo: $SCENARIO (storefront | checkout)" >&2; exit 1 ;;
esac

export VUS="${VUS:-500}"
export DURATION="${DURATION:-10m}"
export K6_LOAD_ZONE="${K6_LOAD_ZONE:-amazon:de:frankfurt}"

echo "→ k6 Cloud: $SCRIPT | BASE_URL=$BASE_URL VUS=$VUS DURATION=$DURATION bölge=$K6_LOAD_ZONE"
exec k6 cloud run "$SCRIPT"
