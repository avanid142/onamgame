/* =====================================================================
   Pookalam Master — memory game module (converted from the Flask app)
   Loaded as its OWN <script> tag, after script.js. Does not read, call,
   or modify anything inside script.js's closure — it only shares the DOM
   convention (elements with class="screen" toggled via .active) and the
   arcade's localStorage-high-score pattern, so the two files can never
   collide even though both are present on the same page.
===================================================================== */
(function(){
"use strict";

/* ------------------------------------------------------------------
   DATA — ported directly from app.py
------------------------------------------------------------------ */
var PALETTE = [
  {name:"Marigold",  hex:"#F5941F"},
  {name:"Vermilion",  hex:"#D33B32"},
  {name:"Rose",       hex:"#A85CC1"},
  {name:"Ivory",      hex:"#FBF3D6"},
  {name:"Leaf",       hex:"#2F8F52"},
  {name:"Indigo",     hex:"#3C5A78"}
];
var PALETTE_HEXES = PALETTE.map(function(p){ return p.hex; });

var DIFFICULTIES = {
  novice:  {label:"Novice",  rings:2, buildSeconds:50,  peekLives:3},
  adept:   {label:"Adept",   rings:3, buildSeconds:80,  peekLives:2},
  vaidika: {label:"Vaidika", rings:4, buildSeconds:115, peekLives:2}
};
var PEEK_SECONDS = 2.5; // how long a spent peek reveals the reference for

function wedgesForRing(r){ return 5 + r*3; } // inner rings have fewer wedges, mirrors real pookalam density

/* ------------------------------------------------------------------
   Seeded RNG (replaces Python's random.Random(seed)) so a "daily"
   seed like "2026-09-06-adept" produces the identical design for
   every player, exactly like the Flask version's date-seeded round.
------------------------------------------------------------------ */
function hashSeed(str){
  var h = 1779033703 ^ str.length;
  for (var i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h>>>16), 2246822519);
    h = Math.imul(h ^ (h>>>13), 3266489917);
    h ^= h>>>16;
    return h>>>0;
  };
}
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a>>>15, 1 | a);
    t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
    return ((t ^ t>>>14) >>> 0) / 4294967296;
  };
}
function seededRandom(seedStr){ return mulberry32(hashSeed(seedStr)()); }
function choice(rnd, arr){ return arr[Math.floor(rnd()*arr.length)]; }

/* ------------------------------------------------------------------
   generateDesign — ported line-for-line from app.py's generate_design
------------------------------------------------------------------ */
function generateDesign(seed, rings){
  var rnd = seededRandom(seed);
  var design = [], wpr = [];
  for (var r=0; r<rings; r++){
    var n = wedgesForRing(r);
    wpr.push(n);
    var motifLen = (r===0) ? Math.min(n,3) : (n>=4 ? 4 : n);
    var motif = [];
    for (var m=0;m<motifLen;m++) motif.push(choice(rnd, PALETTE_HEXES));
    var ring = [];
    for (var i=0;i<n;i++) ring.push(motif[i % motifLen]);
    design.push(ring);
  }
  return {design:design, wpr:wpr};
}

/* ------------------------------------------------------------------
   makeRound — replaces the /api/round Flask endpoint
------------------------------------------------------------------ */
function makeRound(difficulty, daily){
  var cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.adept;
  var seed;
  if (daily){
    var today = new Date();
    var iso = today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
    seed = iso + "-" + difficulty;
  } else {
    seed = difficulty + "-" + Math.floor(Math.random()*1e9);
  }
  var gen = generateDesign(seed, cfg.rings);
  var memorizeSeconds = Math.max(9, Math.round(cfg.rings*3.6));
  return {
    seed:seed, difficulty:difficulty, label:cfg.label, daily:daily,
    rings:cfg.rings, wedgesPerRing:gen.wpr, design:gen.design,
    memorizeSeconds:memorizeSeconds, buildSeconds:cfg.buildSeconds,
    peekLives:cfg.peekLives
  };
}

