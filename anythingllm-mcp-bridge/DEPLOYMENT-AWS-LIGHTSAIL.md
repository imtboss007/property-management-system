# AWS Lightsail deployment checklist

This file documents the deployment; it does not provision AWS resources.

- [ ] Create Ubuntu LTS Lightsail instance and attach static IP.
- [ ] Restrict SSH (22/tcp) to your current IP in Lightsail firewall.
- [ ] Point a domain DNS A record at the static IP.
- [ ] Install Docker Engine and Docker Compose plugin from their official instructions.
- [ ] Deploy AnythingLLM on the same host/private Docker network, or configure a private HTTPS upstream.
- [ ] Create a dedicated AnythingLLM API key and confirm the workspace slug via `/api/docs`.
- [ ] Copy `.env.example` to `.env`; generate `BRIDGE_BEARER_TOKEN` using a cryptographically secure random generator; fill in the AnythingLLM API key and workspace slug.
- [ ] Configure Caddy/Nginx TLS reverse proxy for the domain → `127.0.0.1:3000`.
- [ ] Ensure the reverse proxy forwards `Authorization` and rejects oversized requests.
- [ ] Open only 80/443 publicly; do not open port 3000 or the AnythingLLM application port.
- [ ] Run tests and container health check; inspect logs for errors without printing secrets.
- [ ] Test MCP initialize, tool discovery, valid chat, missing token, wrong token, invalid input and upstream failure.
- [ ] Back up configuration securely; never store the real `.env` in GitHub.
- [ ] Only then add the HTTPS endpoint to ChatGPT, if the account/workspace plan supports custom MCP.
- [ ] Re-test after every bridge or AnythingLLM upgrade.

Rollback: stop the bridge with `docker compose down`; this does not delete AnythingLLM data. Keep the previous image/build available until a release is verified.