FROM node:22 AS build
WORKDIR /app

# 依赖层单独缓存；宿主机 node_modules 由 .dockerignore 排除
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.29-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
