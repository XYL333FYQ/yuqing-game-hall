#!/usr/bin/env bash
set -euo pipefail

current_sha="${1:?Usage: prune-ghcr-versions.sh CURRENT_SHA [PREVIOUS_SHA]}"
previous_sha="${2:-}"
if [[ ! "$current_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Current package version must be a 40-character lowercase commit SHA." >&2
  exit 2
fi
if [[ -n "$previous_sha" && ! "$previous_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Previous package version must be empty or a 40-character lowercase commit SHA." >&2
  exit 2
fi

owner="${GITHUB_REPOSITORY%%/*}"
repository="${GITHUB_REPOSITORY#*/}"
repository="${repository,,}"
owner_type="$(gh api "users/${owner}" --jq .type)"
if [[ "$owner_type" == "Organization" ]]; then
  owner_endpoint="orgs/${owner}"
else
  owner_endpoint="users/${owner}"
fi

for suffix in fruit-party sanctuary-relay webrtc-gateway card-room gobang; do
  package_name="${repository}-${suffix}"
  endpoint="${owner_endpoint}/packages/container/${package_name}/versions"
  versions="$(gh api --paginate "$endpoint" \
    --jq '.[] | [.id, ((.metadata.container.tags // []) | join(","))] | @tsv')"

  while IFS=$'\t' read -r version_id tags; do
    [[ -z "$version_id" ]] && continue
    if [[ ",$tags," == *",$current_sha,"* || ( -n "$previous_sha" && ",$tags," == *",$previous_sha,"* ) ]]; then
      continue
    fi
    gh api --method DELETE "${endpoint}/${version_id}"
    echo "Deleted old GHCR version ${package_name}#${version_id}"
  done <<< "$versions"
done
