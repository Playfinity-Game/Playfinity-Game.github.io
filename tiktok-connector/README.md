# PLAYFINITY TikTok Connector (Review build)

Separate Node.js service. It does not modify or replace the PLAYFINITY GitHub Pages website.

## Render settings

- Runtime: Node
- Branch: `review/tiktok-connector-server`
- Root Directory: `tiktok-connector`
- Build Command: `npm install`
- Start Command: `npm start`
- Instance: Free for initial testing only

Set the environment variable:

- `ALLOWED_ORIGINS` = `https://playfinity-game.github.io`

The service listens on Render's `PORT` environment variable.

## API

Health check:

- `GET /health`

Start a public TikTok LIVE connection:

- `POST /api/connect`
- JSON body: `{"username":"@creatorname"}`
- Browser Origin must be included in `ALLOWED_ORIGINS`.

The response returns a short-lived random WebSocket path. Connect to that path using `wss://YOUR-RENDER-SERVICE/ws/TOKEN`.

Events are sent as JSON messages. Supported normalized event types include `chat`, `gift`, `like`, `follow`, `share`, `member`, and `roomUser`.

A stream session is shared for the same username to avoid opening duplicate TikTok connections. When its last browser client disconnects, the TikTok connection is closed after 30 seconds.

## Important limitations

- TikTok LIVE access here uses an unofficial reverse-engineered protocol, not an official TikTok API. TikTok can change it at any time.
- Public LIVE streams are read-only. This service does not send chat messages or request TikTok passwords/cookies.
- Render Free may sleep while idle and is not a guaranteed always-on host.
- The upstream `tiktok-live-connector` dependency is licensed under AGPL-3.0-only. Review its license and the source-disclosure obligations before using this network service commercially.
- This is an initial integration backend only. The PLAYFINITY menu and game-event mapping have not been changed or connected yet.

## Local development

```bash
npm install
ALLOWED_ORIGINS=http://localhost:5173 npm start
```
