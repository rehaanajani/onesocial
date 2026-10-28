# OneSocial

AI-powered social post generator. Describe what you want to share (optionally with an image), pick Instagram, LinkedIn and/or X, and OneSocial writes a platform-native caption and generates or edits an image for each one.

## How it works

`POST /api/generate` runs a three-stage pipeline:

1. **Analyse** — a vision model (Claude 3.5 Sonnet on Bedrock) reads your text and image and returns a structured brief.
2. **Engineer** — `services/promptEngineerService.js` turns the brief and your preferences (vibe, account type, image style, palette) into per-platform prompts.
3. **Generate** — captions (Claude 3.5 Haiku) and images (Amazon Nova Canvas) are produced in parallel for every platform.

If one platform fails the others are still returned, with the failure listed under `_warnings`.

## Getting started

```bash
npm install
cp .env.example .env   # add AWS credentials, or set AI_PROVIDER=mock
npm run dev            # API on :5000, Vite client on :5173
```

Set `AI_PROVIDER=mock` (or leave AWS keys empty) to run the full UI with stub captions and placeholder images, no AWS account needed.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `bedrock` | `bedrock` or `mock` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | — / — / `us-east-1` | Bedrock credentials |
| `BEDROCK_ANALYSIS_MODEL` | Claude 3.5 Sonnet | Stage 1 |
| `BEDROCK_CAPTION_MODEL` | Claude 3.5 Haiku | Captions |
| `BEDROCK_IMAGE_MODEL` | `amazon.nova-canvas-v1:0` | Images |
| `RATE_LIMIT_MAX` | `10` | Generate requests per minute per IP |
| `VITE_API_URL` | same origin | API base for the client |

## API

```http
POST /api/generate
Content-Type: application/json

{
  "content": "We just launched our new app",
  "platforms": ["instagram", "linkedin", "x"],
  "captionVibe": "excited",
  "accountType": "business",
  "imageAction": "generate_new",
  "primaryImage": null
}
```

Returns `{ "<platform>": { "caption": "...", "image": "<url or data URL>" } }`.

`GET /api/health` reports status, provider and rate limit.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (nodemon) and client (Vite) together |
| `npm start` | API only |
| `npm run build` | Production client build to `dist/` |
| `npm test` | API tests (mock mode, no AWS calls) |

## Deploying

`vercel.json` serves the Vite build as static files and routes `/api/*` to `api/index.js` as a serverless function.
