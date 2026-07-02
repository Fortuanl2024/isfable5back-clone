"""
IsFable5Back 克隆 —— 模型可用性追踪站
仅使用 Python 标准库,无需安装任何依赖。

运行:  python server.py
访问:  http://localhost:8000

如果设置了环境变量 ANTHROPIC_API_KEY,后端会真实探测 Anthropic API
(向 /v1/messages 发送一个 1-token 的最小请求)来判断模型是否可用;
否则返回模拟的 "可用" 状态,页面照常演示。
"""

import json
import os
import threading
import time
import urllib.request
import urllib.error
from http.server import HTTPServer, SimpleHTTPRequestHandler
from datetime import datetime, timezone

PORT = 8000
MODEL_ID = "claude-fable-5"
CHECK_INTERVAL = 60  # 每 60 秒检查一次,和原站一致
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

# 全局状态,由后台线程定期刷新
state = {
    "available": True,          # 模型是否可用
    "simulated": True,          # 是否为模拟数据(未配置 API Key)
    "model": MODEL_ID,
    "last_checked": None,       # 上次检查时间 (ISO 8601)
    "latency_ms": None,         # 探测耗时
}
state_lock = threading.Lock()


def probe_anthropic() -> None:
    """向 Anthropic API 发送最小请求,更新全局状态。"""
    now = datetime.now(timezone.utc).isoformat()

    if not API_KEY:
        with state_lock:
            state.update(available=True, simulated=True,
                         last_checked=now, latency_ms=None)
        return

    payload = json.dumps({
        "model": MODEL_ID,
        "max_tokens": 1,
        "messages": [{"role": "user", "content": "ping"}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "content-type": "application/json",
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=15):
            ok = True
    except urllib.error.HTTPError as e:
        # 404 = 模型不存在/未开放;429/529 等视为暂不可用
        ok = e.code not in (400, 403, 404, 429, 500, 503, 529)
    except Exception:
        ok = False
    latency = round((time.monotonic() - start) * 1000)

    with state_lock:
        state.update(available=ok, simulated=False,
                     last_checked=now, latency_ms=latency)


def checker_loop() -> None:
    while True:
        probe_anthropic()
        time.sleep(CHECK_INTERVAL)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
        super().__init__(*args, directory=static_dir, **kwargs)

    def do_GET(self):
        if self.path == "/api/status":
            with state_lock:
                body = json.dumps(state).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()

    def log_message(self, fmt, *args):
        pass  # 静默访问日志,保持终端整洁


if __name__ == "__main__":
    threading.Thread(target=checker_loop, daemon=True).start()
    mode = "真实探测 Anthropic API" if API_KEY else "模拟模式(未设置 ANTHROPIC_API_KEY)"
    print(f"IsFable5Back 克隆已启动: http://localhost:{PORT}  [{mode}]")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
