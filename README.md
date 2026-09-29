# DEVOPS

## Node.js Web Application

This repository contains a small Node.js REST API for managing items, containerized with Docker and configured for CI/CD deployment.

## Features

- Express.js REST API with CRUD endpoints
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
│   ├── app.js
│   └── server.js
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

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file:

```bash
cp .env.example .env
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

Build and run the app with Docker Compose:

```bash
docker compose up --build
```

The application will be available on:

```text
http://localhost:3000
```

## API Endpoints

- `GET /health` — health check
- `GET /api/items` — list all items
- `POST /api/items` — create item
- `PUT /api/items/:id` — update item
- `DELETE /api/items/:id` — delete item

## CI/CD

The repository includes GitHub Actions workflows:

- `.github/workflows/ci.yml` runs lint and tests on pushes and pull requests.
- `.github/workflows/deploy.yml` runs only after CI succeeds for a push to `main`, builds the exact tested commit, pushes it to GitHub Container Registry, and triggers a Render deploy.

Add this repository secret in GitHub:

- `RENDER_DEPLOY_HOOK` — the deploy hook URL for the Render web service.

## Deployment

Create the Render service from `render.yaml` and connect it to this GitHub repository. The Blueprint provisions a Docker web service with a persistent disk for SQLite and `/health` health checks. The Starter plan and persistent disk require a paid Render account. Add the service's deploy hook URL as the `RENDER_DEPLOY_HOOK` GitHub Actions secret, then push or merge to `main`. After deployment, verify `https://<render-service>.onrender.com/health`.

The workflow also publishes the tested commit to GHCR. Render builds and runs the repository's Dockerfile; the GHCR image is published as a container registry artifact.

## Notes

- Do not commit `.env` files or secret credentials.
- Use GitHub secrets for production values and deploy credentials.
