# Web — Next.js deliberation room (pure renderer of the event stream).
# Build context is the repo root (see azure.yaml service "web").
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# The backend URL is inlined at build time (Next.js NEXT_PUBLIC_*). azd passes it as a
# build arg from the provisioned backend FQDN (azure.yaml -> docker.buildArgs).
ARG NEXT_PUBLIC_API_BASE=""
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./next.config.mjs
# Run as the built-in non-root 'node' user (defense-in-depth).
USER node
EXPOSE 3000
CMD ["sh", "-c", "npx next start -p ${PORT}"]
