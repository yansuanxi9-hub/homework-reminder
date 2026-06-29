@echo off
cd /d %~dp0
echo 正在启动多平台作业通知自动整理与提醒系统...
if not exist node_modules (
  echo 未发现 node_modules，正在安装依赖...
  npm install
)
echo 请在浏览器打开：http://localhost:3000
npm start
pause
