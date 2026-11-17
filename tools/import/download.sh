#!/usr/bin/env bash
# Telecharge un gros fichier en N morceaux paralleles, chacun repris la ou il s'est arrete
# (archive.org coupe les connexions longues : un flux unique de 12,6 Go est mort a 55 %).
# Usage : tools/import/download.sh <url> <fichier de sortie> [morceaux=8]
set -u
# Arreter le script arrete aussi ses boucles et leurs curl : sinon ils continuent d'ecrire
# dans les morceaux (17/11/2026 : un 2e essai a melange ses octets avec ceux du 1er).
trap 'trap - TERM; kill 0' INT TERM
URL=$1; OUT=$2; N=${3:-8}
UA="marque-page/0.1 (github.com/Lxcyd/marque-page)"
SIZE=$(curl -sIL -A "$UA" "$URL" | grep -i '^content-length' | tail -1 | tr -dc 0-9)
[ -n "$SIZE" ] || { echo "taille inconnue"; exit 1; }
PART=$(( (SIZE + N - 1) / N ))

fetch() { # morceau i : octets [a, b]
  local i=$1 a=$(( $1 * PART )) b=$(( ($1 + 1) * PART - 1 ))
  (( b >= SIZE )) && b=$(( SIZE - 1 ))
  local f="$OUT.part$i" want=$(( b - a + 1 ))
  touch "$f"
  for try in $(seq 1 200); do
    local have=$(stat -c %s "$f")
    (( have >= want )) && return 0
    curl -s -A "$UA" --max-time 1800 -r "$(( a + have ))-$b" "$URL" >> "$f"
    sleep 2
  done
  echo "morceau $i : abandon"; return 1
}

for i in $(seq 0 $(( N - 1 ))); do fetch "$i" & done
wait
for i in $(seq 0 $(( N - 1 ))); do cat "$OUT.part$i"; done > "$OUT"
[ "$(stat -c %s "$OUT")" = "$SIZE" ] && rm -f "$OUT".part* && echo "ok $SIZE octets" || { echo "taille incorrecte"; exit 1; }
