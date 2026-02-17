/* ============================================================
   Amanthos Living — Penguin Runner Game v2
   Enhanced visuals, power-ups, combo system, better rewards
   ============================================================ */

(function () {
  'use strict';

  var canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var overlay = document.getElementById('gameOverlay');
  var scoreEl = document.getElementById('gameScore');
  var highEl = document.getElementById('gameHigh');
  var rewardEl = document.getElementById('gameReward');
  var rewardCode = document.getElementById('rewardCode');

  var dpr = window.devicePixelRatio || 1;
  var W, H;
  var GROUND_Y;
  var GRAVITY = 0.55;
  var JUMP_FORCE = -10.5;
  var BASE_SPEED = 4;

  // Game state
  var isRunning = false;
  var score = 0;
  var highScore = parseInt(localStorage.getItem('amanthos_penguin_high') || '0');
  var speed = BASE_SPEED;
  var frameCount = 0;
  var combo = 0;
  var maxCombo = 0;
  var lastDodgeFrame = 0;
  var screenShake = 0;
  var difficultyLevel = 0;

  // Penguin
  var penguin = { x: 60, y: 0, vy: 0, w: 32, h: 40, jumping: false, frame: 0, invincible: 0, trail: [] };

  // Object pools
  var obstacles = [];
  var particles = [];
  var clouds = [];
  var coins = [];
  var stars = [];
  var snowflakes = [];

  // Rewards
  var MILESTONES = [
    { score: 100, code: 'LIV1ING', discount: '5%', claimed: false },
    { score: 300, code: 'LIV3ING', discount: '8%', claimed: false },
    { score: 500, code: 'LIV5ING', discount: '10%', claimed: false },
    { score: 1000, code: 'LIV10ING', discount: '15%', claimed: false },
  ];

  // Single-use code tracking via localStorage
  var REDEEMED_KEY = 'amanthos_redeemed_codes';
  function getRedeemedCodes() {
    try {
      return JSON.parse(localStorage.getItem(REDEEMED_KEY) || '[]');
    } catch (e) { return []; }
  }
  function isCodeRedeemed(code) {
    return getRedeemedCodes().indexOf(code) !== -1;
  }
  function markCodeRedeemed(code) {
    var codes = getRedeemedCodes();
    if (codes.indexOf(code) === -1) {
      codes.push(code);
      localStorage.setItem(REDEEMED_KEY, JSON.stringify(codes));
    }
  }

  // Colors
  var COLORS = {
    sky1: '#E8F4FD',
    sky2: '#C8E6F5',
    ground: '#A8C898',
    groundLight: '#B8D4A8',
    ice: '#7BBCE0',
    iceLight: '#9DD0ED',
    coin: '#FFD700',
    coinDark: '#DAA520',
    penguin: '#1A2B4A',
    belly: '#FFFFFF',
    beak: '#C4956A',
    particle: '#C4956A',
    combo: '#FF6B6B',
    shield: 'rgba(100, 200, 255, 0.3)',
  };

  // --- Setup ---
  function resize() {
    var rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width;
    H = 220;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    GROUND_Y = H - 40;
    penguin.y = GROUND_Y - penguin.h;
  }

  resize();
  window.addEventListener('resize', resize);
  updateHighDisplay();
  initSnowflakes();
  drawIdle();

  // --- Controls ---
  function jump() {
    if (!penguin.jumping) {
      penguin.vy = JUMP_FORCE;
      penguin.jumping = true;
      spawnJumpParticles();
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!isRunning) start();
      else jump();
    }
  });

  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    if (!isRunning) start();
    else jump();
  }, { passive: false });

  canvas.addEventListener('click', function () {
    if (!isRunning) start();
    else jump();
  });

  if (overlay) {
    overlay.addEventListener('click', function () { start(); });
  }

  // --- Game Loop ---
  var lastTime = 0;
  var accumulator = 0;
  var TICK = 1000 / 60;

  function loop(time) {
    if (!isRunning) return;

    var dt = time - lastTime;
    lastTime = time;
    if (dt > 100) dt = 16;
    accumulator += dt;

    while (accumulator >= TICK) {
      update();
      accumulator -= TICK;
    }

    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    score = 0;
    speed = BASE_SPEED;
    obstacles = [];
    particles = [];
    coins = [];
    combo = 0;
    maxCombo = 0;
    penguin.y = GROUND_Y - penguin.h;
    penguin.vy = 0;
    penguin.jumping = false;
    penguin.invincible = 0;
    penguin.trail = [];
    frameCount = 0;
    screenShake = 0;
    difficultyLevel = 0;

    MILESTONES.forEach(function (m) {
      // Keep already-redeemed codes marked as claimed so they don't re-trigger
      m.claimed = isCodeRedeemed(m.code);
    });
    if (rewardEl) rewardEl.style.display = 'none';

    if (overlay) overlay.classList.add('hidden');
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    isRunning = false;
    screenShake = 8;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('amanthos_penguin_high', highScore);
    }
    updateHighDisplay();

    // Update milestone display on page
    updateMilestoneDisplay();

    if (overlay) {
      overlay.classList.remove('hidden');
      var text = overlay.querySelector('.game-start-text');
      if (text) {
        var msg = 'Score: ' + score;
        if (maxCombo > 2) msg += ' | Best Combo: ' + maxCombo + 'x';
        msg += ' — Tap to Retry';
        text.textContent = msg;
      }
    }
  }

  // --- Update ---
  function update() {
    frameCount++;
    score++;
    difficultyLevel = Math.floor(score / 200);
    speed = BASE_SPEED + difficultyLevel * 0.4;

    // Penguin physics
    penguin.vy += GRAVITY;
    penguin.y += penguin.vy;
    if (penguin.y >= GROUND_Y - penguin.h) {
      penguin.y = GROUND_Y - penguin.h;
      penguin.vy = 0;
      penguin.jumping = false;
    }
    penguin.frame++;
    if (penguin.invincible > 0) penguin.invincible--;

    // Trail
    if (penguin.jumping) {
      penguin.trail.push({ x: penguin.x + 16, y: penguin.y + 20, life: 12 });
    }
    for (var t = penguin.trail.length - 1; t >= 0; t--) {
      penguin.trail[t].life--;
      if (penguin.trail[t].life <= 0) penguin.trail.splice(t, 1);
    }

    // Spawn obstacles
    var spawnRate = Math.max(35, 80 - difficultyLevel * 5);
    if (frameCount % spawnRate === 0) {
      var h = 18 + Math.random() * 28;
      var type = Math.random() < 0.3 && score > 200 ? 'double' : 'single';
      obstacles.push({
        x: W + 10,
        y: GROUND_Y - h,
        w: 14 + Math.random() * 14,
        h: h,
        passed: false,
        type: type,
      });
      if (type === 'double') {
        obstacles.push({
          x: W + 10 + 30 + Math.random() * 20,
          y: GROUND_Y - (14 + Math.random() * 20),
          w: 12 + Math.random() * 10,
          h: 14 + Math.random() * 20,
          passed: false,
          type: 'paired',
        });
      }
    }

    // Spawn coins
    if (frameCount % 90 === 0 && Math.random() < 0.6) {
      coins.push({
        x: W + 10,
        y: GROUND_Y - 60 - Math.random() * 40,
        r: 8,
        collected: false,
        bob: Math.random() * Math.PI * 2,
      });
    }

    // Move obstacles
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var obs = obstacles[i];
      obs.x -= speed;

      // Collision
      if (penguin.invincible <= 0 &&
        penguin.x + penguin.w - 8 > obs.x &&
        penguin.x + 8 < obs.x + obs.w &&
        penguin.y + penguin.h - 4 > obs.y
      ) {
        spawnExplosion(penguin.x + penguin.w / 2, penguin.y + penguin.h / 2);
        gameOver();
        return;
      }

      // Score for dodging
      if (!obs.passed && obs.x + obs.w < penguin.x) {
        obs.passed = true;
        if (frameCount - lastDodgeFrame < 30) {
          combo++;
          if (combo > maxCombo) maxCombo = combo;
          score += combo * 2;
          if (combo >= 3) {
            spawnComboText(combo);
          }
        } else {
          combo = 0;
        }
        lastDodgeFrame = frameCount;
      }

      if (obs.x + obs.w < -20) {
        obstacles.splice(i, 1);
      }
    }

    // Move coins
    for (var c = coins.length - 1; c >= 0; c--) {
      var coin = coins[c];
      coin.x -= speed;
      coin.bob += 0.08;

      // Collect
      if (!coin.collected) {
        var dx = (penguin.x + 16) - coin.x;
        var dy = (penguin.y + 20) - (coin.y + Math.sin(coin.bob) * 4);
        if (Math.sqrt(dx * dx + dy * dy) < 22) {
          coin.collected = true;
          score += 25;
          spawnCoinParticles(coin.x, coin.y);
        }
      }

      if (coin.x < -20 || coin.collected) {
        coins.splice(c, 1);
      }
    }

    // Update particles
    for (var j = particles.length - 1; j >= 0; j--) {
      var part = particles[j];
      part.x += part.vx;
      part.y += part.vy;
      if (part.gravity) part.vy += 0.15;
      part.life--;
      if (part.life <= 0) particles.splice(j, 1);
    }

    // Clouds
    if (frameCount % 100 === 0) {
      clouds.push({ x: W + 20, y: 8 + Math.random() * 35, w: 35 + Math.random() * 40 });
    }
    for (var k = clouds.length - 1; k >= 0; k--) {
      clouds[k].x -= speed * 0.25;
      if (clouds[k].x + clouds[k].w < -10) clouds.splice(k, 1);
    }

    // Snowflakes
    for (var s = 0; s < snowflakes.length; s++) {
      snowflakes[s].x -= speed * 0.15 + snowflakes[s].drift;
      snowflakes[s].y += snowflakes[s].speed;
      if (snowflakes[s].y > H || snowflakes[s].x < -5) {
        snowflakes[s].x = W + Math.random() * 40;
        snowflakes[s].y = -5;
      }
    }

    // Screen shake decay
    if (screenShake > 0) screenShake *= 0.85;

    // Check milestones
    checkMilestones();

    // Update score display
    if (scoreEl) {
      var displayText = 'Score: ' + score;
      if (combo >= 2) displayText += ' | ' + combo + 'x Combo!';
      scoreEl.textContent = displayText;
    }
  }

  // --- Draw ---
  function draw() {
    ctx.save();

    // Screen shake
    if (screenShake > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * screenShake,
        (Math.random() - 0.5) * screenShake
      );
    }

    ctx.clearRect(-10, -10, W + 20, H + 20);

    // Sky gradient (changes with difficulty)
    var skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    if (difficultyLevel < 3) {
      skyGrad.addColorStop(0, COLORS.sky1);
      skyGrad.addColorStop(1, COLORS.sky2);
    } else if (difficultyLevel < 6) {
      skyGrad.addColorStop(0, '#F0D4B0');
      skyGrad.addColorStop(1, '#E8C098');
    } else {
      skyGrad.addColorStop(0, '#2D2040');
      skyGrad.addColorStop(1, '#4A3060');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Mountains (parallax)
    drawMountains();

    // Ground
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = COLORS.groundLight;
    ctx.fillRect(0, GROUND_Y, W, 3);

    // Ground details
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (var g = 0; g < W; g += 40) {
      var gx = (g - (frameCount * speed * 0.5) % 40 + 40) % (W + 40) - 20;
      ctx.fillRect(gx, GROUND_Y + 8, 20, 2);
    }

    // Clouds
    clouds.forEach(function (c) {
      ctx.fillStyle = difficultyLevel < 6 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w / 2, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - c.w * 0.2, c.y + 3, c.w * 0.25, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Snowflakes
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    snowflakes.forEach(function (s) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Coins
    coins.forEach(function (coin) {
      var cy = coin.y + Math.sin(coin.bob) * 4;
      ctx.fillStyle = COLORS.coin;
      ctx.beginPath();
      ctx.arc(coin.x, cy, coin.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.coinDark;
      ctx.beginPath();
      ctx.arc(coin.x - 1, cy - 1, coin.r - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('A', coin.x, cy);
    });

    // Obstacles (ice blocks with depth)
    obstacles.forEach(function (obs) {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(obs.x + 3, obs.y + 3, obs.w, obs.h);

      // Main block
      var iceGrad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.w, obs.y + obs.h);
      iceGrad.addColorStop(0, '#8DCCEA');
      iceGrad.addColorStop(1, COLORS.ice);
      ctx.fillStyle = iceGrad;
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

      // Highlight
      ctx.fillStyle = COLORS.iceLight;
      ctx.fillRect(obs.x + 2, obs.y + 2, obs.w - 4, 4);

      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(obs.x + 2, obs.y + 2, 3, obs.h * 0.6);
    });

    // Penguin trail
    penguin.trail.forEach(function (t) {
      ctx.globalAlpha = t.life / 12 * 0.3;
      ctx.fillStyle = COLORS.penguin;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Penguin
    if (penguin.invincible > 0 && frameCount % 4 < 2) {
      // Flash when invincible
    } else {
      drawPenguin(penguin.x, penguin.y);
    }

    // Shield effect
    if (penguin.invincible > 0) {
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(penguin.x + 16, penguin.y + 20, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Particles
    particles.forEach(function (p) {
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color || COLORS.particle;
      if (p.type === 'text') {
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    });
    ctx.globalAlpha = 1;

    // Combo display
    if (combo >= 3) {
      ctx.save();
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.combo;
      ctx.globalAlpha = 0.8 + Math.sin(frameCount * 0.1) * 0.2;
      ctx.fillText(combo + 'x COMBO', W - 15, 25);
      ctx.restore();
    }

    // Difficulty indicator
    if (difficultyLevel > 0 && frameCount % 300 < 60) {
      ctx.save();
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillText('Level ' + (difficultyLevel + 1), W / 2, 18);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawMountains() {
    var offset = (frameCount * speed * 0.1) % 200;
    ctx.fillStyle = difficultyLevel < 6 ? 'rgba(180,200,220,0.3)' : 'rgba(60,40,80,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (var m = -200; m < W + 200; m += 100) {
      var mx = m - offset;
      var mh = 30 + Math.sin(m * 0.02) * 20;
      ctx.lineTo(mx, GROUND_Y - mh);
      ctx.lineTo(mx + 50, GROUND_Y - mh + 15);
    }
    ctx.lineTo(W + 200, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  function drawPenguin(x, y) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x + 16, GROUND_Y - 1, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = COLORS.penguin;
    ctx.beginPath();
    ctx.ellipse(x + 16, y + 22, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = COLORS.belly;
    ctx.beginPath();
    ctx.ellipse(x + 16, y + 24, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = COLORS.penguin;
    ctx.beginPath();
    ctx.arc(x + 16, y + 8, 9, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x + 19, y + 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + 20, y + 6, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Eye highlight
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x + 20.5, y + 5, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = COLORS.beak;
    ctx.beginPath();
    ctx.moveTo(x + 23, y + 9);
    ctx.lineTo(x + 30, y + 11);
    ctx.lineTo(x + 23, y + 13);
    ctx.closePath();
    ctx.fill();

    // Scarf (Amanthos brand color)
    ctx.fillStyle = COLORS.beak;
    ctx.fillRect(x + 6, y + 15, 20, 3);
    ctx.fillRect(x + 22, y + 15, 3, 8);

    // Wings
    ctx.fillStyle = COLORS.penguin;
    if (penguin.jumping) {
      // Wings up when jumping
      ctx.save();
      ctx.translate(x + 5, y + 18);
      ctx.rotate(-0.5);
      ctx.fillRect(0, 0, 4, 14);
      ctx.restore();
      ctx.save();
      ctx.translate(x + 27, y + 18);
      ctx.rotate(0.5);
      ctx.fillRect(-4, 0, 4, 14);
      ctx.restore();
    } else {
      var wingBob = Math.sin(penguin.frame * 0.12) * 2;
      ctx.fillRect(x + 2, y + 18 + wingBob, 4, 14);
      ctx.fillRect(x + 26, y + 18 - wingBob, 4, 14);
    }

    // Feet
    ctx.fillStyle = COLORS.beak;
    if (!penguin.jumping) {
      var footOffset = Math.sin(penguin.frame * 0.15) * 3;
      ctx.fillRect(x + 8 + footOffset, y + 36, 8, 4);
      ctx.fillRect(x + 16 - footOffset, y + 36, 8, 4);
    } else {
      ctx.fillRect(x + 10, y + 36, 6, 3);
      ctx.fillRect(x + 18, y + 36, 6, 3);
    }
  }

  function drawIdle() {
    // Draw a static scene when game hasn't started
    ctx.clearRect(0, 0, W, H);
    var skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, COLORS.sky1);
    skyGrad.addColorStop(1, COLORS.sky2);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, GROUND_Y);
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = COLORS.groundLight;
    ctx.fillRect(0, GROUND_Y, W, 3);
    drawPenguin(penguin.x, GROUND_Y - penguin.h);

    // Draw some static snowflakes
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    snowflakes.forEach(function (s) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // --- Particle Effects ---
  function spawnJumpParticles() {
    for (var i = 0; i < 5; i++) {
      particles.push({
        x: penguin.x + 16,
        y: GROUND_Y - 2,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2,
        life: 15,
        maxLife: 15,
        size: 3 + Math.random() * 2,
        color: COLORS.groundLight,
        gravity: false,
      });
    }
  }

  function spawnExplosion(x, y) {
    for (var i = 0; i < 15; i++) {
      var angle = (Math.PI * 2 / 15) * i;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: Math.sin(angle) * (2 + Math.random() * 3),
        life: 25,
        maxLife: 25,
        size: 3 + Math.random() * 3,
        color: i % 2 === 0 ? COLORS.particle : COLORS.ice,
        gravity: true,
      });
    }
  }

  function spawnCoinParticles(x, y) {
    for (var i = 0; i < 6; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 18,
        maxLife: 18,
        size: 2 + Math.random() * 2,
        color: COLORS.coin,
        gravity: true,
      });
    }
    // +25 text
    particles.push({
      x: x,
      y: y - 10,
      vx: 0,
      vy: -1.5,
      life: 30,
      maxLife: 30,
      size: 0,
      color: COLORS.coin,
      type: 'text',
      text: '+25',
    });
  }

  function spawnComboText(comboCount) {
    particles.push({
      x: penguin.x + 40,
      y: penguin.y - 10,
      vx: 0.5,
      vy: -1,
      life: 40,
      maxLife: 40,
      size: 0,
      color: COLORS.combo,
      type: 'text',
      text: comboCount + 'x!',
    });
  }

  function initSnowflakes() {
    snowflakes = [];
    for (var i = 0; i < 15; i++) {
      snowflakes.push({
        x: Math.random() * (W || 600),
        y: Math.random() * (H || 220),
        size: 1 + Math.random() * 2,
        speed: 0.3 + Math.random() * 0.5,
        drift: Math.random() * 0.3,
      });
    }
  }

  function checkMilestones() {
    MILESTONES.forEach(function (m) {
      if (!m.claimed && score >= m.score) {
        m.claimed = true;
        showReward(m.code, m.discount);
      }
    });
  }

  function showReward(code, discount) {
    if (rewardEl && rewardCode) {
      if (isCodeRedeemed(code)) {
        // Code already used — show different message
        rewardEl.style.display = 'block';
        rewardCode.textContent = code;
        rewardCode.style.opacity = '0.5';
        rewardCode.style.textDecoration = 'line-through';
        var p = rewardEl.querySelector('p');
        if (p) p.textContent = discount + ' code already redeemed!';
        // Remove any existing redeem button
        var existingBtn = rewardEl.querySelector('.redeem-btn');
        if (existingBtn) existingBtn.remove();
      } else {
        rewardEl.style.display = 'block';
        rewardCode.textContent = code;
        rewardCode.style.opacity = '1';
        rewardCode.style.textDecoration = 'none';
        var p = rewardEl.querySelector('p');
        if (p) p.textContent = 'You unlocked ' + discount + ' off your next stay!';
        // Remove any existing redeem button, then add new one
        var existingBtn = rewardEl.querySelector('.redeem-btn');
        if (existingBtn) existingBtn.remove();
        var redeemBtn = document.createElement('button');
        redeemBtn.className = 'redeem-btn';
        redeemBtn.textContent = 'Copy & Redeem';
        redeemBtn.style.cssText = 'margin-top:.5rem;padding:.4rem 1rem;background:var(--color-accent,#8B6914);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.8rem;font-weight:600;';
        redeemBtn.addEventListener('click', function () {
          if (isCodeRedeemed(code)) return;
          // Copy to clipboard
          if (navigator.clipboard) {
            navigator.clipboard.writeText(code);
          } else {
            var tmp = document.createElement('textarea');
            tmp.value = code;
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            document.body.removeChild(tmp);
          }
          markCodeRedeemed(code);
          redeemBtn.textContent = 'Copied & Redeemed ✓';
          redeemBtn.disabled = true;
          redeemBtn.style.opacity = '0.6';
          rewardCode.style.opacity = '0.5';
          rewardCode.style.textDecoration = 'line-through';
        });
        rewardEl.appendChild(redeemBtn);
      }
    }
  }

  function updateHighDisplay() {
    if (highEl) highEl.textContent = 'Best: ' + highScore;
  }

  function updateMilestoneDisplay() {
    // Update milestone checkmarks on the page
    var milestoneEls = document.querySelectorAll('.milestone');
    if (milestoneEls.length > 0) {
      MILESTONES.forEach(function (m, i) {
        if (milestoneEls[i]) {
          if (m.claimed) {
            milestoneEls[i].classList.add('achieved');
          }
          if (isCodeRedeemed(m.code)) {
            milestoneEls[i].classList.add('redeemed');
            milestoneEls[i].style.opacity = '0.5';
            milestoneEls[i].style.textDecoration = 'line-through';
          }
        }
      });
    }
  }

})();
