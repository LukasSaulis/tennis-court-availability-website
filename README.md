# Tennis Court Availability

## Website

Built by [Lukas Saulis](https://www.instagram.com/lukas.saulis/) — a finance bro and high-level tennis player based in London. If you're playing ITF tournaments in Europe or looking for a hitting partner in London, reach out on Instagram.

A web app that shows real-time tennis court availability across London parks. It scrapes ClubSpark booking pages for dozens of venues and displays a filterable availability grid, so you can quickly find a free court.

## Stack

- **React + Vite** — frontend UI
- **Hono** — API routing
- **Cloudflare Workers** — serverless backend that scrapes and aggregates ClubSpark availability

## Development

```bash
npm install
npm run dev        # http://localhost:5173
```

## Deploy

```bash
npm run build && npm run deploy
```
