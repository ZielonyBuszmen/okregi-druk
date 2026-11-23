#!/usr/bin/env bash
set -euo pipefail

# Źródła zostają na master. Na gh-pages trafia wyłącznie zawartość dist/.
project_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$project_directory"
deployment_branch="gh-pages"

for program in git node npm; do
  if ! command -v "$program" >/dev/null 2>&1; then
    printf 'Brakuje wymaganego programu: %s\n' "$program" >&2
    exit 1
  fi
done

if [[ "$(git branch --show-current)" != "master" ]]; then
  printf 'Uruchom publikację z gałęzi master.\n' >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  printf 'Najpierw zapisz zmiany źródeł w commicie. Katalog roboczy musi być czysty.\n' >&2
  exit 1
fi
if (( $(node -p 'Number(process.versions.node.split(".")[0])') < 22 )); then
  printf 'Wymagany jest Node.js 22 lub nowszy.\n' >&2
  exit 1
fi

remote_url="$(git remote get-url --push origin)"
source_commit="$(git rev-parse HEAD)"
author_name="$(git config user.name || true)"
author_email="$(git config user.email || true)"
if [[ -z "$author_name" || -z "$author_email" ]]; then
  printf 'Ustaw git config user.name oraz git config user.email przed publikacją.\n' >&2
  exit 1
fi

printf 'Instaluję zależności z package-lock.json i sprawdzam źródła.\n'
npm ci --ignore-scripts --no-audit --no-fund
npm run format:check
npm test

# Narzędzie budowy usuwa poprzednie dist/ i odtwarza je z aktualnych źródeł.
npm run build

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/okregi-deploy.XXXXXX")"
trap 'rm -rf -- "$temporary_directory"' EXIT
deployment_directory="$temporary_directory/site"
git init --quiet --initial-branch="$deployment_branch" "$deployment_directory"
git -C "$deployment_directory" config user.name "$author_name"
git -C "$deployment_directory" config user.email "$author_email"
git -C "$deployment_directory" remote add origin "$remote_url"

# Odczyt istniejącej gałęzi pozwala dopisywać commity bez wymuszonego push.
# Kod 2 oznacza brak gałęzi; inne błędy (np. sieci) przerywają publikację.
if git ls-remote --exit-code --heads "$remote_url" "refs/heads/$deployment_branch" >"$temporary_directory/remote-ref"; then
  git -C "$deployment_directory" fetch --quiet --depth=1 origin "$deployment_branch"
  git -C "$deployment_directory" reset --quiet --hard FETCH_HEAD
  # Zachowaj ewentualną własną domenę skonfigurowaną wcześniej na gh-pages.
  if [[ -f "$deployment_directory/CNAME" ]]; then
    cp -- "$deployment_directory/CNAME" "$temporary_directory/CNAME"
  fi
  git -C "$deployment_directory" rm --quiet -r --ignore-unmatch -- .
else
  remote_status=$?
  if (( remote_status != 2 )); then
    printf 'Nie udało się sprawdzić gałęzi gh-pages. Publikacja przerwana.\n' >&2
    exit "$remote_status"
  fi
fi

cp -R -- "$project_directory/dist/." "$deployment_directory/"
if [[ -f "$temporary_directory/CNAME" && ! -f "$deployment_directory/CNAME" ]]; then
  cp -- "$temporary_directory/CNAME" "$deployment_directory/CNAME"
fi
git -C "$deployment_directory" add --all

if git -C "$deployment_directory" diff --cached --quiet; then
  printf 'Gałąź gh-pages ma już identyczną aplikację. Brak zmian do wysłania.\n'
  exit 0
fi

git -C "$deployment_directory" commit --quiet \
  -m "Publikacja aplikacji z master (${source_commit:0:12})"
git -C "$deployment_directory" push origin "HEAD:refs/heads/$deployment_branch"
printf 'Gotowe. Wysłano aplikację na gh-pages. Źródła nadal są na master.\n'
