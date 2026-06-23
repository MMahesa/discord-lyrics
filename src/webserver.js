import { createServer } from "http";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const express = require("express");

const app = express();
const clients = new Set();
let currentState = null;

export function broadcastState(state) {
  currentState = state;
  const msg = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of clients) {
    try { res.write(msg); } catch (_) { clients.delete(res); }
  }
}

app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.flushHeaders();
  clients.add(res);
  if (currentState) res.write(`data: ${JSON.stringify(currentState)}\n\n`);
  req.on("close", () => clients.delete(res));
});

const HTML = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Discord Lyrics Status</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}

:root{
  --accent:#1db954;
  --accent-rgb:29,185,84;
  --bg:#080810;
  --card:rgba(18,18,30,0.85);
  --border:rgba(255,255,255,0.06);
  --text:#f0f0f5;
  --dim:#6b6b8a;
  --c1:#1db954;
  --c2:#1565c0;
}

html,body{
  width:100%;height:100%;overflow:hidden;
  background:var(--bg);
  font-family:'Inter',system-ui,sans-serif;
  color:var(--text);
}

/* ─── CANVAS BACKGROUND ─── */
#bgCanvas{position:fixed;inset:0;z-index:0}

/* ─── BLURRED ALBUM ART BG ─── */
#bgBlur{
  position:fixed;inset:-40px;z-index:1;
  background-size:cover;background-position:center;
  filter:blur(80px) brightness(.12) saturate(3);
  transition:background-image 1.5s ease;
  opacity:0;
}
#bgBlur.loaded{opacity:1}

/* ─── VIGNETTE ─── */
.vignette{
  position:fixed;inset:0;z-index:2;
  background:radial-gradient(ellipse 90% 90% at 50% 50%,transparent 50%,rgba(0,0,0,.7));
  pointer-events:none;
}

/* ─── MAIN LAYOUT ─── */
.stage{
  position:fixed;inset:0;z-index:10;
  display:flex;align-items:center;justify-content:center;
}

/* ─── MAIN CARD ─── */
.card{
  background:var(--card);
  backdrop-filter:blur(40px) saturate(180%);
  -webkit-backdrop-filter:blur(40px) saturate(180%);
  border:1px solid var(--border);
  border-radius:28px;
  padding:32px 32px 24px;
  width:480px;
  position:relative;
  box-shadow:0 50px 100px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.04),
             inset 0 1px 0 rgba(255,255,255,.08);
  overflow:hidden;
}
.card::before{
  content:'';position:absolute;inset:0;border-radius:28px;
  background:linear-gradient(135deg,rgba(255,255,255,.04) 0%,transparent 50%);
  pointer-events:none;
}

/* ─── CARD TOP GLOW ─── */
.card-glow{
  position:absolute;top:-60px;left:50%;transform:translateX(-50%);
  width:300px;height:120px;
  background:radial-gradient(ellipse,rgba(var(--accent-rgb),.3),transparent 70%);
  pointer-events:none;z-index:0;
  transition:background 1.5s ease;
}

/* ─── HEADER ─── */
.app-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:24px;position:relative;z-index:1;
}
.app-logo{
  display:flex;align-items:center;gap:10px;
  font-size:12px;letter-spacing:1.5px;text-transform:uppercase;
  color:rgba(255,255,255,.3);font-weight:600;
}
.logo-dot{
  width:8px;height:8px;border-radius:50%;
  background:var(--accent);
  box-shadow:0 0 10px rgba(var(--accent-rgb),.8);
  animation:dotpulse 1.8s ease-in-out infinite;
}
.logo-dot.off{animation:none;background:var(--dim);box-shadow:none}
@keyframes dotpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.5}}

.header-right{display:flex;align-items:center;gap:8px}
.vis-bars{display:flex;align-items:flex-end;gap:2px;height:20px;padding-bottom:2px}
.vis-bar{
  width:3px;border-radius:2px;
  background:var(--accent);
  transform-origin:bottom;
  animation:vibar 0s ease-in-out infinite alternate;
  opacity:.7;
}
.vis-bar:nth-child(1){height:8px;animation-duration:.5s;animation-delay:0s}
.vis-bar:nth-child(2){height:14px;animation-duration:.7s;animation-delay:.1s}
.vis-bar:nth-child(3){height:10px;animation-duration:.4s;animation-delay:.2s}
.vis-bar:nth-child(4){height:16px;animation-duration:.6s;animation-delay:.05s}
.vis-bar:nth-child(5){height:6px;animation-duration:.8s;animation-delay:.15s}
@keyframes vibar{from{transform:scaleY(.2)}to{transform:scaleY(1)}}
.vis-bars.paused .vis-bar{animation-play-state:paused!important;transform:scaleY(.2)}
.vis-bars.playing .vis-bar{animation-play-state:running}

