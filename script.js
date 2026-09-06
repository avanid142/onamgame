(function(){
  "use strict";

  /* ---------------------------------------------------------------
     DATA
  --------------------------------------------------------------- */
  var COLORS = [
    {name:"Marigold",      hex:"#F5941F", emoji:"🌼"},
    {name:"Hibiscus",      hex:"#D33B32", emoji:"🌺"},
    {name:"Chrysanthemum", hex:"#F4D22B", emoji:"🌻"},
    {name:"Jasmine",       hex:"#FBF3D6", emoji:"🤍"},
    {name:"Orchid",        hex:"#A85CC1", emoji:"🌸"},
    {name:"Tulasi Leaf",   hex:"#2F8F52", emoji:"🍃"}
  ];

  var DAY_NAMES = ["Atham","Chithira","Chodhi","Vishakam","Anizham","Thriketa","Moolam","Pooradam","Uthradom","Thiruvonam"];

  var MAVELI_QUOTES = [
    "Ten days home, and it begins with a single petal. Build me a pookalam, friend!",
    "Chithira already? My people, together, make quick work of beauty.",
    "Every colour you place is a welcome mat for an old king.",
    "Vishakam — halfway to remembering why I loved this land so much.",
    "Anizham brings the boats out. Your flowers race the clock too!",
    "Thriketa: even a small, honest pookalam outshines a grand, careless one.",
    "Moolam. The sadya pots are simmering — don't get distracted... or do!",
    "Pooradam — almost there. Keep your hand steady, your colours true.",
    "Uthradom eve. Tomorrow the whole land opens its doors for me.",
    "Thiruvonam! The biggest pookalam of all — make it unforgettable."
  ];

  var FEAST_ITEMS = ["🍌","🥭","🍚","🥥","🍛","🍮"];
  var CROW = "🐦";

  var BOAT_OBSTACLES = ["🪨","🪵"];
  var BOAT_COLLECTIBLES = [{emoji:"🪔",pts:15},{emoji:"🌸",pts:10}];
  var BOAT_QUOTES = [
    "150 strokes in — the snake boats feel the rhythm now!",
    "300! Keep the oars steady, the finish is only a feeling away.",
    "450 — my old eyes haven't seen paddling this fine in years.",
    "600! The river itself seems to be cheering you on.",
    "750 — even the crows have stopped to watch this race.",
    "900 — Onashamsakal! Row on as far as the river lets you."
  ];

  var THUMBI_QUOTES = [
    "Ten beats in — the thumbi spins for you now!",
    "Twenty! The lamp flickers happy at your rhythm.",
    "Thirty — even my old feet want to join this taal.",
    "Forty! The crows have paused just to watch you dance.",
    "Fifty — Onashamsakal! Dance on as long as the beat allows."
  ];

  /* ---------------------------------------------------------------
     LEVEL CONFIG
  --------------------------------------------------------------- */
  function buildLevels(){
    var levels = [];
    for (var i=0;i<10;i++){
      var rings = 1 + Math.min(2, Math.floor(i/4));       // 1..3
      var sectors = 6 + Math.min(4, Math.floor(i/3));     // 6..10
      var colorsCount = Math.min(COLORS.length, 3 + Math.floor(i/2)); // 3..6
      var time = Math.max(20, 45 - i*2.5);
      levels.push({
        day: DAY_NAMES[i],
        index: i,
        rings: rings,
        sectors: sectors,
        colorsCount: colorsCount,
        time: Math.round(time)
      });
    }
    return levels;
  }
  var LEVELS = buildLevels();

  /* ---------------------------------------------------------------
     STATE
  --------------------------------------------------------------- */
  var state = {
    levelIndex: 0,
    score: 0,
    hearts: 5,
    combo: 0,
    selectedColor: 0,
    segments: [],           // {ring,sector,colorIndex,filled,el}
    timeLeft: 0,
    timeTotal: 0,
    timerHandle: null,
    goldenTimeout: null,
    bonusActive: false,
    bonusSpawnHandle: null,
    bonusCountdown: null,
    audioCtx: null
  };

  var boatState = {
    running:false,
    inputAttached:false,
    ctx:null,
    logicalW:320, logicalH:440,
    lanes:[],
    player:{lane:1, x:0, bobPhase:0, invuln:0},
    rivals:[],
    entities:[],
    hearts:5,
    score:0,
    distance:0,
    speed:90,
    spawnTimer:0,
    spawnInterval:1.1,
    milestoneNext:150,
    lastFrameTime:0,
    rafHandle:null,
    waveOffset:0
  };

  /* ---------------------------------------------------------------
     THUMBI TAAL — a timing/rhythm game: a dancer orbits a lamp and
     the player must tap the instant she sweeps through the golden
     zone at the top of the circle. Angle 0 == top of the circle,
     increasing clockwise, matching the CSS conic-gradient zone.
  --------------------------------------------------------------- */
  var thumbiState = {
    running:false,
    angle:0,
    period:2600,        // ms per full revolution — shrinks as combo grows
    minPeriod:850,
    lastFrameTime:0,
    rafHandle:null,
    hearts:5,
    score:0,
    combo:0,
    bestCombo:0,
    zoneHalfDeg:20,      // must match the CSS conic-gradient zone width
    perfectHalfDeg:8,
    wasInZone:false,
    tappedThisPass:false,
    milestoneNext:10,
    inputAttached:false
  };

  /* ---------------------------------------------------------------
     DOM refs
  --------------------------------------------------------------- */
  var screens = {
    home: document.getElementById('screen-home'),
    start: document.getElementById('screen-start'),
    game: document.getElementById('screen-game'),
    end: document.getElementById('screen-end'),
    boatIntro: document.getElementById('screen-boat-intro'),
    boat: document.getElementById('screen-boat-game'),
    boatEnd: document.getElementById('screen-boat-end'),
    thumbiIntro: document.getElementById('screen-thumbi-intro'),
    thumbi: document.getElementById('screen-thumbi-game'),
    thumbiEnd: document.getElementById('screen-thumbi-end')
  };
  var hudDay = document.getElementById('hud-day');
  var hudHearts = document.getElementById('hud-hearts');
  var hudScore = document.getElementById('hud-score');
  var timerFill = document.getElementById('timer-fill');
  var svg = document.getElementById('pookalam-svg');
  var paletteEl = document.getElementById('palette');
  var maveliQuote = document.getElementById('maveli-quote');
  var wheelWrap = document.getElementById('wheel-wrap');
  var levelBanner = document.getElementById('level-banner');
  var levelBannerTitle = document.getElementById('level-banner-title');
  var levelBannerSub = document.getElementById('level-banner-sub');
  var bonusOverlay = document.getElementById('bonus-overlay');
  var thumbiCircle = document.getElementById('thumbi-circle');
  var thumbiZone = document.getElementById('thumbi-zone');
  var thumbiDancer = document.getElementById('thumbi-dancer');
  var thumbiFeedback = document.getElementById('thumbi-feedback');
  var thumbiHudCombo = document.getElementById('thumbi-hud-combo');
  var thumbiHudHearts = document.getElementById('thumbi-hud-hearts');
  var thumbiHudScore = document.getElementById('thumbi-hud-score');

  function showScreen(name){
    Object.keys(screens).forEach(function(k){
      screens[k].classList.toggle('active', k===name);
    });
  }

  /* ---------------------------------------------------------------
     tiny WebAudio blips (no external assets)
  --------------------------------------------------------------- */
  function audio(){
    if (!state.audioCtx){
      try{ state.audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }
      catch(e){ return null; }
    }
    return state.audioCtx;
  }
  function blip(freq, dur, type){
    var ctx = audio();
    if (!ctx) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  /* ---------------------------------------------------------------
     background floating petals (decorative)
  --------------------------------------------------------------- */
  function initBgPetals(){
    var field = document.getElementById('petal-field');
    var emojis = ["🌸","🌼","🌺","🍃","🌻"];
    for (var i=0;i<14;i++){
      var s = document.createElement('div');
      s.className = 'bg-petal';
      s.textContent = emojis[i % emojis.length];
      s.style.left = (Math.random()*100)+"vw";
      s.style.animationDuration = (10+Math.random()*14)+"s";
      s.style.animationDelay = (Math.random()*14)+"s";
      s.style.fontSize = (14+Math.random()*14)+"px";
      field.appendChild(s);
    }
  }

  /* ---------------------------------------------------------------
     SVG sector path helper
  --------------------------------------------------------------- */
  function polar(cx,cy,r,angleDeg){
    var rad = (angleDeg-90) * Math.PI/180;
    return [cx + r*Math.cos(rad), cy + r*Math.sin(rad)];
  }
  function sectorPath(cx,cy,innerR,outerR,startA,endA){
    var largeArc = (endA-startA) > 180 ? 1 : 0;
    var p1 = polar(cx,cy,outerR,startA);
    var p2 = polar(cx,cy,outerR,endA);
    if (innerR <= 0.5){
      return "M "+cx+" "+cy+" L "+p1[0]+" "+p1[1]+
             " A "+outerR+" "+outerR+" 0 "+largeArc+" 1 "+p2[0]+" "+p2[1]+" Z";
    }
    var p3 = polar(cx,cy,innerR,endA);
    var p4 = polar(cx,cy,innerR,startA);
    return "M "+p1[0]+" "+p1[1]+
           " A "+outerR+" "+outerR+" 0 "+largeArc+" 1 "+p2[0]+" "+p2[1]+
           " L "+p3[0]+" "+p3[1]+
           " A "+innerR+" "+innerR+" 0 "+largeArc+" 0 "+p4[0]+" "+p4[1]+" Z";
  }

  /* ---------------------------------------------------------------
     realistic flower rendering
  --------------------------------------------------------------- */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var CENTER_COLOR_DEFAULT = "#7A4B21";
  var CENTER_COLOR_OVERRIDE = { 3: "#F2C94C" }; // Jasmine gets a warm yellow stamen instead of brown

  function clamp255(v){ return Math.max(0, Math.min(255, v)); }
  function mixHex(hex, targetHex, amount){
    // amount 0..1, blends hex toward targetHex
    var a = parseInt(hex.slice(1),16), b = parseInt(targetHex.slice(1),16);
    var ar=(a>>16)&255, ag=(a>>8)&255, ab=a&255;
    var br=(b>>16)&255, bg=(b>>8)&255, bb=b&255;
    var r = clamp255(Math.round(ar+(br-ar)*amount));
    var g = clamp255(Math.round(ag+(bg-ag)*amount));
    var bl = clamp255(Math.round(ab+(bb-ab)*amount));
    return "#"+((1<<24)+(r<<16)+(g<<8)+bl).toString(16).slice(1);
  }

  function buildFlowerDefs(){
    var defs = document.createElementNS(SVG_NS,'defs');
    COLORS.forEach(function(col, i){
      var grad = document.createElementNS(SVG_NS,'radialGradient');
      grad.setAttribute('id','petalGrad-'+i);
      grad.setAttribute('cx','35%'); grad.setAttribute('cy','28%'); grad.setAttribute('r','80%');
      var stops = [
        [0, mixHex(col.hex, '#FFFFFF', 0.55)],
        [55, col.hex],
        [100, mixHex(col.hex, '#2B1B10', 0.28)]
      ];
      stops.forEach(function(s){
        var stop = document.createElementNS(SVG_NS,'stop');
        stop.setAttribute('offset', s[0]+'%');
        stop.setAttribute('stop-color', s[1]);
        grad.appendChild(stop);
      });
      defs.appendChild(grad);
    });
    return defs;
  }

  var PETAL_D = "M0,-1 C0.36,-0.74 0.33,-0.16 0,-0.02 C-0.33,-0.16 -0.36,-0.74 0,-1 Z";

  // builds one flower blossom (two layered rings of petals + stamen centre)
  // returns the inner <g> (the part whose opacity/animation is toggled on bloom)
  function buildFlower(colorIndex, jitterSeed){
    var outer = document.createElementNS(SVG_NS,'g');
    var inner = document.createElementNS(SVG_NS,'g');
    inner.setAttribute('class','flower-inner');
    var fillUrl = 'url(#petalGrad-'+colorIndex+')';

    // back layer: 6 smaller petals, offset 30deg, slightly desaturated via lower opacity
    for (var k=0;k<6;k++){
      var p1 = document.createElementNS(SVG_NS,'path');
      p1.setAttribute('d', PETAL_D);
      p1.setAttribute('fill', fillUrl);
      p1.setAttribute('opacity','0.82');
      p1.setAttribute('transform','rotate('+(k*60+30+jitterSeed)+') scale(0.62)');
      inner.appendChild(p1);
    }
    // front layer: 6 main petals
    for (var m=0;m<6;m++){
      var p2 = document.createElementNS(SVG_NS,'path');
      p2.setAttribute('d', PETAL_D);
      p2.setAttribute('fill', fillUrl);
      p2.setAttribute('stroke', mixHex(COLORS[colorIndex].hex,'#2B1B10',0.35));
      p2.setAttribute('stroke-width','0.015');
      p2.setAttribute('transform','rotate('+(m*60+jitterSeed)+') scale(0.98)');
      inner.appendChild(p2);
    }
    // stamen centre
    var centre = document.createElementNS(SVG_NS,'circle');
    centre.setAttribute('cx','0'); centre.setAttribute('cy','0'); centre.setAttribute('r','0.22');
    centre.setAttribute('fill', CENTER_COLOR_OVERRIDE[colorIndex] || CENTER_COLOR_DEFAULT);
    centre.setAttribute('stroke','#2B1B10'); centre.setAttribute('stroke-width','0.02');
    inner.appendChild(centre);

    outer.appendChild(inner);
    return {outer:outer, inner:inner};
  }

  /* ---------------------------------------------------------------
     BUILD LEVEL
  --------------------------------------------------------------- */
  function startLevel(idx){
    state.levelIndex = idx;
    var cfg = LEVELS[idx];
    state.segments = [];
    clearTimeout(state.goldenTimeout);
    removeGoldenPetal();

    svg.innerHTML = "";
    svg.appendChild(buildFlowerDefs());
    hudDay.textContent = cfg.day + " · Day " + (idx+1) + "/10";
    updateHud();

    var cx=200, cy=200;
    var centerR = 26;
    var maxR = 178;
    var bandWidth = (maxR-centerR)/cfg.rings;

    // decorative static center
    var centerCircle = document.createElementNS('http://www.w3.org/2000/svg','circle');
    centerCircle.setAttribute('cx',cx); centerCircle.setAttribute('cy',cy);
    centerCircle.setAttribute('r',centerR);
    centerCircle.setAttribute('fill','#F4D22B');
    centerCircle.setAttribute('stroke','#B23A2E');
    centerCircle.setAttribute('stroke-width','3');
    svg.appendChild(centerCircle);
    var centerText = document.createElementNS('http://www.w3.org/2000/svg','text');
    centerText.setAttribute('x',cx); centerText.setAttribute('y',cy+8);
    centerText.setAttribute('text-anchor','middle');
    centerText.setAttribute('font-size','22');
    centerText.textContent = "🪔";
    svg.appendChild(centerText);

    // active colour subset for this level
    var activeColors = [];
    for (var c=0;c<cfg.colorsCount;c++) activeColors.push(c);

    var sectorAngle = 360/cfg.sectors;

    for (var ring=0; ring<cfg.rings; ring++){
      var innerR = centerR + ring*bandWidth + 3;
      var outerR = centerR + (ring+1)*bandWidth - 3;
      var offset = (ring % 2 === 1) ? sectorAngle/2 : 0;
      var midRadius = (innerR+outerR)/2;
      var arcLen = midRadius * (sectorAngle * Math.PI/180);
      var flowerScale = Math.max(6, Math.min(bandWidth, arcLen) * 0.42);

      for (var s=0; s<cfg.sectors; s++){
        var startA = s*sectorAngle + offset;
        var midA = startA + sectorAngle/2;
        var colorIndex = activeColors[Math.floor(Math.random()*activeColors.length)];
        var pos = polar(cx,cy,midRadius,midA);
        var jitter = Math.round((Math.random()-0.5)*14);

        // invisible sector-shaped hit region so the whole slot (petal gaps included) is tappable
        var hit = document.createElementNS('http://www.w3.org/2000/svg','path');
        hit.setAttribute('d', sectorPath(cx,cy,innerR,outerR,startA,startA+sectorAngle-1.5));
        hit.setAttribute('fill', '#FFFFFF');
        hit.setAttribute('fill-opacity','0.001');
        hit.setAttribute('class','flower-hit');
        hit.setAttribute('tabindex','0');
        hit.setAttribute('role','button');
        hit.setAttribute('aria-label', COLORS[colorIndex].name + ' petal segment');
        hit.style.pointerEvents = 'all';
        svg.appendChild(hit);

        var flower = buildFlower(colorIndex, jitter);
        flower.outer.setAttribute('transform',
          'translate('+pos[0]+','+pos[1]+') rotate('+(midA+jitter)+') scale('+flowerScale+')');
        flower.outer.style.pointerEvents = 'none'; // clicks always pass through to the hit region below
        svg.appendChild(flower.outer);

        var segObj = {ring:ring, sector:s, colorIndex:colorIndex, filled:false, innerEl:flower.inner};
        state.segments.push(segObj);

        (function(segObj){
          hit.addEventListener('click', function(){ handleSegmentClick(segObj); });
          hit.addEventListener('keydown', function(e){
            if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); handleSegmentClick(segObj); }
          });
        })(segObj);
      }
    }

    buildPalette(activeColors);
    showMaveliQuote(MAVELI_QUOTES[idx]);

    state.timeTotal = cfg.time;
    state.timeLeft = cfg.time;
    runTimer();

    // maybe schedule a golden petal
    if (idx >= 1 && Math.random() < 0.5){
      var delay = 2500 + Math.random()*(cfg.time*1000*0.5);
      state.goldenTimeout = setTimeout(spawnGoldenPetal, delay);
    }
  }

  function buildPalette(activeColors){
    paletteEl.innerHTML = "";
    state.selectedColor = activeColors[0];
    activeColors.forEach(function(ci){
      var col = COLORS[ci];
      var b = document.createElement('button');
      b.className = 'swatch' + (ci===state.selectedColor ? ' selected' : '');
      b.style.background = col.hex;
      b.title = col.name;
      b.setAttribute('aria-label','Select '+col.name);
      b.textContent = col.emoji;
      b.addEventListener('click', function(){
        state.selectedColor = ci;
        Array.prototype.forEach.call(paletteEl.children, function(el){ el.classList.remove('selected'); });
        b.classList.add('selected');
      });
      paletteEl.appendChild(b);
    });
  }

  function showMaveliQuote(text){
    maveliQuote.textContent = "👑 " + text;
    maveliQuote.classList.add('show');
    setTimeout(function(){ maveliQuote.classList.remove('show'); }, 3200);
  }

  /* ---------------------------------------------------------------
     TIMER
  --------------------------------------------------------------- */
  function runTimer(){
    clearInterval(state.timerHandle);
    var last = performance.now();
    state.timerHandle = setInterval(function(){
      if (state.bonusActive) { last = performance.now(); return; }
      var now = performance.now();
      var dt = (now-last)/1000; last = now;
      state.timeLeft -= dt;
      if (state.timeLeft < 0) state.timeLeft = 0;
      timerFill.style.width = Math.max(0, (state.timeLeft/state.timeTotal*100)) + "%";
      if (state.timeLeft <= 0){
        clearInterval(state.timerHandle);
        onLevelEnd(false);
      }
    }, 100);
  }

  /* ---------------------------------------------------------------
     SEGMENT INTERACTION
  --------------------------------------------------------------- */
  function handleSegmentClick(seg){
    if (seg.filled || state.bonusActive) return;
    if (seg.colorIndex === state.selectedColor){
      seg.filled = true;
      seg.innerEl.classList.add('correct');
      state.combo++;
      var multiplier = 1 + Math.min(4, Math.floor(state.combo/3));
      state.score += 10*multiplier;
      blip(660 + multiplier*40, 0.12, 'triangle');
      updateHud();
      checkLevelComplete();
    } else {
      state.combo = 0;
      loseHeart();
      seg.innerEl.classList.remove('wrong'); void seg.innerEl.offsetWidth; seg.innerEl.classList.add('wrong');
      blip(180,0.15,'sawtooth');
    }
  }

  function checkLevelComplete(){
    var allFilled = state.segments.every(function(s){ return s.filled; });
    if (allFilled) onLevelEnd(true);
  }

  function loseHeart(){
    state.hearts = Math.max(0, state.hearts-1);
    updateHud();
    if (state.hearts <= 0){
      clearInterval(state.timerHandle);
      clearTimeout(state.goldenTimeout);
      endGame();
    }
  }

  function updateHud(){
    hudScore.textContent = state.score + " pts";
    var full = state.hearts;
    var str = "";
    for (var i=0;i<5;i++) str += (i<full ? "❤️" : "🤍");
    hudHearts.textContent = str;
  }

  /* ---------------------------------------------------------------
     LEVEL END / TRANSITION
  --------------------------------------------------------------- */
  function onLevelEnd(completed){
    clearInterval(state.timerHandle);
    clearTimeout(state.goldenTimeout);
    removeGoldenPetal();
    if (state.hearts <= 0) return; // already handled by endGame

    var cfg = LEVELS[state.levelIndex];
    var filledCount = state.segments.filter(function(s){return s.filled;}).length;
    var bonus = 0;
    if (completed){
      bonus = Math.round(state.timeLeft*4) + (state.levelIndex+1)*10;
      state.score += bonus;
      blip(880,0.2,'triangle'); setTimeout(function(){blip(1046,0.25,'triangle');},120);
    } else {
      blip(150,0.25,'sawtooth');
    }
    updateHud();

    levelBannerTitle.textContent = completed ?
      (cfg.day + " pookalam complete!") :
      (cfg.day + " — time's up!");
    levelBannerSub.textContent = completed ?
      ("+"+bonus+" bonus for finishing with time to spare") :
      (filledCount+"/"+state.segments.length+" petals placed — back to the main menu.");
    levelBanner.classList.add('show');

    setTimeout(function(){
      levelBanner.classList.remove('show');
      if (completed){
        if (state.levelIndex+1 < LEVELS.length){
          startLevel(state.levelIndex+1);
        } else {
          endGame();
        }
      } else {
        goToMainMenu();
      }
    }, 1700);
  }

  /* ---------------------------------------------------------------
     RETURN TO MAIN MENU (time-out, or the player quits mid-game)
  --------------------------------------------------------------- */
  function goToMainMenu(){
    clearInterval(state.timerHandle);
    clearInterval(state.bonusSpawnHandle);
    clearInterval(state.bonusCountdown);
    clearTimeout(state.goldenTimeout);
    removeGoldenPetal();
    if (state.bonusActive) endBonusRound();
    levelBanner.classList.remove('show');

    if (state.score > getHighScore(HIGH_SCORE_KEY_POOKALAM)) saveHighScore(HIGH_SCORE_KEY_POOKALAM, state.score);
    goHome();
  }

  /* ---------------------------------------------------------------
     GOLDEN PETAL + BONUS ROUND
  --------------------------------------------------------------- */
  function spawnGoldenPetal(){
    if (state.bonusActive || state.timeLeft <= 3) return;
    removeGoldenPetal();
    var el = document.createElement('div');
    el.className = 'golden-petal';
    el.textContent = '✨';
    el.id = 'golden-petal-el';
    var w = wheelWrap.clientWidth, h = wheelWrap.clientHeight;
    el.style.left = (20 + Math.random()*(w-60)) + "px";
    el.style.top = (20 + Math.random()*(h-60)) + "px";
    el.addEventListener('click', function(){
      removeGoldenPetal();
      startBonusRound();
    });
    wheelWrap.appendChild(el);
    // auto-remove if not clicked in time
    setTimeout(removeGoldenPetal, 4000);
  }
  function removeGoldenPetal(){
    var el = document.getElementById('golden-petal-el');
    if (el) el.remove();
  }

  function startBonusRound(){
    state.bonusActive = true;
    bonusOverlay.classList.add('show');
    var count = 6;
    var banner = document.getElementById('bonus-banner');
    banner.textContent = "🎉 Maveli's Feast! " + count + "s — catch the treats!";

    state.bonusSpawnHandle = setInterval(spawnFeastItem, 420);
    state.bonusCountdown = setInterval(function(){
      count--;
      banner.textContent = "🎉 Maveli's Feast! " + count + "s — catch the treats!";
      if (count <= 0) endBonusRound();
    }, 1000);
  }

  function spawnFeastItem(){
    var isCrow = Math.random() < 0.22;
    var item = document.createElement('div');
    item.className = 'falling-item';
    item.textContent = isCrow ? CROW : FEAST_ITEMS[Math.floor(Math.random()*FEAST_ITEMS.length)];
    var w = bonusOverlay.clientWidth;
    var left = 10 + Math.random()*(w-40);
    item.style.left = left + "px";
    var duration = 1.8 + Math.random()*1.4;
    item.style.transition = "top "+duration+"s linear";
    bonusOverlay.appendChild(item);
    requestAnimationFrame(function(){
      item.style.top = (bonusOverlay.clientHeight-10) + "px";
    });

    item.addEventListener('click', function(){
      if (!item.parentNode) return;
      var pts = isCrow ? -10 : 15;
      state.score = Math.max(0, state.score + pts);
      updateHud();
      blip(isCrow ? 140 : 760, 0.15, isCrow ? 'sawtooth' : 'triangle');
      var pop = document.createElement('div');
      pop.className = 'catch-pop';
      pop.textContent = (pts>0?'+':'') + pts;
      pop.style.left = item.style.left;
      pop.style.top = item.style.top;
      bonusOverlay.appendChild(pop);
      setTimeout(function(){ pop.remove(); }, 620);
      item.remove();
    });

    setTimeout(function(){ if (item.parentNode) item.remove(); }, duration*1000+100);
  }

  function endBonusRound(){
    clearInterval(state.bonusSpawnHandle);
    clearInterval(state.bonusCountdown);
    state.bonusActive = false;
    bonusOverlay.classList.remove('show');
    bonusOverlay.querySelectorAll('.falling-item, .catch-pop').forEach(function(n){ n.remove(); });
  }

  /* ---------------------------------------------------------------
     HIGH SCORE (persisted locally in the browser, with an in-memory
     fallback so it still works correctly within the session even if
     localStorage is unavailable — e.g. a sandboxed preview or file://
     context that blocks it). Shared by both games, keyed separately.
  --------------------------------------------------------------- */
  var HIGH_SCORE_KEY_POOKALAM = 'pookalamRushHighScore';
  var HIGH_SCORE_KEY_BOAT = 'pookalamRushBoatHighScore';
  var HIGH_SCORE_KEY_THUMBI = 'pookalamRushThumbiHighScore';
  var memoryHighScores = {};
  function getHighScore(key){
    try{
      var v = parseInt(localStorage.getItem(key), 10);
      if (!isNaN(v)) memoryHighScores[key] = Math.max(memoryHighScores[key]||0, v);
    } catch(e){ /* localStorage unavailable — fall back to memory only */ }
    return memoryHighScores[key]||0;
  }
  function saveHighScore(key, v){
    memoryHighScores[key] = Math.max(memoryHighScores[key]||0, v);
    try{ localStorage.setItem(key, String(memoryHighScores[key])); }
    catch(e){ /* localStorage unavailable — memory value still stands for this session */ }
  }
  function refreshHomeBests(){
    document.getElementById('home-best-pookalam').textContent = "Best: " + getHighScore(HIGH_SCORE_KEY_POOKALAM) + " pts";
    document.getElementById('home-best-boat').textContent = "Best: " + getHighScore(HIGH_SCORE_KEY_BOAT) + " pts";
    document.getElementById('home-best-thumbi').textContent = "Best: " + getHighScore(HIGH_SCORE_KEY_THUMBI) + " pts";
  }
  function goHome(){
    refreshHomeBests();
    showScreen('home');
  }

  /* ---------------------------------------------------------------
     GAME END
  --------------------------------------------------------------- */
  function endGame(){
    clearInterval(state.timerHandle);
    clearInterval(state.bonusSpawnHandle);
    clearInterval(state.bonusCountdown);
    clearTimeout(state.goldenTimeout);
    removeGoldenPetal();

    var maxScoreGuess = LEVELS.reduce(function(sum,cfg){ return sum + cfg.rings*cfg.sectors*10; }, 0);
    var ratio = state.score / Math.max(1,maxScoreGuess);
    var stars = ratio > 0.55 ? 3 : (ratio > 0.28 ? 2 : 1);

    var priorBest = getHighScore(HIGH_SCORE_KEY_POOKALAM);
    var isNewBest = state.score > priorBest;
    var highScore = isNewBest ? state.score : priorBest;
    if (isNewBest) saveHighScore(HIGH_SCORE_KEY_POOKALAM, highScore);

    document.getElementById('end-title').textContent =
      state.hearts <= 0 ? "The Feast Goes On!" : "Thiruvonam Complete!";
    document.getElementById('end-stars').textContent = "⭐".repeat(stars) + "☆".repeat(3-stars);
    document.getElementById('end-score').textContent = state.score + " pts";
    var endHighScoreEl = document.getElementById('end-highscore');
    endHighScoreEl.textContent = isNewBest ? ("🏆 New best score! " + highScore + " pts") : ("Best: " + highScore + " pts");
    endHighScoreEl.classList.toggle('new-best', isNewBest);
    document.getElementById('end-note').textContent =
      state.hearts <= 0
        ? "Even a pookalam left unfinished still welcomed the king home. Onashamsakal!"
        : "Ten days, ten pookalams, one very happy king. Onashamsakal!";

    showScreen('end');
  }

  /* ---------------------------------------------------------------
     BOAT RACE — Vallam Kali Sprint
     A 3-lane endless dodger: switch lanes to avoid rocks/logs and
     collect lamps/flowers, drawn on a <canvas> with emoji glyphs
     (no external art or audio assets, same approach as the pookalam game).
  --------------------------------------------------------------- */
  function setupBoatCanvas(){
    var canvas = document.getElementById('boat-canvas');
    var wrap = document.getElementById('boat-wrap');
    var rect = wrap.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width*dpr));
    canvas.height = Math.max(1, Math.round(rect.height*dpr));
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    boatState.ctx = ctx;
    boatState.logicalW = rect.width;
    boatState.logicalH = rect.height;
    boatState.lanes = [rect.width*(1/6), rect.width*(3/6), rect.width*(5/6)];
    boatState.player.x = boatState.lanes[boatState.player.lane];
  }

  function resetBoatState(){
    boatState.hearts = 5;
    boatState.score = 0;
    boatState.distance = 0;
    boatState.speed = 90;
    boatState.spawnTimer = 0;
    boatState.spawnInterval = 1.1;
    boatState.milestoneNext = 150;
    boatState.entities = [];
    boatState.waveOffset = 0;
    boatState.player.lane = 1;
    boatState.player.invuln = 0;
    boatState.player.bobPhase = 0;
    boatState.rivals = [
      {lane:0, phase:Math.random()*10},
      {lane:2, phase:Math.random()*10}
    ];
  }

  function moveBoatLane(delta){
    boatState.player.lane = Math.max(0, Math.min(2, boatState.player.lane+delta));
  }
  function boatKeyHandler(e){
    if (!boatState.running) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A'){ moveBoatLane(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D'){ moveBoatLane(1); }
  }
  function boatPointerHandler(e){
    if (!boatState.running) return;
    var canvas = document.getElementById('boat-canvas');
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    moveBoatLane(x < rect.width/2 ? -1 : 1);
  }
  function attachBoatInput(){
    if (boatState.inputAttached) return;
    boatState.inputAttached = true;
    window.addEventListener('keydown', boatKeyHandler);
    document.getElementById('boat-canvas').addEventListener('pointerdown', boatPointerHandler);
  }

  function showBoatQuote(text){
    var el = document.getElementById('boat-quote');
    el.textContent = "👑 " + text;
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); }, 2600);
  }

  function updateBoatHud(){
    document.getElementById('boat-hud-distance').textContent = Math.floor(boatState.distance) + " m";
    document.getElementById('boat-hud-score').textContent = boatState.score + " pts";
    var str = "";
    for (var i=0;i<5;i++) str += (i<boatState.hearts ? "❤️" : "🤍");
    document.getElementById('boat-hud-hearts').textContent = str;
  }

  function spawnBoatEntity(){
    var lane = Math.floor(Math.random()*3);
    var ent;
    if (Math.random() < 0.58){
      ent = {kind:'obstacle', emoji: BOAT_OBSTACLES[Math.floor(Math.random()*BOAT_OBSTACLES.length)], lane:lane, y:-30, resolved:false};
    } else {
      var c = BOAT_COLLECTIBLES[Math.floor(Math.random()*BOAT_COLLECTIBLES.length)];
      ent = {kind:'collect', emoji:c.emoji, pts:c.pts, lane:lane, y:-30, resolved:false};
    }
    boatState.entities.push(ent);
  }

  function updateBoat(dt){
    boatState.speed = Math.min(260, boatState.speed + dt*3.2);
    boatState.distance += boatState.speed*dt*0.12;

    var targetX = boatState.lanes[boatState.player.lane];
    boatState.player.x += (targetX - boatState.player.x) * Math.min(1, dt*10);
    boatState.player.bobPhase += dt*4;
    if (boatState.player.invuln > 0) boatState.player.invuln -= dt;

    boatState.rivals.forEach(function(r){
      r.phase += dt;
      if (Math.random() < dt*0.15){
        var choices = [0,1,2].filter(function(l){ return l !== boatState.player.lane; });
        r.lane = choices[Math.floor(Math.random()*choices.length)];
      }
    });

    boatState.spawnTimer -= dt;
    boatState.spawnInterval = Math.max(0.55, 1.15 - boatState.distance*0.0009);
    if (boatState.spawnTimer <= 0){
      spawnBoatEntity();
      boatState.spawnTimer = boatState.spawnInterval;
    }

    var playerY = boatState.logicalH - 70;
    for (var i=boatState.entities.length-1; i>=0; i--){
      var ent = boatState.entities[i];
      ent.y += boatState.speed*dt;
      if (ent.y > boatState.logicalH+40){
        boatState.entities.splice(i,1);
        continue;
      }
      if (!ent.resolved && ent.lane === boatState.player.lane && Math.abs(ent.y-playerY) < 26){
        ent.resolved = true;
        if (ent.kind === 'obstacle'){
          if (boatState.player.invuln <= 0){
            boatState.hearts = Math.max(0, boatState.hearts-1);
            boatState.player.invuln = 1.3;
            blip(150,0.25,'sawtooth');
            if (boatState.hearts <= 0){
              boatState.entities.splice(i,1);
              updateBoatHud();
              endBoatRace();
              return;
            }
          }
        } else {
          boatState.score += ent.pts;
          blip(760,0.15,'triangle');
        }
        boatState.entities.splice(i,1);
      }
    }

    updateBoatHud();

    if (boatState.distance >= boatState.milestoneNext){
      var qi = Math.floor(boatState.milestoneNext/150) - 1;
      showBoatQuote(BOAT_QUOTES[Math.min(BOAT_QUOTES.length-1, Math.max(0,qi))]);
      boatState.milestoneNext += 150;
    }
  }

  function renderBoat(){
    var ctx = boatState.ctx;
    if (!ctx) return;
    var w = boatState.logicalW, h = boatState.logicalH;
    ctx.clearRect(0,0,w,h);

    var grad = ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#1E6FA8');
    grad.addColorStop(1,'#0E4B78');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10,14]);
    for (var li=1; li<3; li++){
      var lx = w*(li/3);
      ctx.beginPath(); ctx.moveTo(lx,0); ctx.lineTo(lx,h); ctx.stroke();
    }
    ctx.setLineDash([]);

    boatState.waveOffset += boatState.speed*0.016;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    var waveSpacing = 46;
    var offset = boatState.waveOffset % waveSpacing;
    for (var wy = -waveSpacing+offset; wy < h; wy += waveSpacing){
      ctx.beginPath();
      for (var x=0; x<=w; x+=16){
        var yy = wy + Math.sin((x*0.05)+wy*0.05)*4;
        if (x===0) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = Math.round(w*0.11)+'px sans-serif';
    ctx.globalAlpha = 0.55;
    boatState.rivals.forEach(function(r){
      var rx = boatState.lanes[r.lane];
      var ry = h*0.28 + Math.sin(r.phase*2)*6;
      ctx.fillText('🚣', rx, ry);
    });
    ctx.globalAlpha = 1;

    ctx.font = Math.round(w*0.1)+'px sans-serif';
    boatState.entities.forEach(function(ent){
      ctx.fillText(ent.emoji, boatState.lanes[ent.lane], ent.y);
    });

    var px = boatState.player.x;
    var py = h-70 + Math.sin(boatState.player.bobPhase)*3;
    ctx.globalAlpha = (boatState.player.invuln>0 && Math.floor(boatState.player.invuln*10)%2===0) ? 0.35 : 1;
    ctx.font = Math.round(w*0.15)+'px sans-serif';
    ctx.fillText('🛶', px, py);
    ctx.globalAlpha = 1;
  }

  function boatLoop(now){
    if (!boatState.running) return;
    var dt = (now - boatState.lastFrameTime)/1000;
    if (dt > 0.05) dt = 0.05;
    boatState.lastFrameTime = now;
    updateBoat(dt);
    if (boatState.running){
      renderBoat();
      boatState.rafHandle = requestAnimationFrame(boatLoop);
    }
  }

  function startBoatGame(){
    resetBoatState();
    showScreen('boat');
    setupBoatCanvas();
    attachBoatInput();
    updateBoatHud();
    boatState.running = true;
    boatState.lastFrameTime = performance.now();
    boatState.rafHandle = requestAnimationFrame(boatLoop);
  }

  function stopBoatLoop(){
    boatState.running = false;
    if (boatState.rafHandle) cancelAnimationFrame(boatState.rafHandle);
  }

  function endBoatRace(){
    stopBoatLoop();
    var finalScore = boatState.score + Math.floor(boatState.distance);
    var priorBest = getHighScore(HIGH_SCORE_KEY_BOAT);
    var isNewBest = finalScore > priorBest;
    var highScore = isNewBest ? finalScore : priorBest;
    if (isNewBest) saveHighScore(HIGH_SCORE_KEY_BOAT, highScore);

    var ratio = finalScore/1200;
    var stars = ratio>0.6 ? 3 : (ratio>0.3 ? 2 : 1);

    document.getElementById('boat-end-stars').textContent = "⭐".repeat(stars) + "☆".repeat(3-stars);
    document.getElementById('boat-end-score').textContent = finalScore + " pts";
    var bh = document.getElementById('boat-end-highscore');
    bh.textContent = isNewBest ? ("🏆 New best score! " + highScore + " pts") : ("Best: " + highScore + " pts");
    bh.classList.toggle('new-best', isNewBest);
    document.getElementById('boat-end-note').textContent =
      "You paddled " + Math.floor(boatState.distance) + "m down the river before the boat gave way. Onashamsakal!";

    showScreen('boatEnd');
  }

  function quitBoatRace(){
    stopBoatLoop();
    var finalScore = boatState.score + Math.floor(boatState.distance);
    if (finalScore > getHighScore(HIGH_SCORE_KEY_BOAT)) saveHighScore(HIGH_SCORE_KEY_BOAT, finalScore);
    goHome();
  }

  /* ---------------------------------------------------------------
     THUMBI TAAL — Dance the beat around Maveli's lamp
     A single-lane rhythm/reflex game: a dancer orbits a circle at a
     steadily quickening tempo, and the player must tap right as she
     crosses the golden zone at the top. No canvas or extra assets —
     driven entirely by requestAnimationFrame and a CSS transform,
     same lightweight approach as the other two games.
  --------------------------------------------------------------- */
  function resetThumbiState(){
    thumbiState.hearts = 5;
    thumbiState.score = 0;
    thumbiState.combo = 0;
    thumbiState.bestCombo = 0;
    thumbiState.period = 2600;
    thumbiState.angle = 0;
    thumbiState.wasInZone = false;
    thumbiState.tappedThisPass = false;
    thumbiState.milestoneNext = 10;
    thumbiZone.classList.remove('active');
    thumbiFeedback.className = '';
    thumbiFeedback.textContent = '';
    thumbiDancer.style.transform = 'rotate(0deg)';
  }

  function updateThumbiHud(){
    thumbiHudScore.textContent = thumbiState.score + " pts";
    thumbiHudCombo.textContent = "Combo " + thumbiState.combo;
    var str = "";
    for (var i=0;i<5;i++) str += (i<thumbiState.hearts ? "❤️" : "🤍");
    thumbiHudHearts.textContent = str;
  }

  function showThumbiFeedback(text, cls){
    thumbiFeedback.textContent = text;
    thumbiFeedback.className = '';
    void thumbiFeedback.offsetWidth; // restart animation
    thumbiFeedback.classList.add(cls);
  }

  function showThumbiQuote(text){
    var el = document.getElementById('thumbi-quote');
    el.textContent = "👑 " + text;
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); }, 2600);
  }

  function thumbiLoseHeart(){
    thumbiState.hearts = Math.max(0, thumbiState.hearts-1);
    thumbiState.combo = 0;
    updateThumbiHud();
    thumbiCircle.classList.remove('shake'); void thumbiCircle.offsetWidth; thumbiCircle.classList.add('shake');
    blip(150,0.22,'sawtooth');
    if (thumbiState.hearts <= 0){
      endThumbiGame();
    }
  }

  function thumbiRegisterHit(deviation){
    var pts;
    if (deviation <= thumbiState.perfectHalfDeg){
      pts = 150;
      showThumbiFeedback('Perfect!', 'show-perfect');
      blip(920,0.15,'triangle');
    } else {
      pts = 70;
      showThumbiFeedback('Good', 'show-good');
      blip(600,0.13,'triangle');
    }
    thumbiState.combo++;
    thumbiState.bestCombo = Math.max(thumbiState.bestCombo, thumbiState.combo);
    thumbiState.score += pts + thumbiState.combo*4;

    // tempo ramps up every 5-combo, floored so it never becomes unplayable
    if (thumbiState.combo % 5 === 0){
      thumbiState.period = Math.max(thumbiState.minPeriod, Math.round(thumbiState.period*0.88));
    }
    updateThumbiHud();

    if (thumbiState.combo >= thumbiState.milestoneNext){
      var qi = Math.floor(thumbiState.milestoneNext/10) - 1;
      showThumbiQuote(THUMBI_QUOTES[Math.min(THUMBI_QUOTES.length-1, Math.max(0,qi))]);
      thumbiState.milestoneNext += 10;
    }
  }

  function thumbiTap(){
    if (!thumbiState.running) return;
    var angle = thumbiState.angle;
    var dev = Math.min(angle, 360-angle); // angular distance from the zone centre (top, 0deg)
    if (dev <= thumbiState.zoneHalfDeg){
      if (!thumbiState.tappedThisPass){
        thumbiState.tappedThisPass = true;
        thumbiRegisterHit(dev);
      }
      // a second tap during the same pass through the zone is simply ignored
    } else {
      showThumbiFeedback('Miss', 'show-miss');
      thumbiLoseHeart();
    }
  }

  function thumbiKeyHandler(e){
    if (!thumbiState.running) return;
    if (e.key === ' ' || e.code === 'Space'){ e.preventDefault(); thumbiTap(); }
  }
  function attachThumbiInput(){
    if (thumbiState.inputAttached) return;
    thumbiState.inputAttached = true;
    window.addEventListener('keydown', thumbiKeyHandler);
    thumbiCircle.addEventListener('pointerdown', function(){ thumbiTap(); });
  }

  function thumbiLoop(now){
    if (!thumbiState.running) return;
    var dt = now - thumbiState.lastFrameTime;
    thumbiState.lastFrameTime = now;
    thumbiState.angle = (thumbiState.angle + (dt/thumbiState.period)*360) % 360;

    var dev = Math.min(thumbiState.angle, 360-thumbiState.angle);
    var inZone = dev <= thumbiState.zoneHalfDeg;
    if (inZone && !thumbiState.wasInZone){
      thumbiState.tappedThisPass = false;
      thumbiZone.classList.add('active');
    }
    if (!inZone && thumbiState.wasInZone){
      thumbiZone.classList.remove('active');
      if (!thumbiState.tappedThisPass){
        showThumbiFeedback('Miss', 'show-miss');
        thumbiLoseHeart();
      }
    }
    thumbiState.wasInZone = inZone;

    thumbiDancer.style.transform = 'rotate(' + thumbiState.angle + 'deg)';

    if (thumbiState.running){
      thumbiState.rafHandle = requestAnimationFrame(thumbiLoop);
    }
  }

  function startThumbiGame(){
    resetThumbiState();
    showScreen('thumbi');
    attachThumbiInput();
    updateThumbiHud();
    thumbiState.running = true;
    thumbiState.lastFrameTime = performance.now();
    thumbiState.rafHandle = requestAnimationFrame(thumbiLoop);
  }

  function stopThumbiLoop(){
    thumbiState.running = false;
    if (thumbiState.rafHandle) cancelAnimationFrame(thumbiState.rafHandle);
  }

  function endThumbiGame(){
    stopThumbiLoop();
    var finalScore = thumbiState.score;
    var priorBest = getHighScore(HIGH_SCORE_KEY_THUMBI);
    var isNewBest = finalScore > priorBest;
    var highScore = isNewBest ? finalScore : priorBest;
    if (isNewBest) saveHighScore(HIGH_SCORE_KEY_THUMBI, highScore);

    var ratio = finalScore/2500;
    var stars = ratio>0.6 ? 3 : (ratio>0.3 ? 2 : 1);

    document.getElementById('thumbi-end-stars').textContent = "⭐".repeat(stars) + "☆".repeat(3-stars);
    document.getElementById('thumbi-end-score').textContent = finalScore + " pts";
    var th = document.getElementById('thumbi-end-highscore');
    th.textContent = isNewBest ? ("🏆 New best score! " + highScore + " pts") : ("Best: " + highScore + " pts");
    th.classList.toggle('new-best', isNewBest);
    document.getElementById('thumbi-end-note').textContent =
      "You held the taal for a best combo of " + thumbiState.bestCombo + " before losing the beat. Onashamsakal!";

    showScreen('thumbiEnd');
  }

  function quitThumbi(){
    stopThumbiLoop();
    if (thumbiState.score > getHighScore(HIGH_SCORE_KEY_THUMBI)) saveHighScore(HIGH_SCORE_KEY_THUMBI, thumbiState.score);
    goHome();
  }

  /* ---------------------------------------------------------------
     INIT / RESTART
  --------------------------------------------------------------- */
  function resetState(){
    state.score = 0;
    state.hearts = 5;
    state.combo = 0;
  }

  document.getElementById('btn-open-pookalam').addEventListener('click', function(){
    showScreen('start');
  });
  document.getElementById('btn-back-home-1').addEventListener('click', goHome);
  document.getElementById('btn-home-from-pookalam-end').addEventListener('click', goHome);

  document.getElementById('btn-start').addEventListener('click', function(){
    resetState();
    showScreen('game');
    startLevel(0);
  });
  document.getElementById('btn-restart').addEventListener('click', function(){
    resetState();
    showScreen('game');
    startLevel(0);
  });
  document.getElementById('btn-end-game').addEventListener('click', function(){
    if (window.confirm("End this pookalam and return to the main menu?")){
      goToMainMenu();
    }
  });

  document.getElementById('btn-open-boat').addEventListener('click', function(){
    showScreen('boatIntro');
  });
  document.getElementById('btn-back-home-2').addEventListener('click', goHome);
  document.getElementById('btn-start-boat').addEventListener('click', startBoatGame);
  document.getElementById('btn-restart-boat').addEventListener('click', startBoatGame);
  document.getElementById('btn-end-boat').addEventListener('click', function(){
    if (window.confirm("End this race and return to the main menu?")){
      quitBoatRace();
    }
  });
  document.getElementById('btn-home-from-boat-end').addEventListener('click', goHome);

  document.getElementById('btn-open-thumbi').addEventListener('click', function(){
    showScreen('thumbiIntro');
  });
  document.getElementById('btn-back-home-3').addEventListener('click', goHome);
  document.getElementById('btn-start-thumbi').addEventListener('click', startThumbiGame);
  document.getElementById('btn-restart-thumbi').addEventListener('click', startThumbiGame);
  document.getElementById('btn-end-thumbi').addEventListener('click', function(){
    if (window.confirm("End this dance and return to the main menu?")){
      quitThumbi();
    }
  });
  document.getElementById('btn-home-from-thumbi-end').addEventListener('click', goHome);

  initBgPetals();
  refreshHomeBests();
})();
