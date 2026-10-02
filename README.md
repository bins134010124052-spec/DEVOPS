# DEVOPS

## Node.js Web Application

This repository contains a Node.js REST API for product inventory, backed by SQLite and configured for Docker and GitHub Actions CI/CD deployment.

## Features

- Express.js product CRUD API with validation and unique SKU handling
- SQLite database persistence
- Health check endpoint at `/health`
- Logging through Winston and request logging via Morgan
- Docker support via `docker compose up --build`
- GitHub Actions CI workflow and Docker image deployment workflow
- Environment variable configuration using `.env`

## Project Structure

```text
.
├── src/
│   ├── api.js              # Express API and static frontend mounting
│   ├── server.js           # HTTP server entry point
│   └── public/
│       ├── index.html      # Vietnamese inventory interface
│       ├── catalog.js     # Browser-side product CRUD
│       └── styles.css
├── tests/
│   └── app.test.js
├── data/
│   └── .gitkeep
├── .env.example
├── .eslintrc.json
├── .dockerignore
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── README.md
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

## Local Setup

1. Use Node.js 22 or newer and install dependencies:

```bash
npm install
```

2. Copy the example environment file (PowerShell):

```bash
Copy-Item .env.example .env
```

3. Start the app:

```bash
npm start
```

4. Run tests:

```bash
npm test
```

5. Run lint:

```bash
npm run lint
```

## Docker

Docker Compose loads `.env` automatically when present; without it, the defaults below work. Build and run the app with:

```bash
docker compose up --build
```

The application will be available on:

```text
http://localhost:3001
```

## Product API

- `GET /health` — health check
- `GET /api/products` — list products
- `GET /api/products/:id` — get a product
- `POST /api/products` — create a product
- `PUT /api/products/:id` — replace a product
- `DELETE /api/products/:id` — delete a product (204 response)

Product fields: `name` and non-negative integer `price` in VND are required. `description`, `sku`, `category`, and non-negative integer `stock` are optional. SKU values must be unique. Existing USD prices are converted once at a fixed rate of 25,000 VND/USD during database initialization.

Example:

```bash
curl -X POST http://localhost:3001/api/products \
    -H "Content-Type: application/json" \
    -d '{"name":"Keyboard","price":2249750,"sku":"KEY-001","stock":12}'
```

## CI/CD

The repository includes GitHub Actions workflows:

- `.github/workflows/ci.yml` runs install, lint, tests, and `npm audit` on pushes and pull requests.
- `.github/workflows/deploy.yml` runs only after CI succeeds for a push to `main` and publishes the tested commit to GitHub Container Registry using the built-in `GITHUB_TOKEN`.

## Deployment

Create or sync the Render service from `render.yaml` and connect it to this GitHub repository. The Blueprint uses Render's Free plan, `/health` health checks, and `autoDeployTrigger: checksPass`, so Render deploys after the linked branch's CI checks pass. Free services spin down after 15 minutes without traffic and use an ephemeral filesystem; the SQLite database is lost on spin-down, restart, or redeploy. Render Free does not support persistent disks. No Render deploy-hook secret is needed. The GitHub Actions workflow publishes the tested image after successful CI for a push to `main`; configure GitHub branch protection and require pull requests if direct pushes must be prohibited. After deployment, verify `https://<render-service>.onrender.com/health`.

The workflow also publishes the tested commit to GHCR. Render builds and runs the repository's Dockerfile; the GHCR image is published as a container registry artifact.

## Notes

- Do not commit `.env` files or secret credentials.
- Use GitHub secrets for production values and deploy credentials.