/* ─── ARTWORK SECTION ─── */
.artwork-area{
  display:flex;align-items:center;gap:20px;
  margin-bottom:20px;position:relative;z-index:1;
}

/* Vinyl disc */
.vinyl-wrap{
  position:relative;flex-shrink:0;
  width:110px;height:110px;
}
.vinyl{
  width:100%;height:100%;border-radius:50%;
  background:conic-gradient(
    #111 0deg,#1a1a1a 18deg,#111 36deg,#1a1a1a 54deg,
    #111 72deg,#1a1a1a 90deg,#111 108deg,#1a1a1a 126deg,
    #111 144deg,#1a1a1a 162deg,#111 180deg,#1a1a1a 198deg,
    #111 216deg,#1a1a1a 234deg,#111 252deg,#1a1a1a 270deg,
    #111 288deg,#1a1a1a 306deg,#111 324deg,#1a1a1a 342deg,#111 360deg
  );
  box-shadow:0 0 40px rgba(0,0,0,.9),0 0 0 1px rgba(255,255,255,.05);
  animation:spin 5s linear infinite;
  animation-play-state:paused;
  position:absolute;
}
.vinyl.playing{animation-play-state:running}
@keyframes spin{to{transform:rotate(360deg)}}

.art{
  width:74px;height:74px;border-radius:50%;
  background:#1a1a2e;
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  z-index:2;
  box-shadow:0 0 20px rgba(0,0,0,.8);
  background-size:cover;background-position:center;
  transition:background-image .8s ease;
  overflow:hidden;
}
.art::after{
  content:'';position:absolute;inset:0;border-radius:50%;
  box-shadow:inset 0 0 15px rgba(0,0,0,.5);
}
.hole{
  width:12px;height:12px;border-radius:50%;
  background:var(--bg);
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  z-index:3;border:1.5px solid rgba(255,255,255,.08);
}

