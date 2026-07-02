/* ========== 数据 ========== */

const NEWS = [
  { date: "2026-07-01", title: "美国商务部解除相关限制,Claude Fable 5 恢复 API 访问。", source: "Anthropic 公告" },
  { date: "2026-06-28", title: "传闻称监管审查接近尾声,Fable 5 可能于 7 月初回归。", source: "TechCrunch" },
  { date: "2026-06-20", title: "Anthropic 表示正与监管机构积极沟通,Mythos 级模型服务未受影响的地区继续运营。", source: "路透社" },
  { date: "2026-06-12", title: "因美国出口管制以国家安全为由的要求,Fable 5 API 访问被暂停。", source: "美国商务部" },
  { date: "2026-06-11", title: "开发者报告 claude-fable-5 出现大面积 403 错误。", source: "社区论坛" },
  { date: "2026-06-10", title: "Fable 5 上线首日即登顶多项推理与智能体基准测试。", source: "基准测试榜单" },
  { date: "2026-06-09", title: "Anthropic 发布 Claude 5 系列,推出全新 Mythos 级模型 Fable 5。", source: "Anthropic 公告" },
];

const MODELS = [
  { name: "ChatGPT 5.6", eta: "预计 2026 年 Q3", released: false },
  { name: "Gemini 3.5 Pro", eta: "预计 2026 年 8 月", released: false },
  { name: "Grok 5", eta: "预计 2026 年夏季", released: false },
  { name: "Claude Opus 4.8", eta: "已发布", released: true },
  { name: "Llama 5", eta: "传闻 2026 年底", released: false },
  { name: "DeepSeek V4", eta: "传闻 2026 年 Q4", released: false },
  { name: "Mistral Large 3", eta: "预计 2026 年 9 月", released: false },
];

/* ========== 状态检测 ========== */

const answerEl = document.getElementById("answer");
const detailEl = document.getElementById("status-detail");
const lastCheckedEl = document.getElementById("last-checked");
const latencyEl = document.getElementById("latency");

async function refreshStatus() {
  try {
    const res = await fetch("/api/status");
    const s = await res.json();

    const newText = s.available ? "Yes" : "No";
    if (answerEl.textContent !== newText) {
      answerEl.textContent = newText;
      answerEl.classList.remove("pop");
      void answerEl.offsetWidth; // 强制重排,让动画可以重复触发
      answerEl.classList.add("pop");
      if (s.available) celebrate(); // 状态翻转为可用时放一轮烟花庆祝
    }
    answerEl.classList.toggle("yes", s.available);
    answerEl.classList.toggle("no", !s.available);

    detailEl.textContent = s.available
      ? `Claude Fable 5 (${s.model}) 目前可以通过 Anthropic API 访问。`
      : `Claude Fable 5 (${s.model}) 目前无法通过 Anthropic API 访问。`;
    if (s.simulated) detailEl.textContent += "(模拟数据,未配置 API Key)";

    lastCheckedEl.textContent = s.last_checked
      ? new Date(s.last_checked).toLocaleTimeString("zh-CN")
      : "—";
    latencyEl.textContent = s.latency_ms != null ? ` · 延迟 ${s.latency_ms}ms` : "";
  } catch {
    detailEl.textContent = "无法连接后端,请确认 server.py 正在运行。";
  }
}

refreshStatus();
setInterval(refreshStatus, 60_000);

/* ========== 渲染新闻和模型列表 ========== */

document.getElementById("news-list").innerHTML = NEWS.map(n => `
  <li>
    <span class="date">${n.date}</span>
    <span class="title">${n.title}</span>
    <span class="source">来源:${n.source}</span>
  </li>`).join("");

document.getElementById("model-grid").innerHTML = MODELS.map(m => `
  <div class="model-item">
    <div class="name">${m.name}</div>
    <div class="eta">${m.eta}</div>
    <span class="badge ${m.released ? "released" : "rumor"}">${m.released ? "已发布" : "传闻"}</span>
  </div>`).join("");

/* ========== 主题切换(禅模式) ========== */

const themeToggle = document.getElementById("theme-toggle");
if (localStorage.getItem("zen") === "1") document.body.classList.add("zen");
syncThemeLabel();

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("zen");
  localStorage.setItem("zen", document.body.classList.contains("zen") ? "1" : "0");
  syncThemeLabel();
});

function syncThemeLabel() {
  themeToggle.textContent = document.body.classList.contains("zen") ? "☀️ 日间模式" : "🌙 禅模式";
}

/* ========== 邮件订阅(本地演示) ========== */

document.getElementById("subscribe-form").addEventListener("submit", e => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const msg = document.getElementById("subscribe-msg");
  msg.textContent = `已订阅!状态变化时将通知 ${email}(演示,仅保存在本地)`;
  msg.hidden = false;
  localStorage.setItem("subscribed", email);
  e.target.reset();
});

