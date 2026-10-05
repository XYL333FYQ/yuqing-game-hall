#!/usr/bin/env bash
set -euo pipefail

image_prefix="${1:?Usage: prune-deployed-images.sh IMAGE_PREFIX CURRENT_SHA [PREVIOUS_SHA]}"
current_sha="${2:?Usage: prune-deployed-images.sh IMAGE_PREFIX CURRENT_SHA [PREVIOUS_SHA]}"
previous_sha="${3:-}"

if [[ ! "$current_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Current image version must be a 40-character lowercase commit SHA." >&2
  exit 2
fi
if [[ -n "$previous_sha" && ! "$previous_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Previous image version must be empty or a 40-character lowercase commit SHA." >&2
  exit 2
fi

services=(fruit-party sanctuary-relay webrtc-gateway card-room gobang)
for service in "${services[@]}"; do
  repository="${image_prefix}-${service}"
  while IFS= read -r image; do
    [[ -z "$image" ]] && continue
    tag="${image##*:}"
    if [[ "$tag" == "$current_sha" || ( -n "$previous_sha" && "$tag" == "$previous_sha" ) ]]; then
      continue
    fi

    if ! docker image rm "$image"; then
      echo "::warning::Could not remove old image reference: ${image}"
    fi
  done < <(docker image ls --format '{{.Repository}}:{{.Tag}}' --filter "reference=${repository}:*")
done

# Removing tags can leave unreferenced intermediate images behind.
docker image prune --force