/* Track info next to vinyl */
.track-info{flex:1;min-width:0;overflow:hidden}
.track-title{
  font-size:18px;font-weight:800;letter-spacing:-.4px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  margin-bottom:5px;
  background:linear-gradient(135deg,#fff 0%,rgba(255,255,255,.7) 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.track-artist{
  font-size:13px;color:var(--dim);margin-bottom:10px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  font-weight:500;
}
.genre-badge{
  display:inline-flex;align-items:center;gap:5px;
  font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;
  background:rgba(var(--accent-rgb),.1);
  border:1px solid rgba(var(--accent-rgb),.25);
  color:var(--accent);padding:3px 10px;border-radius:20px;
  transition:all .3s;
}

/* ─── WAVEFORM VISUALIZER ─── */
.waveform{
  display:flex;align-items:center;justify-content:center;gap:2px;
  height:36px;margin:4px 0 12px;
  position:relative;z-index:1;
}
.wv{
  width:3px;border-radius:3px;
  background:var(--accent);
  transition:height .15s ease;
  opacity:.6;
  animation:wvpulse 0s ease-in-out infinite alternate;
  min-height:3px;
}
.waveform.paused .wv{animation-play-state:paused;height:3px!important}
.waveform.playing .wv{animation-play-state:running}
@keyframes wvpulse{from{transform:scaleY(.15)}to{transform:scaleY(1)}}

/* ─── PROGRESS ─── */
.progress-section{position:relative;z-index:1;margin-bottom:4px}
.progress-track{
  height:4px;background:rgba(255,255,255,.07);
  border-radius:4px;cursor:pointer;position:relative;overflow:visible;
}
.progress-fill{
  height:100%;border-radius:4px;
  background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 80%,#fff));
  transition:width .8s linear;position:relative;
}
.progress-dot{
  width:14px;height:14px;border-radius:50%;background:#fff;
  position:absolute;right:-7px;top:-5px;
  box-shadow:0 2px 10px rgba(0,0,0,.4);
  opacity:0;transition:opacity .2s;cursor:grab;
}
.progress-track:hover .progress-dot{opacity:1}
.time-row{
  display:flex;justify-content:space-between;
  font-size:11px;color:var(--dim);margin-top:8px;font-weight:500;
}

/* ─── LYRICS ─── */
.lyrics-section{
  position:relative;z-index:1;
  border-top:1px solid var(--border);
  margin-top:16px;padding-top:18px;
  min-height:70px;
  display:flex;align-items:center;justify-content:center;
  overflow:hidden;
}
.lyric{
  font-size:17px;font-weight:700;text-align:center;
  line-height:1.5;
  color:var(--accent);
  text-shadow:0 0 30px rgba(var(--accent-rgb),.4);
  transition:opacity .3s,transform .3s;
  max-width:100%;
  letter-spacing:-.2px;
}
.lyric.fade{opacity:0;transform:translateY(-8px) scale(.97)}
.lyric.no-lyric{color:var(--dim);font-size:13px;font-weight:400;font-style:italic}

/* music note particles */
.note{
  position:fixed;font-size:16px;z-index:8;
  animation:floatnote linear forwards;
  pointer-events:none;user-select:none;
  opacity:0;
}
@keyframes floatnote{
  0%{opacity:0;transform:translateY(0) rotate(0deg) scale(.6)}
  15%{opacity:.8}
  85%{opacity:.6}
  100%{opacity:0;transform:translateY(-120px) rotate(25deg) scale(1.2)}
}

/* ─── CAT MASCOT ─── */
#catStage{
  position:fixed;bottom:0;left:0;right:0;height:70px;
  z-index:20;pointer-events:none;overflow:hidden;
}
.cat-container{
  position:absolute;bottom:0;
  transition:left 0.05s linear;
}
.cat-sprite{
  width:48px;height:48px;position:relative;
  image-rendering:pixelated;
}
/* Pixel cat built with CSS */
.cat-body{
  position:absolute;
  background:var(--cat-color,#f5a623);
}
/* Walking shadow */
.cat-shadow{
  position:absolute;bottom:-4px;left:4px;
  width:36px;height:6px;border-radius:50%;
  background:rgba(0,0,0,.3);
  animation:catshadow .4s ease-in-out infinite alternate;
}
@keyframes catshadow{from{transform:scaleX(1)}to{transform:scaleX(.7)}}

/* ─── IDLE ─── */
.idle-screen{
  text-align:center;padding:40px 20px;
  position:relative;z-index:1;
}
.idle-cat{
  font-size:60px;display:block;margin-bottom:20px;
  animation:idlebounce 2s ease-in-out infinite;
}
@keyframes idlebounce{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-12px) rotate(3deg)}}
.idle-text{
  color:var(--dim);font-size:14px;font-weight:500;
  animation:idlefade 2.5s ease-in-out infinite;
}
@keyframes idlefade{0%,100%{opacity:.5}50%{opacity:1}}

/* ─── STARFIELD (idle bg) ─── */
.star{
  position:fixed;border-radius:50%;background:#fff;
  pointer-events:none;z-index:1;
  animation:twinkle linear infinite;
}
@keyframes twinkle{0%,100%{opacity:.1}50%{opacity:.6}}

/* ─── TOAST ─── */
.toast{
  position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(20px);
  background:rgba(20,20,35,.95);border:1px solid var(--border);
  border-radius:12px;padding:10px 20px;font-size:12px;
  color:rgba(255,255,255,.7);z-index:100;
  opacity:0;transition:all .3s;pointer-events:none;
  backdrop-filter:blur(20px);
}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* ─── WEATHER WIDGET ─── */
.weather-chip{
  display:flex;align-items:center;gap:6px;
  background:rgba(255,255,255,.05);border:1px solid var(--border);
  border-radius:20px;padding:4px 12px;font-size:11px;
  color:var(--dim);cursor:default;font-weight:500;
  transition:all .3s;
}
.weather-chip:hover{background:rgba(255,255,255,.08);color:var(--text)}
.weather-chip .wicon{font-size:14px}

/* ─── CAT SVG pixel art ─── */
.nyan{
  image-rendering:pixelated;
  width:72px;height:auto;
}

/* ─── SCROLL MARQUEE for long titles ─── */
.marquee-wrap{overflow:hidden;position:relative}
.marquee-inner{
  display:inline-block;white-space:nowrap;
  animation:marquee 10s linear infinite;
  animation-play-state:paused;
}
.marquee-inner.running{animation-play-state:running}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

/* ─── CLOCK ─── */
.clock-display{
  font-size:11px;color:var(--dim);font-weight:600;
  font-variant-numeric:tabular-nums;letter-spacing:.5px;
}

