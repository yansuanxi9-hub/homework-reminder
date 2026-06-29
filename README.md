# 多平台作业通知自动整理与提醒系统

## 项目简介

这是一个基于 Node.js + Express + DeepSeek API 的作业通知整理系统，可以接收网页手动输入、钉钉机器人回调、QQ 机器人消息，将自然语言作业通知识别为结构化作业任务，并在网页中统一管理和提醒。

项目已经部署到 Render，老师可以优先通过线上地址直接查看效果，也可以下载项目后在本地运行。

## 在线访问地址

https://homework-reminder-wm0m.onrender.com/

## 已实现功能

- 手动添加作业
- AI 识别作业通知
- DeepSeek API 接入
- 统一作业列表
- 作业状态管理
- 编辑 / 删除 / 标记完成
- 来源平台筛选
- 钉钉 webhook 接入
- QQ webhook 接入
- QQ 消息处理成功后自动回复
- QQ 重复事件去重
- deadlineAt 截止时间换算
- 任务规划与提醒模块
- 极简 UI 页面
- Render 线上部署

## 技术栈

- Node.js
- Express
- HTML
- CSS
- JavaScript
- DeepSeek API
- JSON 文件本地存储
- Render 部署

## 本地运行方式

请先确认电脑已经安装 Node.js。

1. 安装依赖：

```bash
npm install
```

2. 启动项目：

```bash
npm start
```

3. 浏览器打开：

```text
http://localhost:3000
```

也可以直接双击启动脚本：

- macOS：`start-mac.command`
- Windows：`start-windows.bat`

## 环境变量说明

如果需要完整测试 AI 识别和机器人接入，请复制环境变量模板：

```bash
cp .env.example .env
```

然后根据需要填写：

```text
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_MODEL
QQ_BOT_APP_ID
QQ_BOT_SECRET
DINGTALK_CLIENT_ID
DINGTALK_CLIENT_SECRET
```

说明：

- 为了安全，交付包中不包含真实 `.env` 文件。
- 真实 DeepSeek 密钥、QQ 机器人密钥、钉钉应用密钥都不应该写进代码或提交到压缩包。
- 老师如果只查看页面和代码，可以直接使用线上 Render 地址。
- 如果要本地完整测试 AI 和机器人，需要自行配置环境变量。
- 没有配置 DeepSeek 密钥时，项目仍可启动，但会使用本地备用识别逻辑。

## 项目结构

```text
homework-reminder/
├── README.md
├── package.json
├── package-lock.json
├── server.js
├── dingtalk-stream.js
├── .env.example
├── .gitignore
├── start-mac.command
├── start-windows.bat
├── 老师请先看我.txt
├── final_agent_software_development_transcript.html
├── public/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── data/
│   └── homeworks.json
└── assets/
    └── 教学展示截图文件
```

## 主要接口

```text
GET  /api/homeworks              获取作业列表
POST /api/homeworks              手动新增作业
PATCH /api/homeworks/:id         编辑作业
PATCH /api/homeworks/:id/status  修改作业状态
DELETE /api/homeworks/:id        删除作业
POST /api/ai-test                测试 AI 识别
GET  /api/deepseek-status        查看 DeepSeek 配置状态
GET  /webhook/dingtalk           钉钉 webhook 浏览器测试
POST /webhook/dingtalk           钉钉 webhook 消息入口
GET  /webhook/qq                 QQ webhook 浏览器测试
POST /webhook/qq                 QQ webhook 消息入口
```

## 钉钉与 QQ 接入说明

项目保留钉钉和 QQ 的 webhook 接口。真实机器人接入需要在平台后台配置公网地址和对应密钥。

Render 部署后的示例地址：

```text
https://homework-reminder-wm0m.onrender.com/webhook/dingtalk
https://homework-reminder-wm0m.onrender.com/webhook/qq
```

钉钉 Stream 模式可以单独运行：

```bash
npm run dingtalk-stream
```

## 交付说明

老师可以优先通过 Render 在线地址检查功能：

https://homework-reminder-wm0m.onrender.com/

如果需要本地运行，请按 README 步骤执行 `npm install` 和 `npm start`，或者双击对应系统的一键启动脚本。

## 注意事项

- 压缩包不包含 `.env`。
- 压缩包不包含 `node_modules/`。
- 压缩包不包含任何真实 API Key、Token、AppSecret 或机器人密钥。
- 当前版本使用 `data/homeworks.json` 保存本地数据。Render 免费实例的文件系统不适合作为长期数据库，后续正式版本可以升级为数据库存储。
