# 多平台作业通知自动整理与提醒系统

## 项目背景

大学课程作业通知经常分散在钉钉、QQ群、学习通等不同平台，学生需要反复切换应用查看消息，容易遗漏作业内容、截止时间和提交方式。本项目希望通过 AI 自动识别和统一作业列表，把分散的作业通知整理成清晰的学习任务清单，帮助学生更稳定地管理课程任务。

## 项目目标

实现一个本地可运行的网页系统，支持作业通知录入、AI 自动识别、作业列表管理和任务状态维护。老师下载项目后，可以通过 `npm install` 和 `npm start` 启动系统，在浏览器中完成主要功能体验。

## 已实现功能

- 作业统计：全部、待完成、已完成、待确认
- 统一作业列表
- 手动添加作业
- AI 识别并填入表单
- 平台消息接入测试
- DeepSeek API 自动识别作业通知
- 编辑作业
- 删除作业
- 标记完成 / 恢复待完成
- 按来源平台筛选
- 按状态筛选
- 本地 JSON 数据保存
- `.env` 环境变量配置

## 技术栈

- Node.js
- Express
- HTML
- CSS
- JavaScript
- DeepSeek API
- JSON 文件本地存储

## 本地运行方式

1. 安装依赖：

```bash
npm install
```

2. 创建环境变量文件：

```bash
cp .env.example .env
```

3. 在 `.env` 中填写 `DEEPSEEK_API_KEY`。如果暂时不填写，系统仍会使用本地备用识别逻辑运行。

4. 启动项目：

```bash
npm start
```

5. 浏览器打开：

```text
http://localhost:3000
```

## Render 部署方式

1. 将项目代码提交到 GitHub 仓库。

2. 登录 [Render](https://render.com)，创建新的 Web Service，并选择该 GitHub 仓库。

3. Render 服务配置建议如下：

```text
Environment: Node
Build Command: npm install
Start Command: npm start
```

4. 在 Render 的 Environment Variables 中配置环境变量：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

如果暂时不配置 `DEEPSEEK_API_KEY`，系统仍可启动，并使用本地备用识别逻辑。

5. 部署完成后，打开 Render 分配的公网地址即可访问系统。

注意：当前版本使用 `data/homeworks.json` 作为本地 JSON 存储。Render 免费实例的文件系统不适合作为长期稳定数据库，服务重建后数据可能丢失。期末作业演示可以正常使用，后续正式版本建议替换为数据库。

## 环境变量说明

```text
DEEPSEEK_API_KEY=DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DINGTALK_TOKEN=钉钉机器人 Token
DINGTALK_AES_KEY=钉钉机器人 EncodingAESKey
DINGTALK_OWNER_KEY=钉钉企业或应用标识
DINGTALK_CLIENT_ID=钉钉应用 Client ID
DINGTALK_CLIENT_SECRET=钉钉应用 Client Secret
```

说明：

- `DEEPSEEK_API_KEY`：DeepSeek API 密钥，不能写进代码或提交到仓库。
- `DEEPSEEK_BASE_URL`：DeepSeek API 地址，默认使用 `https://api.deepseek.com`。
- `DEEPSEEK_MODEL`：使用的模型名称，默认使用 `deepseek-chat`。
- `DINGTALK_TOKEN`：钉钉 HTTP 回调加解密使用的 Token。
- `DINGTALK_AES_KEY`：钉钉 HTTP 回调加解密使用的 EncodingAESKey。
- `DINGTALK_OWNER_KEY`：钉钉回调加密消息中的企业或应用标识。
- `DINGTALK_CLIENT_ID`：钉钉 Stream 模式使用的应用 Client ID，通常对应应用的 AppKey。
- `DINGTALK_CLIENT_SECRET`：钉钉 Stream 模式使用的应用 Client Secret，通常对应应用的 AppSecret。

## 项目结构说明

```text
.
├── data/
│   └── homeworks.json       # 本地作业数据文件
├── public/
│   ├── index.html           # 前端页面结构
│   ├── script.js            # 前端交互逻辑
│   └── style.css            # 页面样式
├── .env.example             # 环境变量示例
├── .gitignore               # 忽略 .env、node_modules 等文件
├── package.json             # 项目依赖和启动脚本
├── package-lock.json        # 依赖版本锁定文件
├── README.md                # 项目说明文档
├── dingtalk-stream.js       # 钉钉 Stream 模式接入脚本
└── server.js                # Express 后端服务和接口
```

## 钉钉接入说明

项目保留了 HTTP webhook 测试接口：

```text
GET /webhook/dingtalk
POST /webhook/dingtalk
```

该接口主要用于本地页面测试、ngrok 测试以及普通 HTTP 消息接入验证。由于钉钉 HTTP 模式需要公网回调地址、Token、EncodingAESKey 和加密校验，真实机器人接入推荐使用钉钉 Stream 模式。

Stream 模式不需要注册公网回调地址。配置 `.env` 后，单独启动 Stream 客户端：

```bash
npm run dingtalk-stream
```

如果需要同时使用网页系统和钉钉 Stream 机器人，建议开启两个终端：

```bash
npm start
```

```bash
npm run dingtalk-stream
```

钉钉机器人通过 Stream 模式收到消息后，会调用项目现有的 AI 识别流程，并继续保存到 `data/homeworks.json`。

## 接口说明

### GET `/api/homeworks`

获取全部作业列表。

### POST `/api/homeworks`

手动新增一条作业。

请求体示例：

```json
{
  "platform": "钉钉",
  "course": "大学英语",
  "task": "完成 Unit 5 reading report",
  "deadline": "本周五18:00前",
  "submitMethod": "学习通",
  "originalMessage": "课程：大学英语...",
  "status": "待完成"
}
```

### PUT `/api/homeworks/:id`

编辑指定作业。项目同时保留 `PATCH /api/homeworks/:id` 作为前端当前使用的更新接口。

### DELETE `/api/homeworks/:id`

删除指定作业。

### PATCH `/api/homeworks/:id/status`

更新作业状态，支持 `待完成`、`已完成`、`待确认`。

### POST `/webhook/dingtalk`

模拟接收钉钉平台推送的作业通知，并调用 AI 识别流程整理为作业。

### POST `/webhook/qq`

模拟接收 QQ 平台推送的作业通知，并调用 AI 识别流程整理为作业。

### GET `/api/deepseek-status`

查看 DeepSeek 配置状态。接口只返回是否配置密钥，不会返回真实 API Key。

返回示例：

```json
{
  "hasKey": true,
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-chat"
}
```

### POST `/api/ai-test`

测试 AI 作业识别能力。

请求体示例：

```json
{
  "platform": "dingtalk",
  "messageText": "* 课程：大学英语\n* 截止：本周五18:00前\n* 提交方式：学习通\n* 内容：完成 Unit 5 reading report"
}
```

## 当前版本说明

当前版本已经实现本地可运行的 AI 作业整理系统。系统可以通过手动录入、AI 填表、钉钉/QQ 消息测试入口添加作业，并支持列表管理、状态维护、筛选和本地保存。钉钉 HTTP 模式作为测试接口保留，真实钉钉机器人接入推荐使用 Stream 模式。

## 后续优化方向

- 接入真实钉钉 / QQ 机器人
- 未来扩展飞书、学习通等平台
- 部署到公网
- 增加日历提醒
- 增加用户登录
- 使用数据库替代本地 JSON
- 增加移动端适配