/* ------------------------------------------------------------------
   Leaderboard — replaces the SQLite-backed /api/leaderboard endpoint.
   Same shape (top 10, per-seed for daily rounds / per-difficulty for
   practice rounds) but persisted via localStorage, the same mechanism
   the rest of the arcade already uses for high scores. NOTE: because
   there is no server anymore, this board is local to this browser —
   it can't be a truly shared cross-player board the way the Flask
   SQLite version was. See integration notes for a real-backend option.
------------------------------------------------------------------ */
var LB_KEY = "pookalamMasterLeaderboard";
var memoryLB = null;
function loadLB(){
  if (memoryLB) return memoryLB;
  try { memoryLB = JSON.parse(localStorage.getItem(LB_KEY)) || {bySeed:{}, byDifficulty:{}}; }
  catch(e){ memoryLB = {bySeed:{}, byDifficulty:{}}; }
  if (!memoryLB.bySeed) memoryLB.bySeed = {};
  if (!memoryLB.byDifficulty) memoryLB.byDifficulty = {};
  return memoryLB;
}
function saveLB(lb){
  memoryLB = lb;
  try { localStorage.setItem(LB_KEY, JSON.stringify(lb)); } catch(e){ /* memory-only fallback */ }
}
function submitScore(round, name, score, accuracy){
  var lb = loadLB();
  var entry = {name:(name||"Guest").slice(0,24), score:score, accuracy:accuracy, ts:Date.now()};
  var bucket = round.daily ? (lb.bySeed[round.seed] = lb.bySeed[round.seed]||[])
                            : (lb.byDifficulty[round.difficulty] = lb.byDifficulty[round.difficulty]||[]);
  bucket.push(entry);
  bucket.sort(function(a,b){ return b.score-a.score; });
  bucket.length = Math.min(bucket.length, 10);
  saveLB(lb);
  return entry;
}
function getBoard(round){
  var lb = loadLB();
  return round.daily ? (lb.bySeed[round.seed]||[]) : (lb.byDifficulty[round.difficulty]||[]);
}
var HIGH_SCORE_KEY_MEMORY = "pookalamRushMemoryHighScore"; // same naming convention as script.js's keys
var memoryHigh = {};
function getHighScore(){
  try{ var v = parseInt(localStorage.getItem(HIGH_SCORE_KEY_MEMORY),10); if(!isNaN(v)) memoryHigh.v = Math.max(memoryHigh.v||0, v); }
  catch(e){}
  return memoryHigh.v||0;
}
function saveHighScore(v){
  memoryHigh.v = Math.max(memoryHigh.v||0, v);
  try{ localStorage.setItem(HIGH_SCORE_KEY_MEMORY, String(memoryHigh.v)); }catch(e){}
}

/* ------------------------------------------------------------------
   Screen switching — operates on every element with class="screen"
   (including the arcade's own screens), so it never needs to touch
   script.js's private `screens` object to stay in sync with it.
------------------------------------------------------------------ */
function showOnly(id){
  document.querySelectorAll(".screen").forEach(function(el){
    el.classList.toggle("active", el.id === id);
  });
}
function refreshHomeBest(){
  var el = document.getElementById("home-best-memory");
  if (el) el.textContent = "Best: " + getHighScore() + " pts";
}
function goHome(){ refreshHomeBest(); showOnly("screen-home"); }

/* ------------------------------------------------------------------
   Tiny WebAudio blips — same minimal approach as script.js's blip(),
   kept local since this file can't reach that closure's audioCtx.
------------------------------------------------------------------ */
var audioCtx = null;
function audio(){
  if (!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
  return audioCtx;
}
function blip(freq, dur, type){
  var ctx = audio(); if (!ctx) return;
  var o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type||"sine"; o.frequency.value = freq;
  g.gain.value = 0.08;
  o.connect(g); g.connect(ctx.destination);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur);
  o.start(); o.stop(ctx.currentTime+dur);
}

/* ------------------------------------------------------------------
   DOM refs
------------------------------------------------------------------ */
var diffRow = document.getElementById("mm-diff-row");
var dailyCheck = document.getElementById("mm-daily-check");
var nameInput = document.getElementById("mm-name-input");
var boardCanvas = document.getElementById("mm-board");
var boardCtx = boardCanvas.getContext("2d");
var refCanvas = document.getElementById("mm-reference");
var refCtx = refCanvas.getContext("2d");
var statScore = document.getElementById("mm-score");
var statPhase = document.getElementById("mm-phase");
var statPhaseSub = document.getElementById("mm-phase-sub");
var timerFill = document.getElementById("mm-timer-fill");
var swatchesEl = document.getElementById("mm-palette");
var refBlankNote = document.getElementById("mm-ref-blank");
var heartsEl = document.getElementById("mm-hearts");
var peekBtn = document.getElementById("mm-peek-btn");

var difficulty = "adept";
diffRow.addEventListener("click", function(e){
  var btn = e.target.closest(".mm-diff-btn");
  if (!btn) return;
  [].slice.call(diffRow.children).forEach(function(b){ b.classList.remove("active"); });
  btn.classList.add("active");
  difficulty = btn.dataset.difficulty;
});

