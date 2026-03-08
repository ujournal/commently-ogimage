# commently-ogimage

Cloudflare Worker для генерації OG-зображень (PNG) для посилань.

## Параметри

- `title` — заголовок
- `siteName` або `site_name` — назва сайту
- `url` або `link` — посилання

Приклад: `/?title=Стаття&siteName=Мій блог&url=https://example.com`

## Запуск

```bash
npm install
npm start    # локально (wrangler dev)
npm run deploy   # деплой на Cloudflare
```
