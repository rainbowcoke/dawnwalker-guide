#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_ID:?A release ID is required}"
: "${REPOSITORY:?A repository name is required}"
: "${PAGES_CONTAINER:=local-pages}"
[[ "$RELEASE_ID" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid release ID'; exit 1; }
site_name="${REPOSITORY##*/}"
[[ "$site_name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { echo 'Invalid site name'; exit 1; }
command -v docker >/dev/null
test -S /var/run/docker.sock
for required in index.html sitemap.xml css/site.css js/app.js assets/guide-data.js assets/data/search-index.json assets/vendor/guide-ui.js; do
  test -s "dist/$required" || { echo "Missing built website file: dist/$required" >&2; exit 1; }
done

# Discover the existing Pages mount rather than storing server paths in Git.
publish_root=$(docker inspect --format '{{range .Mounts}}{{if and (eq .Destination "/usr/share/nginx/html") (eq .Type "bind")}}{{.Source}}{{end}}{{end}}' "$PAGES_CONTAINER")
test -n "$publish_root" || { echo 'Pages requires a bind mount at /usr/share/nginx/html.' >&2; exit 1; }

# Transfer only public website files into a complete release before switching.
tar -C dist -cf - . | docker run --rm -i --network none \
  --mount "type=bind,source=$publish_root,target=/publish" \
  --env RELEASE_ID="$RELEASE_ID" --env SITE_NAME="$site_name" nginx:stable-alpine sh -eu -c '
    release_root="/publish/.pages-releases/$SITE_NAME"
    mkdir -p "$release_root"
    # A retry must not modify a release already being served.
    release=$(mktemp -d "$release_root/$RELEASE_ID.XXXXXX")
    link="/publish/.pages-$SITE_NAME-${release##*/}"
    activated=false
    cleanup() {
      case "$link" in /publish/.pages-"$SITE_NAME"-*) ;; *) return 1 ;; esac
      if [ -L "$link" ]; then
        printf "Delete temporary link: %s\n" "$link"
        rm -- "$link"
      fi
      if [ "$activated" = false ]; then
        case "$release" in "$release_root"/"$RELEASE_ID".*) ;; *) return 1 ;; esac
        test "$release" != "$release_root"
        echo "Files to delete from failed release:"
        find "$release" -type f -print
        find "$release" -type f -exec rm -- {} \;
        find "$release" -depth -type d -exec rmdir -- {} \;
      fi
    }
    trap cleanup EXIT
    tar -xf - -C "$release"
    test -f "$release/index.html"
    test -s "$release/assets/guide-data.js"
    chmod -R a+rX "$release"
    destination="/publish/$SITE_NAME"
    if [ -e "$destination" ] && [ ! -L "$destination" ]; then
      echo "The destination exists as a real directory; refusing to replace it."
      exit 1
    fi
    ln -s ".pages-releases/$SITE_NAME/${release##*/}" "$link"
    mv -Tf "$link" "$destination"
    activated=true
  '

# Verify through the actual web server without publishing another host port.
for resource in '' sitemap.xml equipment/ skills/ consumables/ quests/ css/site.css js/app.js assets/guide-data.js assets/data/search-index.json assets/vendor/guide-ui.js; do
  docker exec "$PAGES_CONTAINER" wget -q -O /dev/null "http://127.0.0.1/$site_name/$resource"
done
echo "Published /$site_name/ successfully."
