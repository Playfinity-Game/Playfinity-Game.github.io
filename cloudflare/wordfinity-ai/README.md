# Wordfinity Cloudflare Worker

This Worker serves all four game endpoints:

- `POST /api/similarity` — BGE-M3 cosine similarity for ranking.
- `POST /api/hints` — AI-generated candidate words, ranked with BGE-M3.
- `POST /api/category` — AI-generated free-form German category.
- `POST /api/word` — AI-generated German target word.
- `GET /health` — health check.

The existing public Worker name and URL remain `wordfinity-ai`. The TikTok connector and Render service are not involved.

## One-time deployment connection

The repository workflow deploys this Worker automatically after changes reach `main`. It needs two GitHub Actions repository secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Create a Cloudflare API token with permission to edit Workers Scripts for the account (and the account-level permissions required by Wrangler to deploy Workers AI bindings). Add both values under the repository's **Settings → Secrets and variables → Actions**. No Worker source code needs to be pasted into the Cloudflare editor.

After the secrets exist, merge the setup pull request. The workflow will deploy automatically. You can also run **Actions → Deploy Wordfinity Cloudflare Worker → Run workflow** to redeploy manually.

The Worker uses the existing Workers AI binding name `AI`, with model IDs `@cf/google/gemma-4-26b-a4b-it` for text generation and `@cf/baai/bge-m3` for embeddings.