/* ================================================================
   粒子动画引擎
   一个全屏 canvas + 一个 rAF 循环,所有粒子放在同一个数组里,
   按 type 分别更新和绘制。模式(彩带/烟花/气球/Emoji雨)只决定
   每帧自动补充哪种粒子;点击爆裂和庆祝烟花在任何模式下都可用。
   ================================================================ */

const canvas = document.getElementById("confetti");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener("resize", resize);

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];

const COLORS = ["#c96442", "#2e8b57", "#e6b422", "#4a7ab5", "#b5654a", "#8e6bb5"];
const EMOJIS = ["🎉", "🥳", "✨", "🤖", "🎊", "⭐", "💫", "🍀"];

const MODE_ORDER = ["confetti", "fireworks", "balloons", "emoji", "fireflies", "off"];
const MODE_LABEL = {
  confetti: "🎉 彩带",
  fireworks: "🎆 烟花",
  balloons: "🎈 气球",
  emoji: "🌧️ Emoji 雨",
  fireflies: "✨ 萤火",
  off: "🚫 关闭",
};

// 系统开了"减少动态效果"时,默认不放动画(用户手动选过则尊重选择)
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let mode = localStorage.getItem("animMode");
if (!MODE_ORDER.includes(mode)) mode = reducedMotion ? "off" : "confetti";

let particles = [];
let frame = 0;

/* ---------- 各类粒子的生成 ---------- */

function spawnConfetti() {
  particles.push({
    type: "confetti",
    x: rand(0, canvas.width), y: -20,
    w: rand(6, 12), h: rand(8, 16),
    color: pick(COLORS),
    vx: rand(-0.6, 0.6), vy: rand(1.5, 4),
    rot: rand(0, Math.PI), vr: rand(-0.08, 0.08),
  });
}

function spawnBalloon() {
  particles.push({
    type: "balloon",
    x: rand(40, canvas.width - 40), y: canvas.height + 60,
    r: rand(18, 32),
    color: pick(COLORS),
    vy: -rand(0.6, 1.4),
    phase: rand(0, Math.PI * 2), // 左右摇摆的相位,让每只气球不同步
    sway: rand(15, 35),
  });
}

function spawnEmoji() {
  particles.push({
    type: "emoji",
    x: rand(0, canvas.width), y: -30,
    char: pick(EMOJIS),
    size: rand(18, 34),
    vy: rand(1, 3), vx: rand(-0.5, 0.5),
    rot: rand(-0.5, 0.5), vr: rand(-0.04, 0.04),
  });
}

function spawnFirefly() {
  particles.push({
    type: "firefly",
    x: rand(0, canvas.width), y: rand(0, canvas.height),
    vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3),
    r: rand(1.5, 3),
    color: pick(["#e6b422", "#f0d98c", "#8e6bb5", "#7fd8a8"]),
    phase: rand(0, Math.PI * 2),
    twinkle: rand(0.02, 0.05), // 明暗呼吸的频率,各不相同
  });
}

function launchRocket(x = rand(canvas.width * 0.15, canvas.width * 0.85)) {
  particles.push({
    type: "rocket",
    x, y: canvas.height + 10,
    vx: rand(-0.5, 0.5), vy: -rand(9, 12),
    color: `hsl(${rand(0, 360)}, 90%, 65%)`,
    targetY: rand(canvas.height * 0.15, canvas.height * 0.45),
  });
}

function explode(x, y, color, count = 70) {
  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2);
    const speed = rand(1, 6);
    const maxLife = rand(40, 80);
    particles.push({
      type: "spark",
      x, y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      color, life: maxLife, maxLife,
    });
  }
}

function celebrate() {
  for (let i = 0; i < 4; i++) setTimeout(() => launchRocket(), i * 350);
}

/* ---------- 主循环 ---------- */

function tick() {
  frame++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 按当前模式自动补充粒子
  if (mode === "confetti") {
    if (count("confetti") < 120) for (let i = 0; i < 3; i++) spawnConfetti();
  } else if (mode === "balloons") {
    if (count("balloon") < 10 && frame % 25 === 0) spawnBalloon();
  } else if (mode === "emoji") {
    if (count("emoji") < 40) spawnEmoji();
  } else if (mode === "fireworks") {
    if (frame % 70 === 0) launchRocket();
  } else if (mode === "fireflies") {
    if (count("firefly") < 24) spawnFirefly();
  }

  particles = particles.filter(p => UPDATE[p.type](p));
  requestAnimationFrame(tick);
}

const count = type => particles.reduce((n, p) => n + (p.type === type), 0);

/* ---------- 各类粒子的更新与绘制,返回 false 表示销毁 ---------- */

