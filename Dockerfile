FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml /app/
RUN pnpm install --frozen-lockfile && pnpm store prune
COPY . /app
CMD pnpm serve --host
EXPOSE 8080