/* ------------------------------------------------------------------
   Canvas rendering — ported from main.js's drawPookalam/pointToWedge
------------------------------------------------------------------ */
function drawPookalam(ctx, size, colorData, wpr, opts){
  opts = opts||{};
  var cx=size/2, cy=size/2;
  var maxR = size/2 - 6;
  var rings = wpr.length;
  var ringDepth = maxR/rings;
  ctx.clearRect(0,0,size,size);
  for (var r=rings-1; r>=0; r--){
    var outerR = ringDepth*(r+1), innerR = ringDepth*r;
    var n = wpr[r];
    var wedgeAngle = (Math.PI*2)/n;
    for (var i=0;i<n;i++){
      var start = i*wedgeAngle - Math.PI/2, end = start+wedgeAngle;
      var col = colorData[r][i];
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(start)*innerR, cy+Math.sin(start)*innerR);
      ctx.arc(cx,cy,outerR,start,end);
      ctx.lineTo(cx+Math.cos(end)*innerR, cy+Math.sin(end)*innerR);
      ctx.arc(cx,cy,innerR,end,start,true);
      ctx.closePath();
      ctx.fillStyle = col || "rgba(223,246,255,0.06)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,229,255,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(cx,cy, ringDepth*0.2, 0, Math.PI*2);
  ctx.fillStyle = "#0c1226";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,229,255,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (opts.highlightWedge){
    var hw = opts.highlightWedge, r2=hw.r, i2=hw.i, n2=hw.n;
    var outerR2 = ringDepth*(r2+1), innerR2 = ringDepth*r2;
    var wedgeAngle2 = (Math.PI*2)/n2;
    var start2 = i2*wedgeAngle2 - Math.PI/2, end2 = start2+wedgeAngle2;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(start2)*innerR2, cy+Math.sin(start2)*innerR2);
    ctx.arc(cx,cy,outerR2,start2,end2);
    ctx.lineTo(cx+Math.cos(end2)*innerR2, cy+Math.sin(end2)*innerR2);
    ctx.arc(cx,cy,innerR2,end2,start2,true);
    ctx.closePath();
    ctx.strokeStyle = "#7cf7ff";
    ctx.lineWidth = 2.4;
    ctx.stroke();
  }
}
function pointToWedge(canvas, clientX, clientY, wpr){
  var rect = canvas.getBoundingClientRect();
  var scale = canvas.width/rect.width;
  var x = (clientX-rect.left)*scale - canvas.width/2;
  var y = (clientY-rect.top)*scale - canvas.height/2;
  var dist = Math.sqrt(x*x+y*y);
  var maxR = canvas.width/2 - 6;
  var rings = wpr.length;
  var ringDepth = maxR/rings;
  var r = Math.floor(dist/ringDepth);
  if (r<0 || r>=rings) return null;
  var angle = Math.atan2(y,x) + Math.PI/2;
  if (angle<0) angle += Math.PI*2;
  var n = wpr[r];
  var wedgeAngle = (Math.PI*2)/n;
  var i = Math.floor(angle/wedgeAngle) % n;
  return {r:r, i:i, n:n};
}

/* ------------------------------------------------------------------
   Round state + flow — ported from main.js
------------------------------------------------------------------ */
var design=[], placed=[], wpr=[], selectedColor=null, phase="memorize";
var memTimer=null, buildTimer=null, memLeft=0, buildLeft=0, buildTotal=0;
var score=0, streak=0, bestStreak=0, correctPlacements=0, hoverWedge=null, round=null;
var peekLives=0, peekLivesMax=0, peekActive=false, peekTimeout=null;

/* ------------------------------------------------------------------
   PEEK — the "extra life" mechanic. During the build phase, spending
   a life re-reveals the reference for PEEK_SECONDS. The clock keeps
   running, so it's a real trade-off, not a free pause.
------------------------------------------------------------------ */
function updateHearts(){
  var str = "";
  for (var i=0;i<peekLivesMax;i++) str += (i<peekLives ? "❤️" : "🤍");
  heartsEl.textContent = str || "—";
  peekBtn.textContent = "👁️ Peek (" + peekLives + ")";
  peekBtn.disabled = (phase !== "build") || peekLives<=0 || peekActive;
}
function doPeek(){
  if (phase !== "build" || peekLives<=0 || peekActive) return;
  peekLives--;
  peekActive = true;
  updateHearts();
  renderReference(false);
  blip(760,0.12,"sine");
  clearTimeout(peekTimeout);
  peekTimeout = setTimeout(function(){
    peekActive = false;
    if (phase === "build") renderReference(true);
    updateHearts();
  }, PEEK_SECONDS*1000);
}
peekBtn.addEventListener("click", doPeek);

