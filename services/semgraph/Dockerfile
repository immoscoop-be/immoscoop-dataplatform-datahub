# semgraph: one stateless container, internal only, behind the platform's login.
# Node runs the TypeScript sources directly (type stripping), so there is no build step.
FROM node:24.21.0-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
# A proxy CA can be passed as a build secret (docker build --secret id=npm_ca,src=ca.crt);
# without it the install runs as usual.
RUN --mount=type=secret,id=npm_ca \
    if [ -f /run/secrets/npm_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca; fi; \
    npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force

# Code and definitions stay owned by root; the service runs as the unprivileged user node.
COPY src ./src
COPY semgraphs ./semgraphs
COPY vocabulary ./vocabulary
COPY locales ./locales
COPY tokens ./tokens

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "src/server.ts"]
