FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy workspace files
COPY package.json pnpm-workspace.yaml ./
RUN npm install -g pnpm

# Copy all packages
COPY artifacts/stack-dashboard ./artifacts/stack-dashboard
COPY lib ./lib

WORKDIR /workspace/artifacts/stack-dashboard
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM nginx:alpine
COPY --from=builder /workspace/artifacts/stack-dashboard/dist /usr/share/nginx/html
COPY docker/nginx-frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