function buildSwatches(){
  swatchesEl.innerHTML = "";
  PALETTE.forEach(function(p){
    var el = document.createElement("div");
    el.className = "swatch" + (p.hex===selectedColor ? " selected" : "");
    el.style.background = p.hex;
    el.title = p.name;
    el.setAttribute("role","button");
    el.setAttribute("aria-label", p.name + " petal color");
    el.addEventListener("click", function(){
      selectedColor = p.hex;
      [].slice.call(swatchesEl.children).forEach(function(c){ c.classList.remove("selected"); });
      el.classList.add("selected");
    });
    swatchesEl.appendChild(el);
  });
  if (!selectedColor) selectedColor = PALETTE[0].hex;
}
function renderBoard(){ drawPookalam(boardCtx, boardCanvas.width, placed, wpr, {highlightWedge:hoverWedge}); }
function renderReference(blank){
  if (blank){
    refCtx.clearRect(0,0,refCanvas.width, refCanvas.height);
    refBlankNote.style.display = "block";
  } else {
    refBlankNote.style.display = "none";
    drawPookalam(refCtx, refCanvas.width, design, wpr, {});
  }
}

boardCanvas.addEventListener("click", function(e){
  if (phase !== "build") return;
  var hit = pointToWedge(boardCanvas, e.clientX, e.clientY, wpr);
  if (!hit) return;
  placeAt(hit.r, hit.i);
});
boardCanvas.addEventListener("mousemove", function(e){
  if (phase !== "build") return;
  hoverWedge = pointToWedge(boardCanvas, e.clientX, e.clientY, wpr);
  renderBoard();
});
boardCanvas.addEventListener("mouseleave", function(){ hoverWedge=null; if (phase==="build") renderBoard(); });
// basic touch support (tap = click on most mobile browsers already fires 'click', this just avoids stuck hover)
boardCanvas.addEventListener("touchstart", function(){ hoverWedge=null; }, {passive:true});

function placeAt(r,i){
  placed[r][i] = selectedColor;
  var correct = design[r][i] === selectedColor;
  var ringWeight = (wpr.length - r);
  if (correct){
    correctPlacements++; streak++; bestStreak = Math.max(bestStreak, streak);
    score += 8*ringWeight;
    blip(560+Math.min(streak,10)*22, 0.1, "triangle");
  } else {
    streak = 0; score = Math.max(0, score-1);
    blip(180, 0.14, "sawtooth");
    shakeBoard();
  }
  statScore.textContent = score;
  renderBoard();
  checkComplete();
}
function shakeBoard(){
  boardCanvas.style.transition = "transform .06s ease";
  boardCanvas.style.transform = "translateX(-4px)";
  setTimeout(function(){ boardCanvas.style.transform = "translateX(4px)"; }, 60);
  setTimeout(function(){ boardCanvas.style.transform = "translateX(0)"; }, 120);
}
function checkComplete(){
  var allFilled = placed.every(function(ring){ return ring.every(function(c){ return c!==null; }); });
  if (allFilled) finishRound();
}

function updateTimerBar(left, total){
  var pct = Math.max(0, Math.min(100, (left/total)*100));
  timerFill.style.width = pct + "%";
}

function startMemorize(){
  audio();
  round = makeRound(difficulty, !!dailyCheck.checked);
  design = round.design;
  wpr = round.wedgesPerRing;
  placed = wpr.map(function(n){ return new Array(n).fill(null); });
  score=0; streak=0; bestStreak=0; correctPlacements=0; hoverWedge=null;
  phase = "memorize";
  peekLivesMax = round.peekLives; peekLives = round.peekLives; peekActive = false;
  clearTimeout(peekTimeout);
  updateHearts();

  statScore.textContent = "0";
  statPhase.textContent = "Memorize";
  statPhaseSub.textContent = round.daily ? "Today's design" : "Study the design";
  renderReference(false);
  renderBoard();
  buildSwatches();
  blip(500,0.12,"triangle");

  memLeft = round.memorizeSeconds;
  var memTotal = memLeft;
  clearInterval(memTimer);
  updateTimerBar(memLeft, memTotal);
  memTimer = setInterval(function(){
    memLeft -= 0.1;
    updateTimerBar(memLeft, memTotal);
    if (memLeft <= 0){ clearInterval(memTimer); startBuild(); }
  }, 100);
}

