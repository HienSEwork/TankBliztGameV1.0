// Tank Blitz gameplay core with assets, controls, AI, collisions, power-ups, boss, HUD, and audio
window.TB = window.TB || {};
TB.Game = (function () {
  const TILE = 32;
  const MAP_TYPES = {
    EMPTY: 0,
    BRICK: 1,
    STEEL: 2,
    WATER: 3,
    BUSH: 4,
    BASE: 9,
  };
  const DIRS = ["up", "down", "left", "right"];
  const CONFIG = {
    stage1: {
      widthTiles: 20,
      heightTiles: 20,
      enemies: 25,
      enemyFireDelay: 1.8,
      enemyMoveRetarget: 1.2,
      enemySpeed: 80,
      bulletSpeed: 300,
    },
    stage2: {
      widthTiles: 24,
      heightTiles: 20,
      enemies: 30,
      enemyFireDelay: 1.6,
      enemyMoveRetarget: 1.4,
      enemySpeed: 75,
      bulletSpeed: 300,
      bossSpawnSec: 5,
    },
    stage5: {
      widthTiles: 26,
      heightTiles: 22,
      enemies: 40,
      enemyFireDelay: 1.6,
      enemyMoveRetarget: 1.0,
      enemySpeed: 85,
      bulletSpeed: 320,
      bossSpawnSec: 0,
    },
  };

  let canvas, ctx;
  let overlay,
    hudEl,
    livesEl,
    leftEl,
    buffInfoEl,
    enemyStackEl,
    bossBarWrapEl,
    bossBarEl;

  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
    gamepadIndex: null,
  };

  const state = {
    running: false,
    inMenu: false,
    stage: 0,
    lives: 3,
    enemiesLeft: 0,
    lastTime: 0,
    player: null,
    bullets: [],
    enemies: [],
    boss: null,
    world: {
      width: 640,
      height: 640,
      widthTiles: 20,
      heightTiles: 20,
      tileSize: TILE,
    },
    map: [],
    timers: { nextPowerup: 0, powerupExpire: 0, bossSpawnTime: Infinity },
    powerups: [],
    audio: null,
    muted: false,
  };

  const enemySpawns = [
    { x: 1 * TILE, y: 0 },
    { x: 5 * TILE, y: 0 },
    { x: 9 * TILE, y: 0 },
    { x: 13 * TILE, y: 0 },
    { x: 17 * TILE, y: 0 },
  ];
  let nextSpawnIdx = 0;

  function findFixedEnemySpawn() {
    const xTile = Math.floor(Math.random() * state.world.widthTiles); // random cột
    return { x: xTile * TILE, y: 0 }; // spawn trên hàng đầu tiên
  }

  // ---------- Sound Manager ----------
  const sounds = {};

  function loadSounds() {
    const list = {
      shot: "/assets/sound/shot.mp3",
      killenemy: "/assets/sound/killenemy.mp3",
      killed: "/assets/sound/killed.mp3",
      buffdame: "/assets/sound/buffdame.mp3",
      plusheart: "/assets/sound/plusheart.mp3",
      timestop: "/assets/sound/timestop.mp3",
      startgame: "/assets/sound/startgame.mp3",
      gameover: "/assets/sound/gameover.mp3",
      win: "/assets/sound/win.mp3",
      result: "/assets/sound/result.mp3",
    };

    for (const [key, path] of Object.entries(list)) {
      const audio = new Audio(path);
      audio.volume = 0.6;
      sounds[key] = audio;
    }
  }

  function playSound(name) {
    if (state.muted) return;
    if (sounds[name]) {
      sounds[name].currentTime = 0; // reset để phát lại ngay
      sounds[name].play();
    }
  }

  // ---------- Utility ----------
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }
  function rnd(min, max) {
    return Math.random() * (max - min) + min;
  }
  function choice(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }
  function now() {
    return performance.now() / 1000;
  }

  function setUIRefs() {
    overlay = document.getElementById("overlay");
    hudEl = document.getElementById("hud");
    livesEl = document.getElementById("lives");
    leftEl = document.getElementById("left");
    buffInfoEl = document.getElementById("buffInfo");
    enemyStackEl = document.getElementById("enemyStack");
    bossBarWrapEl = document.getElementById("bossBarWrap");
    bossBarEl = document.getElementById("bossBar");
  }

  function initCanvas() {
    canvas = document.getElementById("game");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "game";
      canvas.width = state.world.width;
      canvas.height = state.world.height;
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext("2d");
  }

  function updateHUD() {
    if (livesEl) {
      if (state.player) {
        livesEl.textContent = state.lives + " x " + state.player.hp;
      } else {
        livesEl.textContent = state.lives + " x 3"; // mặc định nếu player chưa spawn
      }
    }

    if (leftEl) leftEl.textContent = String(Math.max(0, state.enemiesLeft));

    const rem = Math.max(0, state.timers.powerupExpire - now());
    if (buffInfoEl) {
      if (state.player && state.player.dmgMul > 1 && rem > 0) {
        buffInfoEl.textContent = "x2 Damage: " + rem.toFixed(0) + "s";
      } else {
        buffInfoEl.textContent = "";
      }
    }

    if (state.boss) {
      if (bossBarWrapEl) bossBarWrapEl.style.display = "block";
      if (bossBarEl) {
        const ratio = clamp(state.boss.hp / state.boss.maxHp, 0, 1) * 100;
        bossBarEl.style.width = ratio + "%";
      }
    } else {
      if (bossBarWrapEl) bossBarWrapEl.style.display = "none";
    }
  }

  function buildEnemyStack() {
    if (!enemyStackEl) return;
    enemyStackEl.innerHTML = "";
    const count = Math.max(0, state.enemiesLeft);
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      dot.className = "enemyDot";
      enemyStackEl.appendChild(dot);
    }
  }

  function showOverlay(title, buttonText, onClick) {
    if (!overlay) return;
    overlay.innerHTML = "";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = buttonText;
    btn.onclick = onClick;
    overlay.appendChild(h2);
    overlay.appendChild(btn);
    overlay.style.display = "flex";
  }
  function hideOverlay() {
    if (overlay) overlay.style.display = "none";
  }

  function attachKeyboard() {
    window.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          input.up = true;
          if (state.player) state.player.dir = "up";
          break;
        case "ArrowDown":
        case "KeyS":
          input.down = true;
          if (state.player) state.player.dir = "down";
          break;
        case "ArrowLeft":
        case "KeyA":
          input.left = true;
          if (state.player) state.player.dir = "left";
          break;
        case "ArrowRight":
        case "KeyD":
          input.right = true;
          if (state.player) state.player.dir = "right";
          break;
        case "Space":
        case "KeyJ":
          input.fire = true;
          break;
        case "KeyM":
          toggleMute();
          break;
      }
    });
    window.addEventListener("keyup", (e) => {
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          input.up = false;
          break;
        case "ArrowDown":
        case "KeyS":
          input.down = false;
          break;
        case "ArrowLeft":
        case "KeyA":
          input.left = false;
          break;
        case "ArrowRight":
        case "KeyD":
          input.right = false;
          break;
        case "Space":
        case "KeyJ":
          input.fire = false;
          break;
      }
    });
  }

  function pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = input.gamepadIndex != null ? pads[input.gamepadIndex] : pads[0];
    if (!gp) return;
    input.gamepadIndex = gp.index;
    const axX = gp.axes[0] || 0,
      axY = gp.axes[1] || 0;
    input.left = axX < -0.3;
    input.right = axX > 0.3;
    input.up = axY < -0.3;
    input.down = axY > 0.3;
    if (gp.buttons && gp.buttons[0]) input.fire = gp.buttons[0].pressed; // A / Cross
  }

  // ---------- Audio ----------
  function initAudio() {
    if (state.audio) return;
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    state.audio = { ctx: actx, master: actx.createGain(), bgm: null };
    state.audio.master.connect(actx.destination);
    state.audio.master.gain.value = 0.6;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "triangle";
    o.frequency.value = 110;
    g.gain.value = 0.05;
    o.connect(g).connect(state.audio.master);
    o.start();
    state.audio.bgm = { osc: o, gain: g };
    if (state.muted) state.audio.master.gain.value = 0;
  }
  function toggleMute() {
    state.muted = !state.muted;
    if (state.audio) state.audio.master.gain.value = state.muted ? 0 : 0.6;
  }
  function playBeep(freq = 440, dur = 0.08) {
    if (!state.audio || state.muted) return;
    const t = state.audio.ctx.currentTime;
    const o = state.audio.ctx.createOscillator();
    const g = state.audio.ctx.createGain();
    o.frequency.value = freq;
    o.type = "square";
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(state.audio.master);
    o.start(t);
    o.stop(t + dur);
  }

  // ---------- Entities ----------
  function createPlayer() {
    const bx = (state.world.widthTiles / 2) | 0;
    const by = state.world.heightTiles - 1;
    const spawnTileX = bx - 2,
      spawnTileY = by - 1;

    // clear khu spawn
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const tx = spawnTileX + dx,
          ty = spawnTileY + dy;
        if (state.map[ty]) state.map[ty][tx] = MAP_TYPES.EMPTY;
      }
    }
    const spawnX = spawnTileX * TILE,
      spawnY = spawnTileY * TILE;

    return {
      type: "player",
      x: spawnX,
      y: spawnY,
      spawnX,
      spawnY,
      size: 32,
      speed: 100,
      dir: "up",
      fireCd: 0,
      dmgMul: 1,
      hp: 3,
      lives: 3,
      respawnAt: 0,
      invincibleUntil: 0,
      alive: true,
    };
  }

  function killPlayer() {
    const p = state.player;
    if (!p.alive) return;
    if (now() < p.invincibleUntil) return; // đang vô địch

    p.hp--; // mất 1 máu
    if (p.hp > 0) {
      // còn HP, chỉ reset vị trí + vô địch tạm
      p.x = p.spawnX;
      p.y = p.spawnY;
      p.invincibleUntil = now() + 3;
    } else {
      // hết HP => trừ 1 tim
      p.lives--;
      if (p.lives < 0) {
        gameOver();
        return;
      }
      // hồi sinh với full HP cho mạng mới
      p.hp = 3;
      p.alive = false;
      p.respawnAt = now() + 3;
    }
    playSound("killed");
  }

  function createEnemy() {
    let pos = null;
    let tries = 0;

    // thử tối đa 20 lần để tìm vị trí spawn trống
    while (tries < 20) {
      const { x, y } = findFixedEnemySpawn();
      if (!tankCollides(x, y, 32, null)) {
        pos = { x, y };
        break;
      }
      tries++;
    }

    if (!pos) {
      // fallback: spawn giữa map hàng trên cùng
      pos = { x: (state.world.width / 2) | 0, y: 0 };
    }

    const hp = state.stage <= 2 ? 1 : 2;
    return {
      type: "enemy",
      x: pos.x,
      y: pos.y,
      size: 32,
      speed: CONFIGStage().enemySpeed,
      dir: choice(DIRS),
      fireCd: rnd(0.5, 2),
      retarget: rnd(0.8, 1.6),
      alive: true,
      hp,
    };
  }

  function createBoss() {
    const common = {
      x: state.world.width / 2 - 32,
      y: 16,
      size: 64,
      dir: "down",
      alive: true,
      dmg: 2,
      spawnedAt: now(), // mốc spawn
      canFireDelay: 6.0, // delay 6 giây mới bắn/di chuyển
      retarget: 1.0,
      spawning: true, // 👈 hiệu ứng spawn
    };

    if (state.stage === 2) {
      return {
        ...common,
        type: "boss",
        speed: 45,
        fireCd: 1.0,
        hp: 30,
        maxHp: 30,
        canCrossWater: false,
        touchKill: false,
      };
    } else if (state.stage === 5) {
      return {
        ...common,
        type: "boss",
        speed: 65,
        fireCd: 0.6,
        hp: 50,
        maxHp: 50,
        canCrossWater: true,
        touchKill: true,
      };
    }
  }

  function CONFIGStage() {
    if (state.stage === 1) return CONFIG.stage1;
    if (state.stage === 2) return CONFIG.stage2;
    if (state.stage === 5) return CONFIG.stage5;
    return CONFIG.stage1; // fallback
  }

  // ---------- Map ----------
  function createMapRandom(widthTiles, heightTiles) {
    const m = [];
    for (let y = 0; y < heightTiles; y++) {
      const row = [];
      for (let x = 0; x < widthTiles; x++) {
        let t = MAP_TYPES.EMPTY;
        const r = Math.random();
        if (y < 3) {
          row.push(MAP_TYPES.EMPTY);
          continue;
        } // không generate gì trên cùng
        if (r < 0.05) t = MAP_TYPES.STEEL;
        else if (r < 0.15) t = MAP_TYPES.BRICK;
        else if (r < 0.18) t = MAP_TYPES.WATER;
        else if (r < 0.25) t = MAP_TYPES.BUSH;
        row.push(t);
      }

      m.push(row);
    }

    // Tạo 1–2 cụm nước thay vì mỗi ô
    const patches = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < patches; i++) {
      addWaterPatch(m, widthTiles, heightTiles);
    }

    // Base ở giữa
    // Base
    const bc = (widthTiles / 2) | 0;
    const by = heightTiles - 1;
    m[by][bc] = MAP_TYPES.BASE;

    // Bao quanh base bằng gạch
    const walls = [
      [bc - 1, by - 1],
      [bc, by - 1],
      [bc + 1, by - 1], // hàng trên
      [bc - 1, by],
      [bc + 1, by], // hai bên
    ];
    for (const [wx, wy] of walls) {
      if (m[wy] && m[wy][wx] != null) {
        m[wy][wx] = MAP_TYPES.BRICK;
      }
    }

    return m;
  }

  function isSolidForTank(t, entity = null) {
    // Boss stage 5 được đi qua nước
    if (
      entity &&
      entity.type === "boss" &&
      entity.canCrossWater &&
      t === MAP_TYPES.WATER
    )
      return false;

    // Các loại tank khác: nước cũng chặn
    return (
      t === MAP_TYPES.STEEL ||
      t === MAP_TYPES.BRICK ||
      t === MAP_TYPES.BASE ||
      t === MAP_TYPES.WATER
    );
  }

  function isBulletBlocked(t, byBoss = false) {
    if (t === MAP_TYPES.WATER) return false; // xuyên nước
    if (t === MAP_TYPES.STEEL) return true; // thép chặn tất cả đạn, kể cả boss
    return false;
  }

  function damageTileAt(px, py, shooter) {
    const tx = (px / TILE) | 0,
      ty = (py / TILE) | 0;
    const m = state.map;
    if (!m[ty] || m[ty][tx] == null) return false;
    if (m[ty][tx] === MAP_TYPES.BRICK) {
      m[ty][tx] = MAP_TYPES.EMPTY;
      playSound("killenemy"); // hoặc tách riêng ra file boomBrick.mp3 nếu bạn muốn
      return true;
    }
    if (m[ty][tx] === MAP_TYPES.BASE) {
      gameOver();
      return true;
    }
    return false;
  }

  function tileAt(px, py) {
    const tx = (px / TILE) | 0,
      ty = (py / TILE) | 0;
    return state.map[ty] && state.map[ty][tx] != null
      ? state.map[ty][tx]
      : MAP_TYPES.STEEL;
  }
  function addWaterPatch(m, widthTiles, heightTiles) {
    const len = 2 + Math.floor(Math.random() * 5); // 2–6 ô
    let x = Math.floor(Math.random() * (widthTiles - 3));
    let y = Math.floor(Math.random() * (heightTiles - 3));
    const horizontal = Math.random() < 0.5;

    for (let i = 0; i < len; i++) {
      if (x < widthTiles && y < heightTiles) {
        m[y][x] = MAP_TYPES.WATER;
        if (horizontal) x++;
        else y++;
      }
    }
  }

  function rectIntersectsSolid(nx, ny, size) {
    const pad = 2; // co vào 2px để dễ lọt khe
    const corners = [
      [nx + pad, ny + pad],
      [nx + size - pad, ny + pad],
      [nx + pad, ny + size - pad],
      [nx + size - pad, ny + size - pad],
    ];
    for (const [cx, cy] of corners) {
      const t = tileAt(cx, cy);
      if (isSolidForTank(t) && t !== MAP_TYPES.BUSH) return true;
    }
    return false;
  }

  // ---------- Bullets ----------
  function fireBullet(owner) {
    if (!owner.alive) return;

    const speed = CONFIGStage().bulletSpeed;
    let vx = 0,
      vy = -speed;
    if (owner.dir === "down") {
      vy = speed;
    } else if (owner.dir === "left") {
      vx = -speed;
      vy = 0;
    } else if (owner.dir === "right") {
      vx = speed;
      vy = 0;
    }

    const cx = owner.x + owner.size / 2,
      cy = owner.y + owner.size / 2;
    const byBoss = owner.type === "boss";

    // phân loại bullet để vẽ
    let spriteType = "normal";
    if (owner.type === "boss") {
      if (state.stage === 5) {
        spriteType = "shark"; // shark_boss stage 5
      } else {
        spriteType = "boss"; // boss thường stage 2
      }
    }

    state.bullets.push({
      x: cx,
      y: cy,
      vx,
      vy,
      owner,
      dmg: owner.type === "player" ? 1 * owner.dmgMul : 1,
      bossPierce: byBoss,
      spriteType, // 👈 lưu lại để drawBullets dùng
      alive: true,
    });

    playSound("shot");
  }

  function update(dt) {
    pollGamepad();
    updatePowerups(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateBullets(dt);
    checkWinLose();
    updateHUD();
  }

  function updatePlayer(dt) {
    const p = state.player;
    if (!p) return;
    if (!p.alive) {
      if (now() >= p.respawnAt) {
        // spawn lại đúng chỗ ban đầu
        p.x = p.spawnX;
        p.y = p.spawnY;
        p.dir = "up";
        p.alive = true;
        p.invincibleUntil = now() + 3; // vô địch 3s sau khi hồi sinh
      } else return;
    }

    let vx = 0,
      vy = 0;
    if (input.left) {
      vx = -1;
      p.dir = "left";
    }
    if (input.right) {
      vx = 1;
      p.dir = "right";
    }
    if (input.up) {
      vy = -1;
      p.dir = "up";
    }
    if (input.down) {
      vy = 1;
      p.dir = "down";
    }

    const len = Math.hypot(vx, vy) || 1;
    const nx = clamp(
      p.x + (vx / len) * p.speed * dt,
      0,
      state.world.width - p.size
    );
    const ny = clamp(
      p.y + (vy / len) * p.speed * dt,
      0,
      state.world.height - p.size
    );

    // check map collision + tank collision
    if (
      !rectIntersectsSolid(nx, p.y, p.size) &&
      !tankCollides(nx, p.y, p.size, p)
    ) {
      p.x = nx;
    }
    if (
      !rectIntersectsSolid(p.x, ny, p.size) &&
      !tankCollides(p.x, ny, p.size, p)
    ) {
      p.y = ny;
    }

    p.fireCd -= dt;
    if (input.fire && p.fireCd <= 0) {
      fireBullet(p);
      p.fireCd = 0.5;
    }
  }

  function updateEnemies(dt) {
    const cfg = CONFIGStage();
    // maintain active enemies up to 5, total by enemiesLeft
    while (state.enemies.length < Math.min(5, state.enemiesLeft)) {
      state.enemies.push(createEnemy());
    }
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (!e.alive) {
        state.enemies.splice(i, 1);
        continue;
      }

      e.retarget -= dt;
      e.fireCd -= dt;
      if (e.retarget <= 0) {
        e.dir = choice(DIRS);
        e.retarget = cfg.enemyMoveRetarget + rnd(-0.3, 0.5);
      }

      let vx = 0,
        vy = 0;
      if (e.dir === "left") vx = -1;
      else if (e.dir === "right") vx = 1;
      else if (e.dir === "up") vy = -1;
      else vy = 1;

      const nx = clamp(e.x + vx * e.speed * dt, 0, state.world.width - e.size);
      const ny = clamp(e.y + vy * e.speed * dt, 0, state.world.height - e.size);

      if (
        !rectIntersectsSolid(nx, e.y, e.size) &&
        !tankCollides(nx, e.y, e.size, e)
      ) {
        e.x = nx;
      } else {
        e.dir = choice(DIRS);
      }
      if (
        !rectIntersectsSolid(e.x, ny, e.size) &&
        !tankCollides(e.x, ny, e.size, e)
      ) {
        e.y = ny;
      } else {
        e.dir = choice(DIRS);
      }

      if (e.fireCd <= 0) {
        fireBullet(e);
        e.fireCd = cfg.enemyFireDelay + rnd(0, 1.2);
      }
    }
  }

  function updateBoss(dt) {
    if (state.stage !== 2 && state.stage !== 5) return;
    if (!state.boss && now() >= state.timers.bossSpawnTime) {
      state.boss = createBoss();
      // âm thanh spawn khác nhau cho boss thường và shark boss
      if (state.stage === 2) {
        playBeep(80, 0.5); // tiếng trầm (khói đen)
        playBeep(200, 0.2); // tiếng nổ nhẹ
      } else if (state.stage === 5) {
        playBeep(120, 0.8); // tiếng ù ù
        playBeep(500, 0.3); // tiếng nước xoáy
      }
    }
    const b = state.boss;
    if (!b) return;

    const aliveTime = now() - b.spawnedAt;

    // boss đang spawn (6s đầu)
    if (aliveTime < b.canFireDelay) {
      return; // chỉ vẽ animation trong drawBoss
    } else if (b.spawning) {
      b.spawning = false; // sau 6s -> bắt đầu hoạt động
    }

    // chỉ retarget mỗi khoảng thời gian
    b.retarget -= dt;
    if (b.retarget <= 0) {
      const p = state.player;
      if (p && p.alive) {
        const dx = p.x + 16 - (b.x + b.size / 2);
        const dy = p.y + 16 - (b.y + b.size / 2);
        if (Math.abs(dx) > Math.abs(dy)) b.dir = dx < 0 ? "left" : "right";
        else b.dir = dy < 0 ? "up" : "down";
      } else {
        b.dir = choice(DIRS);
      }
      b.retarget = 1.0 + rnd(0.5, 1.0);
    }

    // di chuyển
    let vx = 0,
      vy = 0;
    if (b.dir === "left") vx = -1;
    else if (b.dir === "right") vx = 1;
    else if (b.dir === "up") vy = -1;
    else vy = 1;

    const nx = clamp(b.x + vx * b.speed * dt, 0, state.world.width - b.size);
    const ny = clamp(b.y + vy * b.speed * dt, 0, state.world.height - b.size);

    let moved = false;
    if (
      !rectIntersectsSolid(nx, b.y, b.size) &&
      !tankCollides(nx, b.y, b.size, b)
    ) {
      b.x = nx;
      moved = true;
    }
    if (
      !rectIntersectsSolid(b.x, ny, b.size) &&
      !tankCollides(b.x, ny, b.size, b)
    ) {
      b.y = ny;
      moved = true;
    }

    if (!moved) {
      const dirs = DIRS.filter((d) => d !== b.dir);
      b.dir = choice(dirs);
      b.retarget = 0.2;
    }

    // chỉ bắn sau khi spawn xong
    if (!b.spawning) {
      b.fireCd -= dt;
      if (b.fireCd <= 0) {
        fireBullet(b);
        b.fireCd = state.stage === 5 ? 0.6 : 1.0;
      }
    }

    // shark boss va chạm thì kill player
    if (b.touchKill && state.player && state.player.alive) {
      if (
        rectHit(
          b.x,
          b.y,
          b.size,
          b.size,
          state.player.x,
          state.player.y,
          state.player.size,
          state.player.size
        )
      ) {
        killPlayer();
      }
    }
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      if (!b.alive) {
        state.bullets.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // tile collision
      const t = tileAt(b.x, b.y);
      if (isBulletBlocked(t, b.bossPierce)) {
        state.bullets.splice(i, 1);
        playBeep(150, 0.05);
        continue;
      }
      if (damageTileAt(b.x, b.y)) {
        state.bullets.splice(i, 1);
        continue;
      }
      // entity collision
      if (b.owner.type !== "player" && state.player && state.player.alive) {
        if (
          rectHit(
            b.x - 3,
            b.y - 3,
            6,
            6,
            state.player.x,
            state.player.y,
            state.player.size,
            state.player.size
          )
        ) {
          // one-shot if boss bullet
          killPlayer();
          state.bullets.splice(i, 1);
          continue;
        }
      }
      if (b.owner.type === "player") {
        for (let j = state.enemies.length - 1; j >= 0; j--) {
          const e = state.enemies[j];
          if (!e.alive) continue;
          if (rectHit(b.x - 3, b.y - 3, 6, 6, e.x, e.y, e.size, e.size)) {
            e.alive = false;
            state.enemiesLeft--;
            state.enemies.splice(j, 1);
            playSound("killenemy");
            state.bullets.splice(i, 1);
            break;
          }
        }
        if (
          state.boss &&
          state.boss.alive &&
          rectHit(
            b.x - 3,
            b.y - 3,
            6,
            6,
            state.boss.x,
            state.boss.y,
            state.boss.size,
            state.boss.size
          )
        ) {
          state.boss.hp -= b.dmg;
          state.bullets.splice(i, 1);
          playSound("killenemy"); // hoặc tạo riêng sound bossHit.mp3 nếu có

          if (state.boss.hp <= 0) {
            state.boss.alive = false;
            state.enemiesLeft = 0;
            win(true);
          }
        }
      }
      if (
        b.x < -16 ||
        b.x > state.world.width + 16 ||
        b.y < -16 ||
        b.y > state.world.height + 16
      ) {
        state.bullets.splice(i, 1);
      }
    }
  }

  function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ---------- Powerups ----------
  function updatePowerups() {
    const t = now();
    if (t >= state.timers.nextPowerup) {
      spawnPowerup();
      state.timers.nextPowerup = t + 30;
    }
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const pu = state.powerups[i];
      if (t > pu.despawnAt) {
        state.powerups.splice(i, 1);
        continue;
      }
      if (
        state.player &&
        state.player.alive &&
        rectHit(
          state.player.x,
          state.player.y,
          state.player.size,
          state.player.size,
          pu.x,
          pu.y,
          24,
          24
        )
      ) {
        state.player.dmgMul = 2;
        state.timers.powerupExpire = t + 20;
        state.powerups.splice(i, 1);
        playSound("buffdame");
      }
    }
    if (
      state.player &&
      state.player.dmgMul > 1 &&
      t >= state.timers.powerupExpire
    ) {
      state.player.dmgMul = 1;
    }
  }
  function spawnPowerup() {
    const x = rnd(32, state.world.width - 56),
      y = rnd(32, state.world.height - 56);
    state.powerups.push({ x, y, type: "x2", despawnAt: now() + 10 });
  }

  function draw() {
    ctx.clearRect(0, 0, state.world.width, state.world.height);
    drawGrid();
    drawPlayer();
    drawEnemies();
    drawBoss();
    drawBullets();
    drawPowerups();
  }

  function drawGrid() {
    const A = TB.Assets.get();
    for (let y = 0; y < state.world.heightTiles; y++) {
      for (let x = 0; x < state.world.widthTiles; x++) {
        const t = state.map[y][x];
        const px = x * TILE,
          py = y * TILE;
        if (
          t === MAP_TYPES.BRICK &&
          A.useImages &&
          A.imgs.tiles &&
          A.imgs.tiles.brick
        ) {
          ctx.drawImage(A.imgs.tiles.brick, px, py, TILE, TILE);
        } else if (
          t === MAP_TYPES.STEEL &&
          A.useImages &&
          A.imgs.tiles &&
          A.imgs.tiles.steel
        ) {
          ctx.drawImage(A.imgs.tiles.steel, px, py, TILE, TILE);
        } else if (
          t === MAP_TYPES.WATER &&
          A.useImages &&
          A.imgs.tiles &&
          A.imgs.tiles.water
        ) {
          ctx.drawImage(A.imgs.tiles.water, px, py, TILE, TILE);
        } else if (
          t === MAP_TYPES.BUSH &&
          A.useImages &&
          A.imgs.tiles &&
          A.imgs.tiles.bush
        ) {
          ctx.drawImage(A.imgs.tiles.bush, px, py, TILE, TILE);
        } else if (
          t === MAP_TYPES.BASE &&
          A.useImages &&
          A.imgs.tiles &&
          A.imgs.tiles.base
        ) {
          ctx.drawImage(A.imgs.tiles.base, px, py, TILE, TILE);
        } else {
          // colored fallbacks for visibility when images missing
          switch (t) {
            case MAP_TYPES.EMPTY:
              ctx.fillStyle = (x + y) & 1 ? "#1f1f28" : "#232330";
              break;
            case MAP_TYPES.BRICK:
              ctx.fillStyle = "#8b3d3d";
              break;
            case MAP_TYPES.STEEL:
              ctx.fillStyle = "#9aa0a6";
              break;
            case MAP_TYPES.WATER:
              ctx.fillStyle = "#2b6cb0";
              break;
            case MAP_TYPES.BUSH:
              ctx.fillStyle = "#2f855a";
              break;
            case MAP_TYPES.BASE:
              ctx.fillStyle = "#ffd166";
              break;
            default:
              ctx.fillStyle = "#232330";
          }
          ctx.fillRect(px, py, TILE, TILE);
        }
      }
    }
  }

  function drawPlayer() {
    const p = state.player;
    if (!p || !p.alive) return;
    const A = TB.Assets.get();
    if (A.useImages && A.imgs.player) {
      ctx.save();
      ctx.translate(p.x + p.size / 2, p.y + p.size / 2);
      if (p.dir === "down") ctx.rotate(Math.PI);
      else if (p.dir === "left") ctx.rotate(-Math.PI / 2);
      else if (p.dir === "right") ctx.rotate(Math.PI / 2);
      ctx.drawImage(A.imgs.player, -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    } else {
      ctx.fillStyle = "#49a6ff";
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  function drawEnemies() {
    const A = TB.Assets.get();
    for (const e of state.enemies) {
      if (!e.alive) continue;
      ctx.save();
      ctx.translate(e.x + e.size / 2, e.y + e.size / 2);
      if (e.dir === "down") ctx.rotate(Math.PI);
      else if (e.dir === "left") ctx.rotate(-Math.PI / 2);
      else if (e.dir === "right") ctx.rotate(Math.PI / 2);
      if (A.useImages && A.imgs.enemy) {
        ctx.drawImage(A.imgs.enemy, -e.size / 2, -e.size / 2, e.size, e.size);
      } else {
        ctx.fillStyle = "#ff4949";
        ctx.fillRect(-e.size / 2, -e.size / 2, e.size, e.size);
      }
      ctx.restore();
    }
  }

  function drawBoss() {
    const b = state.boss;
    if (!b || !b.alive) return;
    const A = TB.Assets.get();

    ctx.save();
    ctx.translate(b.x + b.size / 2, b.y + b.size / 2);

    const aliveTime = now() - b.spawnedAt;
    const progress = Math.min(1, aliveTime / b.canFireDelay); // 0 → 1 trong 6s

    if (aliveTime < b.canFireDelay) {
      // -------- Hiệu ứng spawn --------
      if (state.stage === 2) {
        // Khói đen + chớp sáng
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const r = progress * (40 + Math.random() * 60);
          const px = Math.cos(angle) * r;
          const py = Math.sin(angle) * r;
          ctx.fillStyle = `rgba(30,30,30,${0.6 * (1 - progress)})`;
          ctx.beginPath();
          ctx.arc(px, py, 8 * (1 - progress), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(255,180,50,${0.3 * (1 - progress)})`;
        ctx.beginPath();
        ctx.arc(0, 0, 40 * progress, 0, Math.PI * 2);
        ctx.fill();
      } else if (state.stage === 5) {
        // Lốc xoáy nước
        const radius = b.size * (0.8 + progress * 1.5);
        const t = now();

        // nhiều vòng gradient nước
        for (let i = 0; i < 3; i++) {
          const r = radius * (0.6 + i * 0.25);
          const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
          grad.addColorStop(0, `rgba(0,180,255,${0.25 * (1 - progress)})`);
          grad.addColorStop(0.7, `rgba(0,120,200,${0.15 * (1 - progress)})`);
          grad.addColorStop(1, "rgba(0,50,150,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // các đường xoắn quay
        ctx.strokeStyle = `rgba(100,200,255,${0.5 * (1 - progress)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
          const r1 = radius * 0.3;
          const r2 = radius;
          ctx.moveTo(
            Math.cos(angle + t * 2) * r1,
            Math.sin(angle + t * 2) * r1
          );
          ctx.lineTo(
            Math.cos(angle + t * 2) * r2,
            Math.sin(angle + t * 2) * r2
          );
        }
        ctx.stroke();
      }
      ctx.restore();
      return; // 👈 chưa vẽ boss khi còn trong hiệu ứng spawn
    }
    // -------- Vẽ boss sau khi spawn --------
    if (b.dir === "down") ctx.rotate(Math.PI);
    else if (b.dir === "left") ctx.rotate(-Math.PI / 2);
    else if (b.dir === "right") ctx.rotate(Math.PI / 2);
    if (A.useImages) {
      if (state.stage === 5 && A.imgs.sharkBoss) {
        ctx.drawImage(
          A.imgs.sharkBoss,
          -b.size / 2,
          -b.size / 2,
          b.size,
          b.size
        );
      } else if (A.imgs.boss) {
        ctx.drawImage(A.imgs.boss, -b.size / 2, -b.size / 2, b.size, b.size);
      } else {
        ctx.fillStyle = "#ff8b3b";
        ctx.fillRect(-b.size / 2, -b.size / 2, b.size, b.size);
      }
    }
    ctx.restore();
  }

  function drawBullets() {
    const A = TB.Assets.get();
    for (const b of state.bullets) {
      if (!b.alive) continue;

      // boss bullets
      if (b.owner && b.owner.type === "boss" && A.useImages) {
        if (b.spriteType === "shark" && A.imgs.sharkBullet) {
          ctx.drawImage(A.imgs.sharkBullet, b.x - 8, b.y - 8, 16, 16);
        } else if (A.imgs.bossBullet) {
          ctx.drawImage(A.imgs.bossBullet, b.x - 8, b.y - 8, 16, 16);
        }
        continue;
      }

      // normal bullets
      if (A.useImages && A.imgs.bullet) {
        ctx.drawImage(A.imgs.bullet, b.x - 4, b.y - 4, 8, 8);
      } else {
        ctx.fillStyle = "#ffd54a";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPowerups() {
    for (const p of state.powerups) {
      ctx.fillStyle = "#7CFC00";
      ctx.fillRect(p.x, p.y, 24, 24);
      ctx.fillStyle = "#ffffff99";
      ctx.fillRect(p.x + 6, p.y + 6, 12, 12);
    }
  }

  function loop(ts) {
    if (!state.running) return;
    const dt = Math.min(0.033, (ts - state.lastTime) / 1000 || 0);
    state.lastTime = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start(stage) {
    state.stage = stage;
    state.running = true;
    state.inMenu = false;
    state.lastTime = performance.now();
    updateHUD();
    buildEnemyStack();
    hideOverlay();
    initAudio();
    requestAnimationFrame(loop);
  }

  function initMenu() {
    ensureInit();
    state.inMenu = true;
    state.running = false;
    showOverlay("Tank Blitz", "Bắt đầu Stage 1", () => startLevel(1));
  }

  function startLevel(stage) {
    ensureInit();
    state.stage = stage;
    state.lives = 3;

    const cfg = CONFIG["stage" + stage];
    if (!cfg) {
      console.error("Stage config not found:", stage);
      return;
    }

    state.world.widthTiles = cfg.widthTiles;
    state.world.heightTiles = cfg.heightTiles;
    state.world.width = state.world.widthTiles * TILE;
    state.world.height = state.world.heightTiles * TILE;
    canvas.width = state.world.width;
    canvas.height = state.world.height;

    state.map = createMapRandom(
      state.world.widthTiles,
      state.world.heightTiles
    ); // tạo map trước
    state.player = createPlayer();
    state.bullets = [];
    state.enemies = [];
    state.boss = null;
    state.powerups = [];
    state.enemiesLeft = cfg.enemies;
    state.timers.nextPowerup = now() + 30;
    state.timers.powerupExpire = 0;
    state.timers.bossSpawnTime = stage === 2 || stage === 5 ? now() : Infinity;
    updateHUD();
    buildEnemyStack();

    // load assets rồi mới start
    TB.Assets.whenReady().then(() => {
      start(stage);
    });
    playSound("startgame");
  }

  let initialized = false;
  function ensureInit() {
    if (initialized) return;
    initCanvas();
    setUIRefs();
    attachKeyboard();
    updateHUD();
    buildEnemyStack();
    loadSounds();
    initialized = true;
  }

  function findFreeTile() {
    while (true) {
      const tx = Math.floor(Math.random() * state.world.widthTiles);
      const ty = Math.floor(
        Math.random() * Math.floor(state.world.heightTiles / 2)
      ); // chỉ nửa trên map
      if (
        state.map[ty][tx] === MAP_TYPES.EMPTY ||
        state.map[ty][tx] === MAP_TYPES.BUSH
      ) {
        return { x: tx * TILE, y: ty * TILE };
      }
    }
  }

  function tankCollides(nx, ny, size, self) {
    // check với player
    if (state.player && state.player.alive && self !== state.player) {
      if (
        rectHit(
          nx,
          ny,
          size,
          size,
          state.player.x,
          state.player.y,
          state.player.size,
          state.player.size
        )
      ) {
        return true;
      }
    }
    // check với enemies
    for (const e of state.enemies) {
      if (!e.alive || e === self) continue;
      if (rectHit(nx, ny, size, size, e.x, e.y, e.size, e.size)) {
        return true;
      }
    }
    // check với boss
    if (state.boss && state.boss.alive && self !== state.boss) {
      if (
        rectHit(
          nx,
          ny,
          size,
          size,
          state.boss.x,
          state.boss.y,
          state.boss.size,
          state.boss.size
        )
      ) {
        return true;
      }
    }
    return false;
  }

  function win(fromBoss = false) {
    state.running = false;
    showOverlay(
      fromBoss ? "YOU DEFEATED THE BOSS!" : "YOU WIN!",
      "Menu",
      () => {
        location.href = "/";
      }
    );
    playSound("win");
  }
  function gameOver() {
    state.running = false;
    showOverlay("GAME OVER", "Menu", () => {
      location.href = "/";
    });
    playSound("gameover");
  }
  function checkWinLose() {
    if (state.lives < 0) {
      gameOver();
      return;
    }
    if (state.enemiesLeft <= 0) {
      if (state.stage === 1) {
        win();
      }
      if (
        (state.stage === 2 || state.stage === 5) &&
        !state.boss &&
        now() < state.timers.bossSpawnTime
      ) {
        win();
      }
    }
  }

  // cuối file, trước return
  function togglePause() {
    if (state.running) {
      state.running = false;
    } else {
      state.running = true;
      state.lastTime = performance.now();
      requestAnimationFrame(loop);
    }
    playSound("timestop");
  }

  // function toggleSound(){ toggleMute(); }
  function toggleSound() {
    toggleMute();
    const btn = document.querySelector(".ui-buttons button:nth-child(3)");
    if (btn) {
      btn.textContent = state.muted ? "🔇 Sound Off" : "🔊 Sound On";
    }
  }

  // expose
  return { initMenu, startLevel, togglePause, toggleSound };
})();
