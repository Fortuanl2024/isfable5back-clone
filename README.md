# IsFable5Back 克隆

实时追踪 Claude Fable 5 (`claude-fable-5`) 是否可以通过 Anthropic API 访问的状态页,
仿 isfable5back.com,Python 标准库后端 + 原生 HTML/CSS/JS 前端,零依赖。

## 运行

```powershell
python server.py
# 打开 http://localhost:8000
```

默认返回模拟的"可用"状态。设置环境变量后可真实探测 Anthropic API:

```powershell
$env:ANTHROPIC_API_KEY = "sk-..."; python server.py
```

## 功能

- 大字 Yes/No 状态,每 60 秒自动检测,显示延迟与检测时间
- 动画模式切换:彩带 / 烟花 / 气球(可点爆,带连击)/ Emoji 雨 / 星空(自动夜空底色 + 流星)/ 萤火 / 关闭
- 点击空白处放烟花、鼠标星尘拖尾、状态翻转自动庆祝
- 禅模式(暗色主题)、卡片滚动淡入、背景漂移光晕
- FAQ、新闻时间线、其他模型追踪、邮件订阅(演示)
- 尊重系统 `prefers-reduced-motion` 设置

## 结构

- `server.py` — HTTP 服务器 + 每分钟一次的可用性探测,提供 `/api/status`
- `static/` — 前端页面(`index.html` / `style.css` / `app.js`)