const UPDATE = {
  confetti(p) {
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
    return p.y < canvas.height + 30;
  },

  emoji(p) {
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.font = `${p.size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.char, 0, 0);
    ctx.restore();
    return p.y < canvas.height + 40;
  },

  balloon(p) {
    p.y += p.vy;
    const drawX = p.x + Math.sin(p.phase + frame * 0.02) * p.sway;
    ctx.save();
    ctx.translate(drawX, p.y);
    // 绳子
    ctx.strokeStyle = "rgba(150,150,150,.8)";
    ctx.beginPath();
    ctx.moveTo(0, p.r + 4);
    ctx.quadraticCurveTo(7, p.r + 22, -3, p.r + 42);
    ctx.stroke();
    // 球体
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r * 0.78, p.r, 0, 0, Math.PI * 2);
    ctx.fill();
    // 打结处的小三角
    ctx.beginPath();
    ctx.moveTo(-4, p.r - 1);
    ctx.lineTo(4, p.r - 1);
    ctx.lineTo(0, p.r + 6);
    ctx.fill();
    // 高光
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-p.r * 0.28, -p.r * 0.35, p.r * 0.18, p.r * 0.3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return p.y > -80;
  },

  rocket(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08; // 重力让上升逐渐减速
    // 尾迹:每两帧掉落一个短命火花
    if (frame % 2 === 0) {
      particles.push({
        type: "spark", x: p.x, y: p.y,
        vx: rand(-0.3, 0.3), vy: rand(0, 0.5),
        color: p.color, life: 12, maxLife: 12,
      });
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // 减速到顶点或到达目标高度时炸开
    if (p.vy >= -2 || p.y <= p.targetY) {
      explode(p.x, p.y, p.color);
      return false;
    }
    return true;
  },

  spark(p) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.06; // 重力
    p.vx *= 0.99; // 空气阻力
    p.life--;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = Math.max(alpha, 0);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.5 + 2 * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return p.life > 0;
  },

  firefly(p) {
    // 随机游走:速度每帧受微小扰动,再限幅,轨迹就像昆虫漫飞
    p.vx = Math.max(-0.5, Math.min(0.5, p.vx + rand(-0.03, 0.03)));
    p.vy = Math.max(-0.5, Math.min(0.5, p.vy + rand(-0.03, 0.03)));
    p.x += p.vx; p.y += p.vy;
    // 飞出边界从对侧回来
    if (p.x < -10) p.x = canvas.width + 10;
    if (p.x > canvas.width + 10) p.x = -10;
    if (p.y < -10) p.y = canvas.height + 10;
    if (p.y > canvas.height + 10) p.y = -10;

    const glow = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(p.phase + frame * p.twinkle));
    ctx.save();
    ctx.globalAlpha = glow;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return true; // 常驻,切换模式时统一清理
  },

  stardust(p) {
    p.y -= 0.25; // 轻微上飘
    p.rot += 0.03;
    p.life--;
    const a = p.life / p.maxLife;
    const r = p.r * a; // 十字光芒随生命缩短
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = a;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return p.life > 0;
  },
};

tick();

/* ---------- 模式切换按钮 ---------- */

const animToggle = document.getElementById("anim-toggle");
syncAnimLabel();

animToggle.addEventListener("click", () => {
  mode = MODE_ORDER[(MODE_ORDER.indexOf(mode) + 1) % MODE_ORDER.length];
  localStorage.setItem("animMode", mode);
  // 清掉旧模式的粒子(保留正在飞的火花),新模式立即可见
  particles = particles.filter(p => p.type === "spark");
  if (mode === "fireworks") launchRocket();
  syncAnimLabel();
});

function syncAnimLabel() {
  animToggle.textContent = "动画:" + MODE_LABEL[mode];
}

/* ---------- 点击任意空白处放烟花 ---------- */

addEventListener("pointerdown", e => {
  if (e.target.closest("button, a, input, summary")) return;
  explode(e.clientX, e.clientY, `hsl(${rand(0, 360)}, 90%, 65%)`, 40);
});

/* ---------- 鼠标星尘拖尾 ---------- */

// 按移动距离而不是事件频率生成,快速滑动时星星均匀撒开,慢移时稀疏克制
let lastDust = { x: -100, y: -100 };
addEventListener("pointermove", e => {
  if (reducedMotion) return;
  const dx = e.clientX - lastDust.x;
  const dy = e.clientY - lastDust.y;
  if (dx * dx + dy * dy < 28 * 28) return;
  lastDust = { x: e.clientX, y: e.clientY };
  particles.push({
    type: "stardust",
    x: e.clientX + rand(-4, 4), y: e.clientY + rand(-4, 4),
    r: rand(4, 9),
    rot: rand(0, Math.PI),
    color: pick(["#e6b422", "#c96442", "#8e6bb5", "#4a7ab5"]),
    life: 36, maxLife: 36,
  });
});

/* ---------- 卡片滚动进入时淡入上浮 ---------- */

if (!reducedMotion) {
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add("reveal");
      io.unobserve(en.target);
      // 动画结束后摘掉类,把 transform 还给 hover 悬浮效果
      en.target.addEventListener("animationend",
        () => en.target.classList.remove("pre-reveal", "reveal"), { once: true });
    }
  }, { threshold: 0.15 });

  document.querySelectorAll(".card").forEach(c => {
    c.classList.add("pre-reveal");
    io.observe(c);
  });
}
