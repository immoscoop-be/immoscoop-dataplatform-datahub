# Proposal for the internal-tools platform: Claude reaches semgraph's MCP server

**For:** Ben Elsen (immoscoop-internal-tools) · **From:** the semgraph repository, 2026-10-05 · **Status:** proposal

Written in the form of the platform's ADRs, so it can become one. Nothing here has been changed in
`immoscoop-internal-tools`: the application side is built and tested (REQ-090 to REQ-093 in
[docs/requirements](../requirements/README.md)); the infrastructure side is yours to decide and do.

## Decision (proposed)

semgraph gets an MCP endpoint, `https://semgraph.<domain>/mcp`, that Claude (claude.ai, Desktop, mobile and Claude Code)
can reach. Users sign in with their **gate account (Cognito Pool 1)** through OAuth. The gate lets `/mcp` and its
metadata through **on the semgraph host only**, the way it lets `/n8n/api/v1/` through for n8n (ENG-1580): the
application checks the token itself. The rest of semgraph stays behind the gate.

## Why

- claude.ai calls a connector from Anthropic's cloud (egress `160.79.104.0/21`), not from the user's browser. It has
  no `gate_session` cookie, so the Lambda@Edge gate redirects it to the login page and the connection fails.
- An IP allowlist of Anthropic's range would let every Claude user in, not just ours.
- OAuth with the gate's own user pool keeps "only authenticated internal users" (ADR-018): every colleague signs in
  once in Claude with the account they already use for the platform.

## What the application already does (semgraph image)

- `POST /mcp`: Streamable HTTP without sessions; every answer is plain JSON (no event stream), so nothing streams
  through CloudFront. `GET`/`DELETE /mcp` give 405.
- Without a valid token: `401` with
  `WWW-Authenticate: Bearer resource_metadata="https://semgraph.<domain>/.well-known/oauth-protected-resource/mcp"`.
- `GET /.well-known/oauth-protected-resource/mcp` (and without `/mcp`): the protected resource metadata (RFC 9728),
  naming the Pool 1 issuer as authorization server.
- Token check, like the gate's but for an access token: RS256 against the issuer's JWKS (cached one hour), `iss`,
  `token_use=access`, `client_id` in the allowed list, `exp`, and the scope if one is configured.
- **Fail closed:** without configuration `/mcp` answers `503`; an incomplete configuration stops the container from
  starting. `/healthz` reports `mcp: "off" | "open" | "oauth"`.
- No secrets: the client is public, the JWKS is public.

## What the platform would do

1. **Cognito Pool 1** (`AuthEnvStack`, dev and prod):
   - a Cognito domain (managed login), so there is an `/oauth2/authorize` and `/oauth2/token`. ADR-003 rejected
     the Hosted UI *for the gate* (the redirect is not seamless). For signing in a connector once, it is acceptable,
     but it is a new decision;
   - a resource server `semgraph` with scope `semgraph/mcp`;
   - a **public** app client `claude-mcp-semgraph` (no secret): authorization code grant with PKCE (S256), scopes
     `openid` and `semgraph/mcp`, refresh tokens on;
   - callback URLs `https://claude.ai/api/mcp/auth_callback` (claude.ai, Desktop, mobile) and
     `http://localhost:33418/callback` (Claude Code with a fixed `--callback-port 33418`: Cognito matches callback
     URLs exactly, including the port).
2. **Gate** (`lambda/gate/handler.ts`): a bypass on host `semgraph.<domain>` only (ADR-022: host + path, never path
   alone) for `/mcp` and the prefix `/.well-known/oauth-protected-resource`.
3. **WAF** (`lib/platform/edge-stack.ts`), on the semgraph host:
   - `SizeRestrictions_BODY` to Count for `/mcp`, and also for `/render` and `/validate`. The CommonRuleSet blocks
     bodies over 8 KB. A block takes about 50 bytes, so daily values over a year (about 17 KB) or a long query in
     `meta.query` (up to 10,000 characters) pass that limit, on `/render` today already.
   - The SQLi and XSS body rules to Count or scoped down for those paths: `meta.query` carries the SQL that fetched
     the data, by design (REQ-010, REQ-093).
   - The application limits itself: 1 MB, every body checked against a strict JSON Schema
     (`additionalProperties: false`), and no query is ever run.
   - Optionally a rate-based rule on `/mcp`.
4. **Registry** (`lib/workloads/alb-service/registry.ts`, the semgraph entry), `extraEnv` per environment:

   ```text
   MCP_AUTH_ISSUER=https://cognito-idp.eu-central-1.amazonaws.com/<UserPool1Id>
   MCP_AUTH_CLIENT_IDS=<client id of claude-mcp-semgraph>
   MCP_RESOURCE_URL=https://semgraph.internal-immoscoop.be/mcp      (dev: https://semgraph.dev.internal-immoscoop.be/mcp)
   MCP_AUTH_SCOPE=semgraph/mcp
   ```

   The container fetches the JWKS from `cognito-idp.eu-central-1.amazonaws.com`: through the NAT gateway, or the
   `cognito-idp` interface endpoint if it serves the JWKS too (to check).

## Order, so nothing is ever open

1. Deploy the semgraph image with MCP: without configuration `/mcp` answers 503.
2. Create the domain, resource server and client; set the env; redeploy. `/healthz` gives `mcp: "oauth"`.
3. Only then the gate bypass and the WAF changes. Check:
   - `curl -i -X POST https://semgraph.dev.internal-immoscoop.be/mcp` gives `401` with the `WWW-Authenticate`
     header above;
   - `curl https://semgraph.dev.internal-immoscoop.be/.well-known/oauth-protected-resource/mcp` gives the metadata.
4. Add the connector in Claude (below) on dev first, then prod.

## To check in a spike

- Claude reads the authorization server's metadata from the issuer (OpenID discovery at
  `<issuer>/.well-known/openid-configuration`). Claude requires PKCE S256; if Cognito's document does not advertise
  `code_challenge_methods_supported`, Claude may refuse. Fallback without code changes: serve an RFC 8414 document
  elsewhere and point `MCP_AUTHORIZATION_SERVER` at it (the application then names that as authorization server).
- Claude gives OAuth endpoints 10 seconds (30 for a refresh) and needs a `401`, not a redirect, to start signing in:
  the gate bypass must cover `/mcp`, or the gate's 302 to its login page breaks the flow.

## Then, in Claude

- **An Owner of the Claude organization:** Organization settings → Connectors → Add → Custom → Web. URL
  `https://semgraph.internal-immoscoop.be/mcp`; OAuth client: "Use your own OAuth client" with the client id, secret
  empty.
- **Every colleague:** Customize → Connectors → semgraph → Connect, and sign in with the gate account. Who has no
  gate account yet gets one with `scripts/invite-gate-user.sh`.
- **Claude Code:**
  `claude mcp add --transport http --client-id <client id> --callback-port 33418 semgraph https://semgraph.internal-immoscoop.be/mcp`.

## Rejected

- **No sign-in plus an IP allowlist of Anthropic's range**: every Claude user worldwide calls from that range.
- **One shared API key in a header**: Claude's "Request headers" for custom connectors is a beta for a limited set
  of organizations; one key for everyone, nobody's own identity.
- **MCP tunnels**: Enterprise plan only and a research preview; the server still needs OAuth behind it.
