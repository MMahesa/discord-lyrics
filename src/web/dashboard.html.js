// Browser dashboard — rebuilt with Tailwind CDN + clean SSE reconnect logic.
// User avatar: drop any PNG into ./assets/ and set AVATAR_FILE in .env
// e.g.  AVATAR_FILE=myavatar.png  → served at /assets/myavatar.png

export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Discord Lyrics</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>
tailwind.config = {
  theme: {
    extend: {
      fontFamily: { sans: ['Space Grotesk','system-ui','sans-serif'], mono: ['JetBrains Mono','monospace'] },
      colors: {
        base: '#12131a',
        surface: '#1a1b26',
        panel: '#1e2030',
        border: 'rgba(255,255,255,0.08)',
        accent: 'var(--accent)',
      }
    }
  }
}
</script>
<style>
  :root { --accent: #7c6af7; --accent-r:124; --accent-g:106; --accent-b:247; }
  *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
  html,body { height:100%; background:#12131a; font-family:'Space Grotesk',system-ui,sans-serif; color:#e0e0ff; overflow:hidden; }

  /* ── Animated background ── */
  #bg { position:fixed; inset:0; z-index:0; background-size:cover; background-position:center;
        filter:blur(60px) saturate(1.6) brightness(0.35); transition:background-image 1.5s ease; opacity:0;
        transform:scale(1.1); }
  #bg.show { opacity:1; }

  /* ── Glass card ── */
  .glass {
    background: rgba(30,32,48,0.72);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
  }

  /* ── Album art ── */
  #art {
    width:100%; aspect-ratio:1/1; border-radius:16px;
    background: #1e2030 center/cover no-repeat;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    transition: background-image 0.8s ease;
    flex-shrink:0;
  }

  /* ── Lyric line ── */
  #lyric {
    transition: opacity .3s ease, transform .3s ease;
    min-height: 1.6em;
  }
  #lyric.fade { opacity:0; transform:translateY(4px); }

  /* ── Progress bar ── */
  #progressBg { height:4px; background:rgba(255,255,255,0.12); border-radius:4px; overflow:hidden; }
  #progressFill { height:100%; background:var(--accent); border-radius:4px;
                  transition:width 0.8s linear; width:0%; }

  /* ── Status dots ── */
  .dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,0.2); flex-shrink:0; }
  .dot.on { background:var(--accent); box-shadow: 0 0 8px var(--accent); animation: pulse 2s infinite; }

  /* ── Live pill ── */
  #livePill {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; letter-spacing:.5px;
    background:rgba(255,255,255,0.07); color:rgba(255,255,255,0.4);
    border:1px solid rgba(255,255,255,0.08); transition:all .3s;
  }
  #livePill.on { background:rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.18);
                 color:var(--accent); border-color:rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.3); }

  /* ── Avatar ── */
  #avatarImg {
    width:52px; height:52px; border-radius:50%; object-fit:cover;
    border:2px solid rgba(255,255,255,0.1);
    box-shadow:0 4px 16px rgba(0,0,0,0.4);
  }

  /* ── Waveform ── */
  .wv { display:inline-block; width:3px; border-radius:2px; background:var(--accent);
        transform-origin:bottom; transition:background .3s; }
  @keyframes wvPulse { to { transform:scaleY(var(--peak)); } }
  .wv.anim { animation: wvPulse var(--dur) ease-in-out var(--delay) infinite alternate; }

  /* ── Floating notes ── */
  .note { position:fixed; pointer-events:none; user-select:none; z-index:50;
          animation: floatUp 3s ease-out forwards; font-size:18px; opacity:.8; }
  @keyframes floatUp { to { transform:translateY(-120px); opacity:0; } }

  /* ── Pulse ── */
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

  /* ── Toast ── */
  #toast {
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(20px);
    background:rgba(30,32,48,0.95); border:1px solid rgba(255,255,255,0.1);
    border-radius:12px; padding:10px 18px; font-size:13px; color:#e0e0ff;
    opacity:0; transition:all .3s; z-index:999; pointer-events:none; backdrop-filter:blur(12px);
    white-space:nowrap;
  }
  #toast.show { opacity:1; transform:translateX(-50%) translateY(0); }

  /* ── Genre badge ── */
  .badge {
    display:inline-flex; align-items:center; gap:4px; padding:3px 10px;
    border-radius:999px; font-size:11px; font-weight:500;
    background:rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.15);
    color:var(--accent); border:1px solid rgba(var(--accent-r),var(--accent-g),var(--accent-b),0.25);
  }

  /* ── SSE reconnect overlay (hidden by default) ── */
  #reconnectBanner {
    display:none; position:fixed; top:16px; left:50%; transform:translateX(-50%);
    background:rgba(220,50,50,0.9); color:#fff; padding:6px 16px;
    border-radius:999px; font-size:12px; font-weight:600; z-index:1000;
  }
  #reconnectBanner.show { display:block; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:2px; }
