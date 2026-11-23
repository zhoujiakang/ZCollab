# ZCollab

## 这是什么

ZCollab 是单机版文档协作系统：以工作区为单位管理页面树，支持多人实时协同编辑、全文搜索、分享链接与评论。后端是 Spring Boot 3.5 + PostgreSQL + Redis，前端是 React + Vite + TypeScript，适合个人或小团队自托管。

## 本地开发

前置：PostgreSQL 17、Redis、JDK 21、Node 22。先建好 zcollab 数据库与用户，按 `server/sql/001~012` 顺序建表；`application.yml` 默认连本机 5432/6379。

服务端：

```bash
cd server && ./mvnw spring-boot:run
```

Windows 用 `mvnw.cmd`。Maven 必须运行在 JDK 21 上：Maven 自身用哪个 JDK 由 `JAVA_HOME` 决定，不要用 JDK 27 —— Lombok 在新 JDK 上注解处理会静默失效，报错是一屏「找不到符号 getXxx」，看起来像代码被改坏了。

前端：

```bash
cd client && npm install && npm run dev
```

开发时访问 http://localhost:5173，Vite proxy 把 `/api`、`/files`、`/collab`（含 WebSocket）转发到 8080，前端请求保持相对路径，不做 CORS。

## 目录结构

- `client/`：前端源码、Vite 构建配置、Dockerfile 与容器内 nginx 配置。
- `server/`：Spring Boot 后端、SQL 建表脚本与 Dockerfile。

## Docker 部署

前置：安装 Docker Desktop（或 Docker + Compose 插件）。首次启动会拉取镜像，需要联网。

```bash
docker compose up -d --build
```

首次启动会由 `docker-entrypoint-initdb.d` 自动按 001~012 顺序建表；随后访问 http://localhost:8080，第一次进站先注册账号。之后改了代码，重新执行同一条命令（带 `--build`）即可。

停止但保留数据用 `docker compose down`；连数据库和上传文件一起清空用 `docker compose down -v`。db、redis 与 api 都不映射宿主机端口（api 只走 compose 内网由 nginx 反代）。web 默认 8080；如果本机 8080 已被开发实例占用，执行 `cp .env.example .env` 并在 .env 里改 WEB_PORT。默认密码只用于本机试跑，对外网开放前必须在 .env 里改 POSTGRES_PASSWORD。

注意：

1. 用 IP 或域名访问时设 `COLLAB_ALLOWED_ORIGINS`，例如 `http://203.0.113.10:8080`；不设就只有 localhost 能协同。
2. initdb 只在空数据卷时执行；以后新增迁移脚本不会自动跑，需要手动 `psql` 执行。

数据库用户名必须是 `zcollab`：`server/sql/001` 开头是 `\set app_user zcollab`，后面每个脚本都 GRANT 给这个角色。想换用户名得改脚本，容器方案里不要换。
