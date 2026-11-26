FROM node:24-alpine AS build
WORKDIR /work
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /work/dist /srv
COPY infra/web/Caddyfile infra/web/Caddyfile.local infra/web/site.caddy /etc/caddy/