/* ─── SCROBBLE COUNTER ─── */
.scrobble-chip{
  display:inline-flex;align-items:center;gap:5px;
  font-size:10px;font-weight:700;letter-spacing:.5px;
  color:rgba(255,255,255,.3);
  transition:color .3s;
}
</style>
</head>
<body>

<canvas id="bgCanvas"></canvas>
<div id="bgBlur"></div>
<div class="vignette"></div>

<div class="stage">
  <div class="card" id="mainCard">
    <div class="card-glow" id="cardGlow"></div>

    <!-- HEADER -->
    <div class="app-header">
      <div class="app-logo">
        <div class="logo-dot off" id="logoDot"></div>
        <span>Now Playing</span>
      </div>
      <div class="header-right">
        <span class="clock-display" id="clockEl"></span>
        <div id="weatherChip" class="weather-chip" style="display:none">
          <span class="wicon" id="wIcon">🌡️</span>
          <span id="wTemp">--°</span>
        </div>
        <div class="vis-bars paused" id="visBars">
          <div class="vis-bar"></div>
          <div class="vis-bar"></div>
          <div class="vis-bar"></div>
          <div class="vis-bar"></div>
          <div class="vis-bar"></div>
        </div>
      </div>
    </div>

    <!-- NOW PLAYING -->
    <div id="nowPlaying" style="display:none">
      <div class="artwork-area">
        <div class="vinyl-wrap">
          <div class="vinyl" id="vinyl"></div>
          <div class="art" id="art"></div>
          <div class="hole"></div>
        </div>
        <div class="track-info">
          <div class="track-title marquee-wrap" id="trackTitleWrap">
            <span id="trackTitle">—</span>
          </div>
          <div class="track-artist" id="trackArtist">—</div>
          <div class="genre-badge" id="genreBadge" style="display:none">
            <span>♦</span><span id="genreText"></span>
          </div>
        </div>
      </div>

      <!-- WAVEFORM VIS -->
      <div class="waveform paused" id="waveform"></div>

      <!-- PROGRESS -->
      <div class="progress-section">
        <div class="progress-track" id="progressTrack">
          <div class="progress-fill" id="progressFill" style="width:0%">
            <div class="progress-dot"></div>
          </div>
        </div>
        <div class="time-row">
          <span id="timePos">0:00</span>
          <span class="scrobble-chip" id="scrobbleChip">
            <span>🎧</span><span id="scrobbleCount">0 scrobbles</span>
          </span>
          <span id="timeDur">0:00</span>
        </div>
      </div>

      <!-- LYRICS -->
      <div class="lyrics-section">
        <div class="lyric" id="lyric">♪</div>
      </div>

      <!-- FOOTER -->
      <div style="display:flex;justify-content:center;margin-top:14px;gap:6px;opacity:.4;font-size:11px;font-weight:500;color:var(--dim)">
        <span>Discord status aktif</span>
        <span id="trackSource"></span>
      </div>
    </div>

    <!-- IDLE -->
    <div id="idle" class="idle-screen">
      <span class="idle-cat">🐱</span>
      <div class="idle-text" id="idleText">Menunggu Spotify memutar lagu...</div>
    </div>
  </div>
</div>

<!-- CAT STAGE -->
<div id="catStage"></div>

<!-- TOAST -->
<div class="toast" id="toast"></div>

<script>
// ═══════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════
const $ = id => document.getElementById(id);
function fmt(ms){const s=Math.floor(ms/1000),m=Math.floor(s/60);return m+':'+String(s%60).padStart(2,'0')}
function lerp(a,b,t){return a+(b-a)*t}

