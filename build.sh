#!/usr/bin/env nix-shell
#! nix-shell -i bash -p yarn nodejs caddy
set -e

function publish() {
  cp -r ./public /var/www/blog/
  chown -R www-data /var/www/blog/
}

function develop() {
  echo "Visit: http://127.0.0.1:11451"
  
  if [ -x "$(command -v xdg-open)" ]; then
    xdg-open http://127.0.0.1:11451
  elif [ -x "$(command -v open)" ]; then # MacOS
    open http://127.0.0.1:11451
  fi

  caddy file-server --root public --listen :11451
}

while getopts "p:d" opt; do
  case "${opt}" in
    p)
      echo "publishing on kagura's server"
      git pull
      
      yarn install
      npx hexo generate

      publish
      ;;
    d)
      echo "Development mode"

      yarn install
      npx hexo generate

      develop
      ;;
  esac
done