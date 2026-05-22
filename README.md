<h1 align="center">Ecommerce Visual Generator</h1>

<p align="center">面向跨境电商与台湾电商的商品图生成工具，集成 OpenAI 兼容图像接口，支持白底主图、信息图、细节图、生活场景图等方案，内置用户积分制与管理后台，支持 Docker 自托管部署。</p>

## 快速开始

### Docker 运行

```bash
git clone https://github.com/<your-account>/<your-repo>.git
cd <your-repo>
cp .env.example .env
# 编辑 .env，填写 DATABASE_URL、POSTGRES_* 等变量
docker compose up -d --build
```

- 前台页面：`http://localhost:3000`
- 管理后台：`http://localhost:3000/admin`
- 数据库：内置 PostgreSQL 17，数据持久化至 `postgres_data` 卷
- 生成图片：持久化至 `generated_images` 卷

`DATABASE_URL` 中的主机名请写 `postgres`（docker-compose 网络内的服务名），例如：

```
DATABASE_URL=postgresql://myuser:mypassword@postgres:5432/mydb
```

### 本地开发

```bash
npm install
cp .env.example .env
# 编辑 .env，填写 DATABASE_URL 指向本地 PostgreSQL
npm run db:migrate
npm run dev
```

### 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `IMAGE_API_BASE` | 否* | OpenAI 兼容 Image API 根地址（如 `https://xxx/v1`） |
| `IMAGE_API_KEY` | 否* | 图像生成 API Key |
| `IMAGE_MODEL` | 否* | 模型名称（如 `gpt-image-1`、`dall-e-3`） |
| `POSTGRES_DB` | 仅 docker-compose | 内置 PostgreSQL 初始化数据库名 |
| `POSTGRES_USER` | 仅 docker-compose | 内置 PostgreSQL 用户名 |
| `POSTGRES_PASSWORD` | 仅 docker-compose | 内置 PostgreSQL 密码 |

\* 标注"否"的 `IMAGE_*` 变量也可不填，先启动站点后到 **管理后台 → 系统设置 → 图像生成接口** 中配置，数据库配置优先于环境变量。

## 功能

### 用户前台

- 商品图上传与预览
- 默认 3 种图片方案：白底主图、信息图、细节图，可选生活场景图
- 中英双语文案
- 生成历史与积分管理
- Prompt 模式（无需 API Key）

### 管理后台

- 用户管理：列表、启用/停用、积分调整
- 系统设置：登录赠送积分、图像生成接口配置（`IMAGE_API_BASE` / `IMAGE_API_KEY` / `IMAGE_MODEL`）
- 对象存储：支持 S3 / R2 / OSS / COS，启用后新生成图片自动上传
- 接口日志与系统日志

### 图像生成

- 兼容 `POST /v1/images/edits`（有商品图时）
- 兼容 `POST /v1/images/generations`（无商品图时）
- 支持通过管理后台动态切换 API 地址、Key、模型

### 存储后端

- **本地存储**（默认）：图片保存到 `public/generated`，Docker 部署时挂载数据卷
- **对象存储**：在管理后台启用并配置 Endpoint / Bucket / Access Key 后，新生成图片自动上传

## 管理员操作

```bash
# Docker 环境
docker compose exec app npm run admin:list
docker compose exec app npm run admin:promote -- <手机号>
docker compose exec app npm run admin:demote  -- <手机号>
docker compose exec app npm run admin:enable  -- <手机号>
docker compose exec app npm run admin:disable -- <手机号>

# 本地环境
npm run admin:list
npm run admin:promote -- <手机号>
```

## 常见问题

**Q：`docker compose up` 后 502 / 连不上数据库**
A：`.env` 中 `DATABASE_URL` 的主机名必须写 `postgres`（docker-compose 服务名），不能写 `localhost`。

**Q：登录后被踢回登录页**
A：反向代理需透传 `Host` 和 `X-Forwarded-Proto` 头，否则会话 Cookie 丢失。

**Q：图像生成返回"配置不完整"**
A：到管理后台 → 系统设置 → 图像生成接口，填写 `IMAGE_API_BASE`、`IMAGE_API_KEY`、`IMAGE_MODEL` 并保存。

**Q：容器重启后生成图片消失**
A：docker-compose 已挂载 `generated_images` 卷；若直接 `docker run` 需自行挂载 `/app/public/generated`，或启用对象存储。
