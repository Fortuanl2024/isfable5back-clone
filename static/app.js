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
    size: pick([18, 22, 26, 30, 34]), // 尺寸取档位而非连续随机,精灵缓存才能命中
    vy: rand(1, 3), vx: rand(-0.5, 0.5),
    rot: rand(-0.5, 0.5), vr: rand(-0.04, 0.04),
  });
}

/* emoji 精灵缓存:fillText 渲染彩色 emoji 字形非常昂贵,
   每种字符每档尺寸只画一次到离屏 canvas,之后每帧用廉价的 drawImage 贴图 */
const EMOJI_SPRITES = new Map();
function emojiSprite(char, size) {
  const key = char + "@" + size;
  let s = EMOJI_SPRITES.get(key);
  if (!s) {
    const dpr = devicePixelRatio || 1;
    const box = Math.ceil(size * 1.4); // 留边距,防止字形溢出被裁切
    const c = document.createElement("canvas");
    c.width = c.height = Math.ceil(box * dpr);
    const cc = c.getContext("2d");
    cc.scale(dpr, dpr); // 按设备像素比渲染,高分屏上依然清晰
    cc.font = `${size}px serif`;
    cc.textAlign = "center";
    cc.textBaseline = "middle";
    cc.fillText(char, box / 2, box / 2);
    s = { canvas: c, box };
    EMOJI_SPRITES.set(key, s);
  }
  return s;
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

function explode(x, y, color, count = 100, shape) {
  // 四种爆炸形状:牡丹(球形,出现概率加倍)/ 圆环 / 垂柳 / 炸裂(带二次爆)
  shape = shape || pick(["peony", "peony", "ring", "willow", "crackle"]);

  // 爆炸瞬间的白色闪光,快速扩张后消失
  particles.push({ type: "flash", x, y, maxR: count * 1.1, life: 10, maxLife: 10, color });

  for (let i = 0; i < count; i++) {
    const ang = rand(0, Math.PI * 2);
    let speed, life, gravity = 0.06, drag = 0.985, crackle = false;

    if (shape === "ring") {
      speed = rand(4.6, 5.2); // 速度几乎一致,炸成一个正圆环
      life = rand(50, 70);
    } else if (shape === "willow") {
      speed = rand(1, 5);
      gravity = 0.045;
      drag = 0.96; // 强阻力让火花很快失去横向速度,只剩下坠,拖出柳枝般的金色长尾
      life = rand(90, 140);
    } else if (shape === "crackle") {
      speed = rand(1.5, 5.5);
      life = rand(40, 70);
      crackle = Math.random() < 0.5; // 一半火花飞到中途还会再炸一次
    } else { // peony 牡丹:七成火花在外壳、三成填充内部,形成饱满球形
      speed = Math.random() < 0.7 ? rand(4, 6) : rand(1, 3.5);
      life = rand(45, 85);
    }

    particles.push({
      type: "spark", x, y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      color: shape === "willow"
        ? pick(["#ffd700", "#ffcc66"])
        : (Math.random() < 0.22 ? "#fff6e0" : color), // 混入两成白热火花,层次更亮
      life, maxLife: life, gravity, drag, crackle,
    });
  }
}

function celebrate() {
  for (let i = 0; i < 4; i++) setTimeout(() => launchRocket(), i * 350);
}

function popBalloon(p, drawX) {
  // 一小团闪光 + 一圈橡胶碎片从球面向外飞溅
  particles.push({ type: "flash", x: drawX, y: p.y, maxR: p.r * 2.2, life: 8, maxLife: 8, color: p.color });
  for (let i = 0; i < 14; i++) {
    const ang = rand(0, Math.PI * 2);
    const sp = rand(2, 6) * (p.r / 24); // 大气球碎片飞得更远
    particles.push({
      type: "shred",
      x: drawX + Math.cos(ang) * p.r * 0.5,
      y: p.y + Math.sin(ang) * p.r * 0.6,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1,
      w: rand(3, 7), h: rand(5, 10),
      rot: rand(0, Math.PI), vr: rand(-0.3, 0.3),
      color: p.color, life: rand(30, 50), maxLife: 50,
    });
  }
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
    if (frame % 60 === 0) {
      launchRocket();
      if (Math.random() < 0.35) launchRocket(); // 三成概率双发齐放
    }
  } else if (mode === "fireflies") {
    if (count("firefly") < 24) spawnFirefly();
  }

  // 就地遍历 + 压缩,不能用 filter:更新过程中爆炸会往数组里追加新粒子,
  // filter 只访问遍历开始时已有的元素、返回值又会整个替换数组,
  // 导致同一帧生成的火花刚出生就被丢弃(表现为烟花只见上升不见炸开)
  let write = 0;
  for (let read = 0; read < particles.length; read++) {
    const p = particles[read];
    if (UPDATE[p.type](p)) particles[write++] = p;
  }
  particles.length = write;
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
    const s = emojiSprite(p.char, p.size);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.drawImage(s.canvas, -s.box / 2, -s.box / 2, s.box, s.box);
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
    p.vy += p.gravity ?? 0.06;
    const drag = p.drag ?? 0.99;
    p.vx *= drag; p.vy *= drag;
    p.life--;

    // 二次爆裂:飞到生命 40% 处再炸出一小簇金色碎火花
    if (p.crackle && p.life <= p.maxLife * 0.4) {
      p.crackle = false;
      for (let i = 0; i < 6; i++) {
        const ang = rand(0, Math.PI * 2);
        const sp = rand(0.5, 2);
        particles.push({
          type: "spark", x: p.x, y: p.y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          color: "#ffe9a0", life: rand(15, 30), maxLife: 30,
          gravity: 0.05, drag: 0.98,
        });
      }
    }

    let a = Math.max(p.life / p.maxLife, 0);
    if (a < 0.35) a *= rand(0.2, 1.2); // 熄灭前不规则闪烁,像真实火星

    ctx.save();
    ctx.globalCompositeOperation = "lighter"; // 叠加混合:重叠处更亮,产生辉光感
    ctx.globalAlpha = Math.min(a, 1);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1 + 1.6 * a;
    ctx.lineCap = "round";
    const speed2 = p.vx * p.vx + p.vy * p.vy;
    if (speed2 > 0.1) {
      // 沿速度反方向拉长成线,形成运动拖尾
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 3.5, p.y - p.vy * 3.5);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      // 几乎静止的火花退化为圆点,避免零长度线段画不出来
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return p.life > 0;
  },

  shred(p) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15; // 橡胶片比火花重,坠得快
    p.vx *= 0.98;
    p.rot += p.vr;
    p.life--;
    const a = Math.max(p.life / p.maxLife, 0);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
    return p.life > 0 && p.y < canvas.height + 20;
  },

  flash(p) {
    p.life--;
    const t = 1 - p.life / p.maxLife;
    const r = 6 + p.maxR * Math.pow(t, 0.45); // 先快后慢地扩张
    const a = Math.max(p.life / p.maxLife, 0);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, "rgba(255,255,240,1)");
    g.addColorStop(0.3, p.color);
    g.addColorStop(1, "transparent");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.9 * a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
  // 清掉旧模式的粒子(保留正在飞的火花和闪光),新模式立即可见
  particles = particles.filter(p => p.type === "spark" || p.type === "flash");
  if (mode === "fireworks") launchRocket();
  syncAnimLabel();
});

function syncAnimLabel() {
  animToggle.textContent = "动画:" + MODE_LABEL[mode];
}

/* ---------- 点击任意空白处放烟花 ---------- */

addEventListener("pointerdown", e => {
  if (e.target.closest("button, a, input, summary")) return;

  // 先检测是否点中了气球(用摇摆后的实际绘制位置做椭圆命中判定)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.type !== "balloon") continue;
    const drawX = p.x + Math.sin(p.phase + frame * 0.02) * p.sway;
    const nx = (e.clientX - drawX) / (p.r * 0.78);
    const ny = (e.clientY - p.y) / p.r;
    if (nx * nx + ny * ny <= 1.3) { // 判定范围略大于球面,更好点中
      popBalloon(p, drawX);
      particles.splice(i, 1);
      return; // 点中气球时不再触发烟花
    }
  }

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
