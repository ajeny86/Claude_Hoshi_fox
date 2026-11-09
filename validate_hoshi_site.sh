#!/bin/sh
set -eu

site_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
pages="hoshi_chapters_1_2_3_4_bilingual_v1.html hoshi_part2_map_prototype.html"
sources="$pages hoshi_part2_app.js hoshi_core.js"
refs_file=$(mktemp)
trap 'rm -f "$refs_file"' EXIT HUP INT TERM

for source in $sources; do
  perl -nle 'while (/([A-Za-z0-9_.-]+\.(?:webp|png|jpe?g|js|html))/gi) { print $1 }' "$site_dir/$source"
done | sort -u > "$refs_file"

missing=0
while IFS= read -r ref; do
  case "$ref" in
    ''|http:*|https:*|data:*|'#'*) continue ;;
  esac
  if [ ! -f "$site_dir/$ref" ]; then
    printf 'Отсутствует файл: %s\n' "$ref" >&2
    missing=$((missing + 1))
  fi
done < "$refs_file"

duplicates=0
for page in $pages; do
  duplicate_ids=$(perl -nle 'while (/\bid="([^"]+)"/g) { print $1 }' "$site_dir/$page" | sort | uniq -d)
  if [ -n "$duplicate_ids" ]; then
    printf 'Повторяющиеся id в %s:\n%s\n' "$page" "$duplicate_ids" >&2
    duplicates=$((duplicates + 1))
  fi
done

if grep -Eiq 'plausible|umami|hoshiTrack' "$site_dir/hoshi_part2_app.js" "$site_dir/hoshi_chapters_1_2_3_4_bilingual_v1.html"; then
  printf 'Найден неиспользуемый код аналитики.\n' >&2
  exit 1
fi

if [ "$missing" -ne 0 ] || [ "$duplicates" -ne 0 ]; then
  exit 1
fi

printf 'Проверка пройдена: ссылки на файлы целы, повторяющихся id и фиктивной аналитики нет.\n'