</style>
</head>
<body>

<!-- Blurred background -->
<div id="bg"></div>
<!-- Scrim -->
<div class="fixed inset-0 z-[1]" style="background:linear-gradient(160deg,rgba(10,9,20,0.6),rgba(5,4,15,0.85));pointer-events:none"></div>

<!-- Reconnect banner -->
<div id="reconnectBanner">⚠ Reconnecting to server…</div>

<!-- Main layout -->
<div class="fixed inset-0 z-10 flex items-center justify-center p-4">
  <div class="glass w-full max-w-2xl p-6 flex flex-col gap-5" style="max-height:calc(100vh - 32px)">

    <!-- Top bar -->
    <div class="flex items-center justify-between flex-shrink-0">
      <div class="flex items-center gap-3">
        <!-- Avatar -->
        <div id="avatarWrap" style="display:none">
          <img id="avatarImg" src="" alt="avatar">
        </div>
        <div>
          <div class="text-sm font-semibold text-white">Discord Lyrics</div>
          <div class="text-xs" style="color:rgba(255,255,255,0.4)">by mmahesa</div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <!-- Clock -->
        <div id="clock" class="font-mono text-xs" style="color:rgba(255,255,255,0.35)">00:00:00</div>
        <!-- Live pill -->
        <div id="livePill">
          <span class="dot" id="liveDot"></span>
          <span id="liveTxt">offline</span>
        </div>
      </div>
    </div>

    <!-- Idle screen -->
    <div id="idle" class="flex flex-col items-center justify-center gap-3 py-10">
      <div class="text-4xl">🎧</div>
      <div class="text-sm font-medium" style="color:rgba(255,255,255,0.45)">Waiting for Spotify to play…</div>
      <div class="text-xs font-mono mt-1" style="color:rgba(255,255,255,0.25)" id="sseStatus">Connecting…</div>
    </div>

    <!-- Now playing (hidden until music starts) -->
    <div id="nowPlaying" style="display:none" class="flex gap-5 flex-1 min-h-0">

      <!-- Left: album art + waveform -->
      <div class="flex flex-col gap-3 flex-shrink-0" style="width:180px">
        <div id="art"></div>
        <!-- Waveform -->
        <div id="waveform" class="flex items-end justify-center gap-[2px]" style="height:32px"></div>
      </div>

      <!-- Right: info -->
      <div class="flex flex-col gap-3 flex-1 min-w-0">

        <!-- Track info -->
        <div class="flex flex-col gap-1">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div id="trackTitle" class="font-bold text-white leading-tight truncate" style="font-size:18px">—</div>
              <div id="trackArtist" class="text-sm mt-0.5 truncate" style="color:rgba(255,255,255,0.55)">—</div>
            </div>
            <div id="genreBadge" class="badge flex-shrink-0" style="display:none">
              <span>♦</span><span id="genreText"></span>
            </div>
          </div>
        </div>

        <!-- Progress -->
        <div class="flex flex-col gap-1">
          <div id="progressBg"><div id="progressFill"></div></div>
          <div class="flex justify-between text-xs font-mono" style="color:rgba(255,255,255,0.35)">
            <span id="timePos">0:00</span>
            <span id="timeDur">0:00</span>
          </div>
        </div>

        <!-- Lyric -->
        <div class="glass flex-1 flex items-center justify-center p-4 text-center" style="min-height:60px">
          <div id="lyric" class="text-sm font-medium leading-relaxed" style="color:rgba(255,255,255,0.85)">♩</div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-3 gap-2">
          <div class="glass px-3 py-2">
            <div class="text-xs mb-1" style="color:rgba(255,255,255,0.4)">Tracks played</div>
            <div class="font-bold text-white text-lg leading-none" id="scrobbleCount">0</div>
          </div>
          <div class="glass px-3 py-2">
            <div class="text-xs mb-1" style="color:rgba(255,255,255,0.4)">Discord</div>
            <div class="font-semibold text-sm" id="discordStatus" style="color:var(--accent)">idle</div>
          </div>
          <div class="glass px-3 py-2">
            <div class="text-xs mb-1" style="color:rgba(255,255,255,0.4)">Uptime</div>
            <div class="font-mono text-sm text-white" id="uptimeEl">0:00</div>
          </div>
        </div>

      </div>
    </div>

    <!-- Footer -->
    <div class="flex-shrink-0 flex items-center justify-between">
      <div class="text-xs" style="color:rgba(255,255,255,0.2)">lrclib.net + iTunes</div>
      <div class="text-xs font-mono" style="color:rgba(255,255,255,0.2)" id="lyricsSource">—</div>
    </div>

  </div>
