#!/bin/bash
set -euo pipefail

APP=/root/fletch
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "node not found. Install Node 20 first:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
  echo "  apt-get install -y nodejs"
  exit 1
fi

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

sed -i "s|^ExecStart=.*|ExecStart=${NODE_BIN} ${APP}/scripts/serve.mjs|" "${APP}/deploy/fletch.service"
cp "${APP}/deploy/fletch.service" /etc/systemd/system/fletch.service
systemctl daemon-reload
systemctl enable --now fletch
systemctl restart fletch

cp "${APP}/deploy/nginx.conf" /etc/nginx/sites-available/fletch.cash
ln -sfn /etc/nginx/sites-available/fletch.cash /etc/nginx/sites-enabled/fletch.cash
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo
echo "FLETCH is up on 127.0.0.1:4663"
echo "After DNS A @ -> 212.58.187.34, run:"
echo "  certbot --nginx -d fletch.cash -d www.fletch.cash"
