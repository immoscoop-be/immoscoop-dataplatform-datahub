# One image per service, from one Dockerfile (TR-PF-15):
#   docker build --build-arg SERVICE=catalogue -t catalogue .
# Builds the whole workspace once, then copies only the chosen service and its production
# dependencies into a small runtime image that runs as a non-root user.

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
ARG SERVICE
RUN test -n "$SERVICE" || (echo "Pass --build-arg SERVICE=<name>" && exit 1)
RUN pnpm --filter "@datahub/${SERVICE}" deploy --prod /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 8080
CMD ["node", "dist/main.js"]