function showToast(msg, duration=2500){
  const t=$('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),duration);
}

// ═══════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════
function updateClock(){
  const now=new Date();
  const h=String(now.getHours()).padStart(2,'0');
  const m=String(now.getMinutes()).padStart(2,'0');
  const s=String(now.getSeconds()).padStart(2,'0');
  $('clockEl').textContent=h+':'+m+':'+s;
}
updateClock();setInterval(updateClock,1000);

// ═══════════════════════════════════════════
// WEATHER (wttr.in free API)
// ═══════════════════════════════════════════
async function loadWeather(){
  try{
    const r=await fetch('https://wttr.in/?format=j1');
    const d=await r.json();
    const temp=d.current_condition?.[0]?.temp_C;
    const ww=parseInt(d.current_condition?.[0]?.weatherCode||'0');
    let icon='🌡️';
    if(ww===0)icon='☀️';
    else if(ww<=3)icon='⛅';
    else if(ww<=61)icon='🌧️';
    else if(ww<=79)icon='❄️';
    else if(ww<=99)icon='⛈️';
    $('wIcon').textContent=icon;
    $('wTemp').textContent=(temp||'--')+'°C';
    $('weatherChip').style.display='flex';
  }catch(e){}
}
loadWeather();

// ═══════════════════════════════════════════
// PARTICLE CANVAS BACKGROUND
// ═══════════════════════════════════════════
const canvas=$('bgCanvas');
const ctx=canvas.getContext('2d');
let W,H;
const STARS=[];
function resizeCanvas(){
  W=canvas.width=window.innerWidth;
  H=canvas.height=window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize',resizeCanvas);

class Star{
  constructor(){this.reset(true)}
  reset(init=false){
    this.x=Math.random()*W;
    this.y=init?Math.random()*H:H+5;
    this.size=Math.random()*.8+.2;
    this.speed=Math.random()*.15+.05;
    this.alpha=Math.random();
    this.alphaDir=Math.random()>.5?1:-1;
  }
  update(){
    this.alpha+=this.alphaDir*.004;
    if(this.alpha>1){this.alpha=1;this.alphaDir=-1}
    if(this.alpha<0){this.alpha=0;this.alphaDir=1}
  }
  draw(){
    ctx.globalAlpha=this.alpha*.3;
    ctx.fillStyle='#fff';
    ctx.beginPath();
    ctx.arc(this.x,this.y,this.size,0,Math.PI*2);
    ctx.fill();
  }
}
for(let i=0;i<120;i++)STARS.push(new Star());

// Aurora waves
let aurora={t:0};
function drawAurora(){
  aurora.t+=.003;
  const grad=ctx.createLinearGradient(0,0,0,H*.6);
  grad.addColorStop(0,'rgba(0,0,0,0)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.globalAlpha=.06;
  ctx.fillStyle=grad;

  // Draw wavy aurora lines
  for(let i=0;i<3;i++){
    const yBase=H*.15+i*40;
    ctx.beginPath();
    ctx.moveTo(0,yBase);
    for(let x=0;x<=W;x+=10){
      const y=yBase+Math.sin(x*.005+aurora.t+i*1.2)*30+Math.sin(x*.01-aurora.t*.7)*15;
      ctx.lineTo(x,y);
    }
    ctx.lineTo(W,0);ctx.lineTo(0,0);ctx.closePath();
    const c=i===0?'rgba(29,185,84,':'rgba(99,100,255,';
    ctx.fillStyle=c+(0.04+i*.01)+')';
    ctx.globalAlpha=1;
    ctx.fill();
  }
}

function animCanvas(){
  ctx.clearRect(0,0,W,H);
  drawAurora();
  ctx.globalAlpha=1;
  STARS.forEach(s=>{s.update();s.draw()});
  ctx.globalAlpha=1;
  requestAnimationFrame(animCanvas);
}
animCanvas();

// ═══════════════════════════════════════════
// WAVEFORM BARS
// ═══════════════════════════════════════════
const waveform=$('waveform');
const WAVE_COUNT=36;
const wvBars=[];
for(let i=0;i<WAVE_COUNT;i++){
  const b=document.createElement('div');
  b.className='wv';
  const mid=WAVE_COUNT/2;
  const dist=Math.abs(i-mid)/mid;
  const maxH=26-dist*10;
  b.style.height=(3+Math.random()*maxH)+'px';
  const delay=(Math.random()*.6).toFixed(2);
  const dur=(.3+Math.random()*.5).toFixed(2);
  b.style.animation=\`wvpulse \${dur}s ease-in-out \${delay}s infinite alternate\`;
  waveform.appendChild(b);
  wvBars.push(b);
}

function animateWaveformIdle(){
  wvBars.forEach((b,i)=>{
    const mid=WAVE_COUNT/2;
    const dist=Math.abs(i-mid)/mid;
    const h=3+Math.sin(Date.now()*.002+i*.4)*(10-dist*8);
    b.style.height=Math.max(3,h)+'px';
  });
  if(!isPlaying) requestAnimationFrame(animateWaveformIdle);
}

// ═══════════════════════════════════════════
// MUSIC NOTE PARTICLES
// ═══════════════════════════════════════════
const NOTES=['♪','♫','♩','♬','🎵','🎶'];
function spawnNote(){
  if(!isPlaying) return;
  const el=document.createElement('div');
  el.className='note';
  el.textContent=NOTES[Math.floor(Math.random()*NOTES.length)];
  el.style.left=(15+Math.random()*70)+'vw';
  el.style.bottom='80px';
  el.style.fontSize=(12+Math.random()*14)+'px';
  el.style.color=accentColor;
  el.style.animationDuration=(2+Math.random()*2)+'s';
  el.style.filter=\`drop-shadow(0 0 6px \${accentColor}88)\`;
  document.body.appendChild(el);
  el.addEventListener('animationend',()=>el.remove());
}

// ═══════════════════════════════════════════
// PIXEL CAT MASCOT (CSS art)
// ═══════════════════════════════════════════
const catColors=['#f5a623','#666','#fff','#f08','#a3d','#4af'];
let catColor=catColors[0];
let catX=window.innerWidth*1.1;
let catDir=-1; // -1 = left, 1 = right
let catSpeed=1.8;
let catFrame=0;
let catFrameTimer=0;
let catWalkAnim=0;
let catMood='walk';
let catMoodTimer=0;
let isPlaying=false;
let accentColor='#1db954';

// SVG pixel cat frames
function makeCatSVG(frame,color,mood){
  // Simple pixel cat using rects
  const flip=catDir===1?'transform="scale(-1,1) translate(-48,0)"':'';
  const legPhase=frame%2===0;
  // Body
  const b=color;
  const ear=color;
  // Tail wag
  const tailPhase=frame%4;
  const tailRots=[0,15,0,-15];
  const tailRot=tailPhase*10-15;
  const eye=mood==='happy'?'arc':'dot';
  const legs=legPhase?
    \`<rect x="8" y="32" width="5" height="10" fill="\${b}"/>
     <rect x="18" y="34" width="5" height="8" fill="\${b}"/>
     <rect x="26" y="32" width="5" height="10" fill="\${b}"/>
     <rect x="36" y="34" width="5" height="8" fill="\${b}"/>\`
    :\`<rect x="8" y="34" width="5" height="8" fill="\${b}"/>
     <rect x="18" y="32" width="5" height="10" fill="\${b}"/>
     <rect x="26" y="34" width="5" height="8" fill="\${b}"/>
     <rect x="36" y="32" width="5" height="10" fill="\${b}"/>\`;
  const eyes=mood==='happy'?
    \`<path d="M16 18 Q19 15 22 18" fill="none" stroke="#1a0a00" stroke-width="2" stroke-linecap="round"/>
     <path d="M28 18 Q31 15 34 18" fill="none" stroke="#1a0a00" stroke-width="2" stroke-linecap="round"/>\`
    :\`<circle cx="19" cy="18" r="3" fill="#1a0a00"/>
     <circle cx="31" cy="18" r="3" fill="#1a0a00"/>
     <circle cx="20" cy="17" r="1" fill="rgba(255,255,255,.7)"/>
     <circle cx="32" cy="17" r="1" fill="rgba(255,255,255,.7)"/>\`;
  return \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 44" width="64" height="56" style="image-rendering:pixelated">
  <g \${flip}>
  <!-- ears -->
  <polygon points="6,14 12,2 18,14" fill="\${ear}"/>
  <polygon points="10,12 13,5 16,12" fill="#ffccaa"/>
  <polygon points="30,14 36,2 42,14" fill="\${ear}"/>
  <polygon points="32,12 36,5 38,12" fill="#ffccaa"/>
  <!-- body -->
  <rect x="6" y="12" width="36" height="24" rx="10" fill="\${b}"/>
  <!-- head circle -->
  <ellipse cx="24" cy="18" rx="16" ry="14" fill="\${b}"/>
  <!-- belly -->
  <ellipse cx="24" cy="26" rx="10" ry="8" fill="#fff8ee" opacity=".5"/>
  <!-- eyes -->
  \${eyes}
  <!-- nose -->
  <polygon points="24,22 22,25 26,25" fill="#ff9999"/>
  <!-- mouth -->
  <path d="M22 25 Q24 28 26 25" fill="none" stroke="#cc7777" stroke-width="1.5" stroke-linecap="round"/>
  <!-- whiskers -->
  <line x1="8" y1="23" x2="20" y2="24" stroke="#fff8ee" stroke-width="1" opacity=".7"/>
  <line x1="8" y1="26" x2="20" y2="26" stroke="#fff8ee" stroke-width="1" opacity=".7"/>
  <line x1="28" y1="24" x2="40" y2="23" stroke="#fff8ee" stroke-width="1" opacity=".7"/>
  <line x1="28" y1="26" x2="40" y2="26" stroke="#fff8ee" stroke-width="1" opacity=".7"/>
  <!-- legs -->
  \${legs}
  <!-- tail -->
  <g transform-origin="6 34" transform="rotate(\${tailRot},6,34)">
    <path d="M8 36 Q-8 28 -4 18 Q0 10 6 14" fill="none" stroke="\${b}" stroke-width="6" stroke-linecap="round"/>
  </g>
  </g>
</svg>\`;
}

function buildCat(){
  const stage=$('catStage');
  stage.innerHTML='';
  const container=document.createElement('div');
  container.className='cat-container';
  container.id='catContainer';
  container.innerHTML=makeCatSVG(0,catColor,'normal');
  stage.appendChild(container);
}
buildCat();

let lastCatTime=0;
function updateCat(ts){
  const dt=ts-lastCatTime;
  lastCatTime=ts;
  if(dt>100)return requestAnimationFrame(updateCat);

  catFrameTimer+=dt;
  catMoodTimer-=dt;

  const speed=isPlaying?catSpeed*1.6:catSpeed;
  catX+=catDir*speed;

  if(catX<-80){catX=-80;catDir=1;catColor=catColors[Math.floor(Math.random()*catColors.length)]}
  if(catX>window.innerWidth+20){catX=window.innerWidth+20;catDir=-1;catColor=catColors[Math.floor(Math.random()*catColors.length)]}

  if(catFrameTimer>200){
    catFrame=(catFrame+1)%4;
    catFrameTimer=0;
  }
  catWalkAnim=(catWalkAnim+1)%8;

  const mood=(catMoodTimer>0)?catMood:'normal';
  const el=$('catContainer');
  if(el){
    el.style.left=catX+'px';
    el.innerHTML=makeCatSVG(catFrame,catColor,mood);
    // subtle bob
    const bob=Math.sin(catWalkAnim*Math.PI/4)*2;
    el.style.transform=\`translateY(\${bob}px)\`;
  }
  requestAnimationFrame(updateCat);
}
requestAnimationFrame(updateCat);

// ═══════════════════════════════════════════
// COLOR EXTRACTION FROM ALBUM ART
// ═══════════════════════════════════════════
const imgSampler=new Image();
imgSampler.crossOrigin='anonymous';
let accentRgb={r:29,g:185,b:84};

function extractColor(url){
  return new Promise(resolve=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      try{
        const c=document.createElement('canvas');
        c.width=c.height=40;
        const cx=c.getContext('2d');
        cx.drawImage(img,0,0,40,40);
        const data=cx.getImageData(0,0,40,40).data;
        let r=0,g=0,b=0,count=0;
        for(let i=0;i<data.length;i+=16){
          const ri=data[i],gi=data[i+1],bi=data[i+2];
          const brightness=(ri+gi+bi)/3;
          const saturation=Math.max(ri,gi,bi)-Math.min(ri,gi,bi);
          if(brightness>30&&brightness<220&&saturation>40){
            r+=ri;g+=gi;b+=bi;count++;
          }
        }
        if(count>0){r=Math.round(r/count);g=Math.round(g/count);b=Math.round(b/count)}
        else{r=29;g=185;b=84}
        resolve({r,g,b});
      }catch(e){resolve({r:29,g:185,b:84})}
    };
    img.onerror=()=>resolve({r:29,g:185,b:84});
    img.src=url;
  });
}

async function applyAccent(artUrl){
  const {r,g,b}=await extractColor(artUrl);
  // Boost saturation
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  const factor=1.3;
  const mid=(max+min)/2;
  const nr=Math.round(Math.min(255,mid+(r-mid)*factor));
  const ng=Math.round(Math.min(255,mid+(g-mid)*factor));
  const nb=Math.round(Math.min(255,mid+(b-mid)*factor));

  accentColor=\`rgb(\${nr},\${ng},\${nb})\`;
  accentRgb={r:nr,g:ng,b:nb};

  document.documentElement.style.setProperty('--accent',accentColor);
  document.documentElement.style.setProperty('--accent-rgb',\`\${nr},\${ng},\${nb}\`);
  $('cardGlow').style.background=\`radial-gradient(ellipse,rgba(\${nr},\${ng},\${nb},.35),transparent 70%)\`;

  wvBars.forEach(b=>{b.style.background=accentColor});
  document.querySelectorAll('.vis-bar').forEach(b=>{b.style.background=accentColor});
}

// ═══════════════════════════════════════════
// SCROBBLE COUNTER (last.fm-free endpoint)
// ═══════════════════════════════════════════
let scrobbleCount=0;
function updateScrobble(){
  scrobbleCount++;
  $('scrobbleCount').textContent=scrobbleCount+' plays';
}

// ═══════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════
let raf,startTime,startPos,lastLyric,lastTitle,lastArt,state;
let noteTimer=0;

function tickProgress(){
  if(!state?.playing) return;
  const pos=Math.min(startPos+(Date.now()-startTime),state.durationMs||0);
  const pct=state.durationMs?(pos/state.durationMs*100):0;
  $('progressFill').style.width=pct+'%';
  $('timePos').textContent=fmt(pos);
  // spawn notes occasionally
  noteTimer+=16;
  if(noteTimer>2200){noteTimer=0;spawnNote()}
  raf=requestAnimationFrame(tickProgress);
}

async function apply(s){
  state=s;
  isPlaying=!!s?.playing;

  const logoDot=$('logoDot');
  const visBars=$('visBars');
  const waveformEl=$('waveform');

  if(!s?.playing){
    $('nowPlaying').style.display='none';
    $('idle').style.display='block';
    logoDot.classList.add('off');
    visBars.classList.replace('playing','paused');
    waveformEl.classList.replace('playing','paused');
    $('vinyl').classList.remove('playing');
    cancelAnimationFrame(raf);
    return;
  }

  $('nowPlaying').style.display='block';
  $('idle').style.display='none';
  logoDot.classList.remove('off');
  visBars.classList.replace('paused','playing');
  waveformEl.classList.replace('paused','playing');
  $('vinyl').classList.add('playing');

  // Track change
  if(s.title!==lastTitle){
    if(lastTitle) showToast('🎵 Now playing: '+s.title);
    lastTitle=s.title;
    catMood='happy';catMoodTimer=3000;
    updateScrobble();
  }

  $('trackTitle').textContent=s.title||'—';
  $('trackArtist').textContent=s.artist||'—';

  // Marquee for long titles
  const titleEl=$('trackTitle');
  const wrapEl=$('trackTitleWrap');
  if(titleEl.scrollWidth>wrapEl.clientWidth){
    titleEl.innerHTML=s.title+' &nbsp;&nbsp;&nbsp;&nbsp; '+s.title;
    titleEl.classList.add('marquee-inner','running');
  } else {
    titleEl.className='';
  }

  if(s.genre){
    $('genreText').textContent=s.genre;
    $('genreBadge').style.display='inline-flex';
  } else {
    $('genreBadge').style.display='none';
  }

  if(s.artworkUrl&&s.artworkUrl!==lastArt){
    lastArt=s.artworkUrl;
    const url="url('"+s.artworkUrl+"')";
    $('art').style.backgroundImage=url;
    const bgBlur=$('bgBlur');
    bgBlur.style.backgroundImage=url;
    bgBlur.classList.add('loaded');
    applyAccent(s.artworkUrl);
  }

  $('timeDur').textContent=fmt(s.durationMs||0);
  cancelAnimationFrame(raf);
  startTime=Date.now();startPos=s.positionMs;
  tickProgress();

  // Lyrics transition
  const lyricEl=$('lyric');
  const txt=s.lyricLine;
  if(txt!==lastLyric){
    lyricEl.classList.add('fade');
    setTimeout(()=>{
      if(!s.hasLyrics){
        lyricEl.textContent='(lirik tidak tersedia)';
        lyricEl.classList.add('no-lyric');
      } else {
        lyricEl.textContent=txt||'♪';
        lyricEl.classList.remove('no-lyric');
      }
      lyricEl.style.color=accentColor;
      lyricEl.style.textShadow=\`0 0 30px rgba(\${accentRgb.r},\${accentRgb.g},\${accentRgb.b},.5)\`;
      lyricEl.classList.remove('fade');
    },300);
    lastLyric=txt;
  }
}

// ═══════════════════════════════════════════
// SSE
// ═══════════════════════════════════════════
const es=new EventSource('/events');
es.onmessage=e=>apply(JSON.parse(e.data));
es.onerror=()=>{};

// ═══════════════════════════════════════════
// CAT EASTER EGG — double-click
// ═══════════════════════════════════════════
document.addEventListener('dblclick',()=>{
  catMood='happy';catMoodTimer=4000;
  spawnNote();spawnNote();spawnNote();
  showToast('🐱 Nyan~!');
});
</script>
</body>
</html>`;

app.get("/", (_req, res) => res.send(HTML));

export function startWebServer(port = 3000) {
  const server = createServer(app);
  server.listen(port, () => {});
  return `http://localhost:${port}`;
}
