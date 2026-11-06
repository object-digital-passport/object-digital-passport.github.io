#!/bin/sh
# Isolated Hardhat simulation only. No network, keys, or Polygon RPC are used.
set -eu
site_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
chain_root=${ODP_SPEC_CHAIN_DIR:-"$site_root/../specifications/chain"}
artifact="$chain_root/artifacts/contracts/ObjectDigitalPassport.sol/ObjectDigitalPassport.json"
edition_artifact="$chain_root/artifacts/contracts/ODPEditionUnits.sol/ODPEditionUnits.json"
test -f "$artifact"
test -f "$edition_artifact"
test -d "$chain_root/node_modules/hardhat"
temp_root=$(mktemp -d "${TMPDIR:-/tmp}/odp-site-chain.XXXXXXXX")
printf '%s\n' '{"type":"module"}' > "$temp_root/package.json"
cat > "$temp_root/hardhat.config.js" <<'EOF'
import { defineConfig } from "hardhat/config";
import toolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
export default defineConfig({plugins:[toolbox],networks:{default:{type:"edr-simulated",chainId:137}}});
EOF
ln -s "$chain_root/node_modules" "$temp_root/node_modules"
cp "$site_root/backend/test/odp-v07-local-chain.mjs" "$temp_root/test.mjs"
cd "$temp_root"
ODP_SITE_ROOT="$site_root" ODP_TEST_ARTIFACT="$artifact" ODP_EDITION_ARTIFACT="$edition_artifact" ODP_SAFE_FIXTURE="$chain_root/deploy/test/fixtures/safe-1.4.1.json" node test.mjs
