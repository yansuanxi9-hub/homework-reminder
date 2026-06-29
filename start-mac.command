#!/bin/bash
cd "$(dirname "$0")"
echo "正在启动多平台作业通知自动整理与提醒系统..."
if [ ! -d "node_modules" ]; then
  echo "未发现 node_modules，正在安装依赖..."
  npm install
fi
echo "请在浏览器打开：http://localhost:3000"
npm start
