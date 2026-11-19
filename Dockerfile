# ---------- Stage 1: build ----------
FROM node:20-alpine AS build
WORKDIR /app
# Copy .npmrc BEFORE install so legacy-peer-deps applies during dependency resolution.
COPY package*.json .npmrc ./
# Use `npm ci` when a package-lock.json exists (reproducible); fall back to
# `npm install` on first build when the lockfile hasn't been generated yet.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

# ---------- Stage 2: serve ----------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/pmo-frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
