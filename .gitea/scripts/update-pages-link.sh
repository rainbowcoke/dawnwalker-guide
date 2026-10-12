#!/usr/bin/env bash
set -euo pipefail

# Never enable shell tracing in this script: it handles an API token.
: "${GITEA_SERVER_URL:?Set the Gitea server URL}"
: "${REPOSITORY:?Set the owner/repository name}"
: "${PAGES_URL:?Set the PAGES_URL Actions variable}"
: "${PAGES_REPO_TOKEN:?Set the PAGES_REPO_TOKEN Actions secret}"

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != --check ) ]]; then
  echo 'Usage: update-pages-link.sh [--check]' >&2
  exit 1
fi

# Reject whitespace, quotes and backslashes; use percent-encoded URLs instead.
url_pattern='^https?://[^[:space:]"\\]+$'
[[ "$GITEA_SERVER_URL" =~ $url_pattern ]] || { echo 'Invalid Gitea server URL' >&2; exit 1; }
[[ "$PAGES_URL" =~ $url_pattern ]] || { echo 'Invalid Pages URL' >&2; exit 1; }
[[ "$REPOSITORY" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo 'Invalid repository name' >&2; exit 1; }
[[ "$PAGES_REPO_TOKEN" != *$'\r'* && "$PAGES_REPO_TOKEN" != *$'\n'* ]] || { echo 'Invalid API token' >&2; exit 1; }
command -v curl >/dev/null || { echo 'The ci-tools image must include curl' >&2; exit 1; }

if [[ "${1:-}" == --check ]]; then
  echo 'Sidebar link configuration is present and valid.'
  exit 0
fi

# The workflow runs this only after deploy-pages.sh has verified Nginx.
# PATCH changes only website; other repository settings are preserved.
payload=$(printf '{"website":"%s"}' "$PAGES_URL")
endpoint="${GITEA_SERVER_URL%/}/api/v1/repos/$REPOSITORY"
if ! status=$(curl --silent --show-error \
  --connect-timeout 10 --max-time 30 \
  --request PATCH \
  --header "Authorization: token $PAGES_REPO_TOKEN" \
  --header 'Content-Type: application/json' \
  --data-binary "$payload" \
  --output /dev/null --write-out '%{http_code}' \
  "$endpoint"); then
  echo 'Website deployment completed, but the Gitea API request failed. Check runner connectivity.' >&2
  exit 1
fi

case "$status" in
  200) echo 'Repository sidebar website link updated successfully.' ;;
  401|403)
    echo "Gitea returned HTTP $status. Check token validity, write:repository scope, and repository admin access." >&2
    exit 1
    ;;
  404)
    echo 'Gitea returned HTTP 404. Check server URL, repository name, and token access to this repository.' >&2
    exit 1
    ;;
  *)
    echo "Website deployment completed, but the sidebar update failed (HTTP $status)." >&2
    exit 1
    ;;
esac
