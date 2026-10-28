# AnythingLLM ↔ ChatGPT MCP bridge

A small, stateless MCP Streamable HTTP service that forwards a single read-only chat tool to one configured AnythingLLM workspace.

## Security model

- The MCP endpoint requires `Authorization: Bearer <BRIDGE_BEARER_TOKEN>`.
- The AnythingLLM API key stays on the server in an environment file/secret store. It is never sent to ChatGPT.
- The workspace slug is fixed in server configuration; callers cannot select another workspace.
- No document upload, delete, arbitrary URL fetch, shell, or GitHub-write tools are exposed.
- The bridge does not log prompts, tokens, or upstream response bodies.
- Use HTTPS in production. Keep the service bound to loopback behind a TLS reverse proxy.
- Treat AnythingLLM-retrieved text as untrusted; retrieval can contain prompt injection.

## Requirements

- Node.js 20+ (Docker recommended).
- A reachable, self-hosted AnythingLLM instance and an API key with permission to chat.
- The workspace slug. Find the exact API route and response fields in your instance at `https://YOUR-ANYTHINGLLM/api/docs`.

## Local development

```sh
cd anythingllm-mcp-bridge
cp .env.example .env
# Edit .env with real values; do not commit it.
npm install
npm test
npm start
```

Health check: `http://localhost:3000/healthz`.

MCP endpoint: `http://localhost:3000/mcp` (local testing only). MCP clients must send the bridge bearer token. Do not connect ChatGPT to plain HTTP on a public network.

## Verify against your AnythingLLM version

AnythingLLM API paths and response shape can vary by version. Before production, inspect `/api/docs` on your own instance and confirm:
- `POST /api/v1/workspace/{slug}/chat` accepts `{ "message": "...", "mode": "query" }`.
- The successful JSON response includes a string field such as `textResponse`.
- Your API key is authorized for the configured workspace.

If your version differs, update the upstream request/response mapping and add a regression test before deployment. Do not work around a failed auth check by disabling authentication.

## Docker deployment

1. Install Docker Engine and the Compose plugin on an Ubuntu LTS Lightsail instance.
2. Upload/clone this repository to the instance.
3. Create `.env` from `.env.example`; use a strong random bridge token and the real AnythingLLM API key.
4. Configure a TLS reverse proxy (Caddy or Nginx) for your domain to proxy HTTPS requests to `127.0.0.1:3000`. Do not expose port 3000 publicly.
5. Run:

   ```sh
   docker compose up -d --build
   docker compose ps
   curl -fsS http://127.0.0.1:3000/healthz
   ```

6. Configure Lightsail firewall to allow SSH only from your IP and public TCP 80/443 for TLS; do not open 3000 or AnythingLLM's internal port.
7. Set reverse-proxy authentication forwarding so the `Authorization` header reaches the bridge unchanged.

AnythingLLM should ideally run on the same host/private Docker network, not be exposed directly to the public internet. If it runs elsewhere, use a private network or HTTPS endpoint and restrict inbound access.

## MCP test

Use MCP Inspector or another Streamable HTTP MCP client against the HTTPS `/mcp` URL with bearer-token authentication. Verify initialize, tools/list, a successful workspace chat, missing/invalid auth (401), oversized/invalid inputs, and upstream timeout/failure handling.

## ChatGPT connection

Custom MCP support is plan/workspace dependent. ChatGPT's current Help Center says full custom MCP support is available for Business and Enterprise/Edu; Pro supports custom MCP servers with read/fetch permissions. Confirm your account/workspace permits the connection before spending time on production exposure.

In ChatGPT web, where permitted: Plugins → + → Add custom MCP server → HTTPS endpoint ending in `/mcp` → configure bearer authentication → review tool list → test `anythingllm_workspace_chat`. Do not enable write tools unless separately reviewed; this bridge intentionally exposes none.

## Tests and limitations

`npm test` covers environment validation and URL construction. It does not replace an integration test against a real AnythingLLM instance or a live ChatGPT MCP connection. Neither AWS deployment nor ChatGPT connection is performed by this repository commit.