function startBuild(){
  phase = "build";
  statPhase.textContent = "Build";
  statPhaseSub.textContent = "Recreate from memory";
  renderReference(true);
  blip(700,0.14,"sine");
  updateHearts();
  buildTotal = round.buildSeconds;
  buildLeft = buildTotal;
  updateTimerBar(buildLeft, buildTotal);
  clearInterval(buildTimer);
  buildTimer = setInterval(function(){
    buildLeft -= 0.1;
    updateTimerBar(buildLeft, buildTotal);
    if (buildLeft <= 0){ clearInterval(buildTimer); finishRound(); }
  }, 100);
}

function finishRound(){
  if (phase === "done") return;
  phase = "done";
  clearInterval(memTimer); clearInterval(buildTimer);
  clearTimeout(peekTimeout); peekActive = false;
  peekBtn.disabled = true;

  var totalWedges = 0; wpr.forEach(function(n){ totalWedges += n; });
  var accuracy = totalWedges ? Math.round((correctPlacements/totalWedges)*100) : 0;
  var timeBonus = Math.round(Math.max(0, buildLeft)*4);
  var finalScore = Math.min(1000, score+timeBonus);

  document.getElementById("mm-final-score").textContent = finalScore;
  document.getElementById("mm-b-accuracy").textContent = accuracy + "%";
  document.getElementById("mm-b-speed").textContent = Math.max(0, Math.round(buildLeft)) + "s";
  document.getElementById("mm-b-streak").textContent = bestStreak;
  document.getElementById("mm-b-rings").textContent = wpr.length;

  var verdict;
  if (accuracy >= 90) verdict = "A pookalam fit for the front courtyard on Thiruvonam morning.";
  else if (accuracy >= 70) verdict = "Strong work — the neighbours would stop to admire this one.";
  else if (accuracy >= 45) verdict = "A respectable attempt. The rings remember what the eye forgets.";
  else verdict = "The design slipped away — memory is the real petal here. Try again.";
  document.getElementById("mm-verdict").textContent = verdict;

  [523,659,784,1046].forEach(function(n,i){ setTimeout(function(){ blip(n,0.22,"triangle"); }, i*110); });

  var priorBest = getHighScore();
  var isNewBest = finalScore > priorBest;
  if (isNewBest) saveHighScore(finalScore);

  var playerName = (nameInput.value||"Guest").trim() || "Guest";
  submitScore(round, playerName, finalScore, accuracy);
  loadLeaderboardView(playerName, finalScore);

  showOnly("screen-memory-end");
}

function loadLeaderboardView(myName, myScore){
  var title = document.getElementById("mm-lb-title");
  var list = document.getElementById("mm-lb-list");
  title.textContent = round.daily ? "Today's leaderboard — " + round.label + " (this device)"
                                   : "All-time leaderboard — " + round.label + " (this device)";
  var rows = getBoard(round);
  list.innerHTML = "";
  if (!rows.length){
    list.innerHTML = '<p class="mm-lb-empty">No scores yet — you\'re the first.</p>';
    return;
  }
  rows.forEach(function(row){
    var isMe = row.name===myName && row.score===myScore;
    var div = document.createElement("div");
    div.className = "mm-lb-row" + (isMe ? " mm-me" : "");
    var nameSpan = document.createElement("span");
    nameSpan.textContent = row.name;
    var scoreSpan = document.createElement("span");
    scoreSpan.className = "mm-lb-score";
    scoreSpan.textContent = row.score;
    div.appendChild(nameSpan); div.appendChild(scoreSpan);
    list.appendChild(div);
  });
}

/* ------------------------------------------------------------------
   Nav — wires up the new home card + intro/game/end buttons only.
   Never touches any element script.js already owns.
------------------------------------------------------------------ */
document.getElementById("btn-open-memory").addEventListener("click", function(){ showOnly("screen-memory-intro"); });
document.getElementById("mm-back-home").addEventListener("click", goHome);
document.getElementById("mm-home-from-end").addEventListener("click", goHome);
document.getElementById("mm-start-btn").addEventListener("click", function(){ showOnly("screen-memory-game"); startMemorize(); });
document.getElementById("mm-again-btn").addEventListener("click", function(){ showOnly("screen-memory-game"); startMemorize(); });
document.getElementById("mm-end-round-btn").addEventListener("click", function(){
  if (window.confirm("End this pookalam and return to the main menu?")){
    clearInterval(memTimer); clearInterval(buildTimer);
    clearTimeout(peekTimeout); peekActive = false;
    if (score > getHighScore()) saveHighScore(score);
    goHome();
  }
});

refreshHomeBest();
})();