</div>

<!-- Floating notes container -->
<div id="notesLayer" class="fixed inset-0 z-20 pointer-events-none overflow-hidden"></div>

<!-- Toast -->
<div id="toast"></div>

<script>
// ── Helpers ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = ms => { const s=Math.floor(ms/1000),m=Math.floor(s/60); return m+':'+String(s%60).padStart(2,'0'); };

function showToast(msg, ms=2800){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),ms);
}

// ── Clock & uptime ────────────────────────────────────────────
const startedAt = Date.now();
function tick(){
  const n=new Date(); $('clock').textContent=[n.getHours(),n.getMinutes(),n.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');
  $('uptimeEl').textContent = fmt(Date.now()-startedAt);
}
tick(); setInterval(tick,1000);

// ── Avatar: loaded from /assets/ if AVATAR_FILE is set ────────
// The server injects AVATAR_FILE via meta tag
const avatarMeta = document.querySelector('meta[name="avatar-file"]');
if(avatarMeta && avatarMeta.content){
  const img=$('avatarImg');
  img.src='/assets/'+avatarMeta.content;
  img.onload=()=>{ $('avatarWrap').style.display='block'; };
  img.onerror=()=>{}; // file not found → stays hidden
}

// ── Waveform ──────────────────────────────────────────────────
const waveform=$('waveform');
const WV=28, wvBars=[];
for(let i=0;i<WV;i++){
  const b=document.createElement('div'); b.className='wv';
  const mid=WV/2, dist=Math.abs(i-mid)/mid;
  const peak=Math.max(0.15, 0.9-dist*0.6).toFixed(2);
  const dur=(.35+Math.random()*.45).toFixed(2);
  const delay=(Math.random()*.5).toFixed(2);
  b.style.cssText='height:4px;--peak:'+peak+';--dur:'+dur+'s;--delay:'+delay+'s';
  waveform.appendChild(b); wvBars.push(b);
}
function setWaveAnim(on){
  wvBars.forEach(b=>{ if(on) b.classList.add('anim'); else { b.classList.remove('anim'); b.style.height='4px'; } });
}

// ── Floating notes ────────────────────────────────────────────
const NOTES=['♩','♪','♫','♬'];
let noteInterval=null;
function spawnNote(){
  const el=document.createElement('div'); el.className='note';
  el.textContent=NOTES[Math.floor(Math.random()*NOTES.length)];
  el.style.left=(10+Math.random()*80)+'vw'; el.style.bottom='80px';
  el.style.color='var(--accent)'; el.style.animationDuration=(2.2+Math.random()*1.8)+'s';
  $('notesLayer').appendChild(el);
  el.addEventListener('animationend',()=>el.remove());
}
function startNotes(){ if(!noteInterval) noteInterval=setInterval(spawnNote,2500); }
function stopNotes(){ clearInterval(noteInterval); noteInterval=null; }

// ── Accent color extraction ───────────────────────────────────
function setAccent(r,g,b){
  document.documentElement.style.setProperty('--accent',\`rgb(\${r},\${g},\${b})\`);
  document.documentElement.style.setProperty('--accent-r',r);
  document.documentElement.style.setProperty('--accent-g',g);
  document.documentElement.style.setProperty('--accent-b',b);
}
function extractAccent(url){
  const img=new Image(); img.crossOrigin='anonymous';
  img.onload=()=>{
    try{
      const c=document.createElement('canvas'); c.width=c.height=32;
      const cx=c.getContext('2d'); cx.drawImage(img,0,0,32,32);
      const d=cx.getImageData(0,0,32,32).data;
      let r=0,g=0,b=0,n=0;
      for(let i=0;i<d.length;i+=16){
        const ri=d[i],gi=d[i+1],bi=d[i+2];
        const bright=(ri+gi+bi)/3, sat=Math.max(ri,gi,bi)-Math.min(ri,gi,bi);
        if(bright>30&&bright<230&&sat>50){r+=ri;g+=gi;b+=bi;n++;}
      }
      if(n>0){ r=Math.round(r/n); g=Math.round(g/n); b=Math.round(b/n); }
      else { r=124;g=106;b=247; }
      // Boost saturation slightly
      const mid=(Math.max(r,g,b)+Math.min(r,g,b))/2, f=1.25;
      setAccent(Math.min(255,Math.round(mid+(r-mid)*f)),Math.min(255,Math.round(mid+(g-mid)*f)),Math.min(255,Math.round(mid+(b-mid)*f)));
    }catch(e){ setAccent(124,106,247); }
  };
  img.onerror=()=>setAccent(124,106,247);
  img.src=url;
}

// ── State application ─────────────────────────────────────────
let raf, startTime, startPos, currentDurMs=0;
let lastTitle='', lastArt='', lastLyric='';
let scrobbles=0;
let isPlaying=false;

function tickProgress(){
  if(!isPlaying) return;
  const pos = Math.min(startPos+(Date.now()-startTime), currentDurMs||0);
  const pct  = currentDurMs ? (pos/currentDurMs*100) : 0;
  $('progressFill').style.width=pct+'%';
  $('timePos').textContent=fmt(pos);
  raf=requestAnimationFrame(tickProgress);
}

function apply(s){
  isPlaying = !!(s && s.playing);

  if(!isPlaying){
    $('idle').style.display='flex';
    $('nowPlaying').style.display='none';
    const lp=$('livePill'), ld=$('liveDot'), lt=$('liveTxt');
    lp.classList.remove('on'); ld.classList.remove('on'); lt.textContent='offline';
    $('discordStatus').textContent='idle';
    $('discordStatus').style.color='rgba(255,255,255,0.4)';
    $('lyricsSource').textContent='—';
    cancelAnimationFrame(raf);
    setWaveAnim(false);
    stopNotes();
    return;
  }

  $('idle').style.display='none';
  $('nowPlaying').style.display='flex';
  const lp=$('livePill'), ld=$('liveDot'), lt=$('liveTxt');
  lp.classList.add('on'); ld.classList.add('on'); lt.textContent='live';
  $('discordStatus').textContent='synced';
  $('discordStatus').style.color='var(--accent)';
  $('lyricsSource').textContent = s.hasLyrics ? 'lrclib.net' : 'no lyrics found';
  setWaveAnim(true);
  startNotes();

  // New track
  if(s.title !== lastTitle){
    if(lastTitle) showToast('▶ '+s.title);
    lastTitle=s.title;
    scrobbles++; $('scrobbleCount').textContent=scrobbles;
  }

  $('trackTitle').textContent  = s.title  || '—';
  $('trackArtist').textContent = s.artist || '—';

  // Genre
  if(s.genre){ $('genreText').textContent=s.genre; $('genreBadge').style.display='inline-flex'; }
  else $('genreBadge').style.display='none';

  // Artwork
  if(s.artworkUrl && s.artworkUrl !== lastArt){
    lastArt=s.artworkUrl;
    $('art').style.backgroundImage="url('"+s.artworkUrl+"')";
    const bg=$('bg'); bg.style.backgroundImage="url('"+s.artworkUrl+"')"; bg.classList.add('show');
    extractAccent(s.artworkUrl);
  }

  // Progress
  currentDurMs=s.durationMs||0;
  $('timeDur').textContent=fmt(s.durationMs||0);
  cancelAnimationFrame(raf);
  startTime=Date.now(); startPos=s.positionMs||0;
  tickProgress();

  // Lyric
  const txt=s.lyricLine;
  if(txt !== lastLyric){
    const el=$('lyric'); el.classList.add('fade');
    setTimeout(()=>{
      el.textContent = txt || (s.hasLyrics?'♩':'(lyrics unavailable)');
      el.style.color = s.hasLyrics ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)';
      el.classList.remove('fade');
    },300);
    lastLyric=txt;
  }
}

// ── SSE with auto-reconnect ───────────────────────────────────
let es, retryDelay=1000, retryTimer=null;
const reconnectBanner=$('reconnectBanner');

function connectSSE(){
  clearTimeout(retryTimer);
  if(es){ try{es.close();}catch(e){} }

  $('sseStatus').textContent='Connecting to server…';
  es=new EventSource('/events');

  es.onopen=()=>{
    retryDelay=1000; // reset backoff on success
    reconnectBanner.classList.remove('show');
    $('sseStatus').textContent='Connected ✓';
    // Immediately fetch latest state via polling fallback
    fetch('/api/state').then(r=>r.json()).then(d=>{ if(d.state) apply(d.state); }).catch(()=>{});
  };

  es.onmessage=e=>{
    try{ apply(JSON.parse(e.data)); }catch(err){}
  };

  es.onerror=()=>{
    es.close();
    reconnectBanner.classList.add('show');
    $('sseStatus').textContent='Reconnecting in '+(retryDelay/1000).toFixed(0)+'s…';
    retryTimer=setTimeout(()=>{ connectSSE(); retryDelay=Math.min(retryDelay*1.5, 15000); }, retryDelay);
  };
}

connectSSE();

// Polling fallback — keeps UI alive even if SSE breaks silently
setInterval(()=>{
  if(!es || es.readyState===2){
    fetch('/api/state').then(r=>r.json()).then(d=>{ if(d.state) apply(d.state); }).catch(()=>{});
  }
}, 5000);

// Fun: double-click to spawn notes
document.addEventListener('dblclick',()=>{
  for(let i=0;i<5;i++) setTimeout(spawnNote,i*120);
  showToast('🎵');
});
</script>
</body>
</html>`;
