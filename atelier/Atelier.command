#!/bin/sh
# Lanceur Mac de l'atelier du plateau : ouvre index.html dans sa propre fenetre (Chrome ou Edge s'ils sont
# installes), sinon dans le navigateur par defaut (Safari). Rien n'est installe, rien n'est envoye sur Internet.
DOSSIER="$(cd "$(dirname "$0")" && pwd)"
PAGE="$DOSSIER/index.html"
if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="file://$PAGE"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="file://$PAGE"
else
  open "$PAGE"
fi
