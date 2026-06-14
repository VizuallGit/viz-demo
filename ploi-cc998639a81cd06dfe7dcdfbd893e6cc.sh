#!/bin/bash

set -e
if echo ""Initial commit"" | grep -qF "[BOT]"; then
    echo "Auto-commit - ingen deploy nodvendig."
    exit 0
fi

cd /home/ploi/viz-demo.vizdev.dk

if [ ! -f artisan ]; then
    echo "=== Forste installation ==="

    rm -rf /tmp/statamic-new
    composer create-project statamic/statamic /tmp/statamic-new --prefer-dist --no-interaction
    rsync -a --exclude='.git' /tmp/statamic-new/ .
    rm -rf /tmp/statamic-new

    cp .env.example .env
    sed -i "s|APP_URL=.*|APP_URL=https://viz-demo.vizdev.dk|g" .env
    sed -i "s|APP_ENV=.*|APP_ENV=production|g" .env
    php artisan key:generate --force

    composer config repositories.starter-kit '{"type":"vcs","url":"https://github.com/VizuallGit/vizuall-starter-kit"}'
    composer config minimum-stability dev
    composer config prefer-stable true
    php please starter-kit:install vizuallgit/vizuall-starter-kit:dev-main --without-user --no-interaction

    npm install
    npm run build
    npm run cp:build

    php please make:user "admin@viz-demo.vizdev.dk" \
        --password="ChangeMe123!" \
        --super \
        --no-interaction

    REMOTE_URL=$(git remote get-url origin)
    AUTH_URL=$(echo "$REMOTE_URL" | sed "s|https://github.com/|https://x-access-token:${GITHUB_TOKEN}@github.com/|")
    git remote set-url origin "$AUTH_URL"

    echo "ploi-*.sh" >> .gitignore
    git rm --cached ploi-*.sh 2>/dev/null || true
    git add -A
    git commit -m "Initial install: viz-demo.vizdev.dk [BOT]"
    git push --force -u origin main

else
    echo "=== Opdatering ==="

    git pull origin main
    composer install --no-interaction --no-dev --prefer-dist --optimize-autoloader
    npm install
    npm run build
    npm run cp:build
    php artisan statamic:stache:warm

fi

php artisan cache:clear
php artisan config:clear

echo "=== Deploy faerdig ==="