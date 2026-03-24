(function (global) {
  const Data = global.VelvetPourData;
  const TILE_W = 96;
  const TILE_H = 48;
  const GRID_W = 10;
  const GRID_H = 10;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function formatEuro(value) {
    return `EUR ${value.toFixed(2)}`;
  }

  function getLivePrice(recipe, timeMs) {
    const drift = Math.sin((timeMs / 1000) * 0.021 + recipe.basePrice * 2) * 0.16;
    const pulse = Math.cos((timeMs / 1000) * 0.013 + recipe.sequence.length) * 0.08;
    return Math.max(2, recipe.basePrice + drift + pulse);
  }

  function getDateParts() {
    const now = new Date();
    return {
      day: now.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase(),
      date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase(),
      time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    };
  }

  function createGame(options) {
    const canvas = options.canvas;
    const ctx = canvas.getContext("2d");
    const origin = { x: 0, y: 188 };
    let audio = null;
    let lastFrame = performance.now();

    const player = { x: 4, y: 5, targetX: 4, targetY: 5, speed: 4.5, task: null, taskTime: 0, taskDuration: 0 };
    const state = {
      view: "game",
      started: false,
      paused: false,
      gameOver: false,
      score: 0,
      coins: 0,
      reputation: 100,
      customersServed: 0,
      combo: 1,
      shiftLength: 180,
      shiftRemaining: 180,
      spawnCooldown: 2,
      activeCup: null,
      customers: [],
      particles: [],
      floatingText: [],
      keys: new Set(),
      uiTick: 0,
      soundEnabled: true
    };

    function isoToScreen(tileX, tileY) {
      return { x: origin.x + (tileX - tileY) * (TILE_W / 2), y: origin.y + (tileX + tileY) * (TILE_H / 2) };
    }

    function screenToTile(x, y) {
      const lx = x - origin.x;
      const ly = y - origin.y;
      return {
        x: Math.round((ly / (TILE_H / 2) + lx / (TILE_W / 2)) / 2),
        y: Math.round((ly / (TILE_H / 2) - lx / (TILE_W / 2)) / 2)
      };
    }

    function shade(hex, amount) {
      const raw = parseInt(hex.replace("#", ""), 16);
      const r = clamp((raw >> 16) + amount, 0, 255);
      const g = clamp(((raw >> 8) & 255) + amount, 0, 255);
      const b = clamp((raw & 255) + amount, 0, 255);
      return `rgb(${r}, ${g}, ${b})`;
    }

    function roundedRect(x, y, w, h, r, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    }

    function prism(x, y, width, depth, height, color) {
      const hw = width / 2;
      const hd = depth / 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + hw, y + hd);
      ctx.lineTo(x + hw, y + hd - height);
      ctx.lineTo(x, y - height);
      ctx.closePath();
      ctx.fillStyle = shade(color, 10);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - hw, y + hd);
      ctx.lineTo(x - hw, y + hd - height);
      ctx.lineTo(x, y - height);
      ctx.closePath();
      ctx.fillStyle = shade(color, -18);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, y - height);
      ctx.lineTo(x + hw, y + hd - height);
      ctx.lineTo(x, y + depth - height);
      ctx.lineTo(x - hw, y + hd - height);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    function bestRecipeMatch(steps) {
      let best = null;
      let bestPrefix = -1;
      Data.recipes.forEach((recipe) => {
        let prefix = 0;
        for (let i = 0; i < Math.min(recipe.sequence.length, steps.length); i += 1) {
          if (recipe.sequence[i] !== steps[i]) break;
          prefix += 1;
        }
        if (prefix > bestPrefix) {
          best = recipe;
          bestPrefix = prefix;
        }
      });
      return best;
    }

    function snapshot() {
      const station = nearbyStation();
      return {
        view: state.view,
        started: state.started,
        paused: state.paused,
        gameOver: state.gameOver,
        score: state.score,
        coins: state.coins,
        reputation: state.reputation,
        shiftLabel: formatTime(state.shiftRemaining),
        customersServed: state.customersServed,
        comboLabel: `x${state.combo.toFixed(2).replace(/\.00$/, "")}`,
        rank: getRank(state.score),
        soundEnabled: state.soundEnabled,
        currentStation: station,
        availableActions: station ? (station.id === "counter" ? ["serve"] : station.actions.slice()) : [],
        activeCup: state.activeCup ? { steps: state.activeCup.steps.slice(), bestMatch: bestRecipeMatch(state.activeCup.steps) } : null,
        customers: state.customers.map((customer, index) => mapCustomer(customer, index))
      };
    }

    function notify(force) {
      if (!options.onStateChange) return;
      if (!force && state.uiTick > 0) return;
      options.onStateChange(snapshot());
      state.uiTick = 0.12;
    }

    function getRank(score) {
      if (score >= 2400) return "Legendary Brewer";
      if (score >= 1600) return "Gold Shift Lead";
      if (score >= 900) return "Velvet Pro";
      if (score >= 300) return "Rising Roaster";
      return "Apprentice";
    }

    function mapCustomer(customer, index) {
      const recipe = Data.recipes.find((entry) => entry.key === customer.recipeKey);
      return {
        id: customer.id,
        name: customer.name,
        recipeName: recipe.name,
        note: recipe.note,
        priceLabel: formatEuro(customer.offerPrice),
        patience: customer.patience,
        patienceMax: customer.patienceMax,
        front: index === 0
      };
    }

    function nearbyStation() {
      return Data.stations.find((station) => Math.abs(player.x - station.useTile.x) + Math.abs(player.y - station.useTile.y) <= 0.14) || null;
    }

    function canMoveTo(tileX, tileY) {
      if (tileX < 0 || tileY < 0 || tileX >= GRID_W || tileY >= GRID_H) return false;
      return !Data.stations.some((station) => station.tile.x === tileX && station.tile.y === tileY);
    }

    function setTarget(tileX, tileY) {
      const nextX = clamp(tileX, 0, GRID_W - 1);
      const nextY = clamp(tileY, 0, GRID_H - 1);
      if (canMoveTo(nextX, nextY)) {
        player.targetX = nextX;
        player.targetY = nextY;
      }
    }

    function speak(text, color, point) {
      state.floatingText.push({ x: point ? point.x : canvas.clientWidth / 2, y: point ? point.y : 72, text, color, life: 1.8 });
    }

    function emitParticles(tileX, tileY, color) {
      const p = isoToScreen(tileX, tileY);
      for (let i = 0; i < 12; i += 1) {
        state.particles.push({
          x: p.x,
          y: p.y - 48,
          vx: (Math.random() - 0.5) * 60,
          vy: -20 - Math.random() * 80,
          life: 0.7 + Math.random() * 0.4,
          color
        });
      }
    }

    function customerFactory(forcedRecipeKey) {
      const recipe = forcedRecipeKey
        ? Data.recipes.find((entry) => entry.key === forcedRecipeKey) || Data.recipes[0]
        : Data.recipes[Math.floor(Math.random() * Data.recipes.length)];
      const look = Data.customerLooks[Math.floor(Math.random() * Data.customerLooks.length)];
      const name = Data.customerNames[Math.floor(Math.random() * Data.customerNames.length)];
      return {
        id: `customer-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        recipeKey: recipe.key,
        offerPrice: getLivePrice(recipe, Date.now()),
        patience: recipe.patience,
        patienceMax: recipe.patience,
        name,
        look
      };
    }

    function initAudio() {
      if (audio) {
        audio.enabled = true;
        state.soundEnabled = true;
        if (audio.context.state === "suspended") audio.context.resume();
        return;
      }
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const master = context.createGain();
      master.gain.value = 0.34;
      master.connect(context.destination);
      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 1600;
      lowpass.Q.value = 0.6;
      lowpass.connect(master);

      function playSoftPad(now, notes) {
        const chordGain = context.createGain();
        chordGain.gain.setValueAtTime(0.0001, now);
        chordGain.gain.exponentialRampToValueAtTime(0.03, now + 0.45);
        chordGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
        chordGain.connect(lowpass);

        notes.forEach((frequency, index) => {
          const osc = context.createOscillator();
          const voice = context.createGain();
          osc.type = index === 0 ? "sine" : "triangle";
          osc.frequency.setValueAtTime(frequency, now);
          voice.gain.value = index === 0 ? 0.9 : 0.55;
          osc.connect(voice);
          voice.connect(chordGain);
          osc.start(now);
          osc.stop(now + 3.5);
        });

        const shimmer = context.createOscillator();
        const shimmerGain = context.createGain();
        shimmer.type = "sine";
        shimmer.frequency.setValueAtTime(notes[notes.length - 1] * 2, now + 1.1);
        shimmerGain.gain.setValueAtTime(0.0001, now);
        shimmerGain.gain.exponentialRampToValueAtTime(0.009, now + 1.1);
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        shimmer.connect(shimmerGain);
        shimmerGain.connect(lowpass);
        shimmer.start(now + 0.9);
        shimmer.stop(now + 2.45);
      }

      const padChords = [
        [196, 246.94, 293.66],
        [174.61, 220, 261.63],
        [164.81, 220, 246.94],
        [196, 233.08, 293.66]
      ];
      let padIndex = 0;
      playSoftPad(context.currentTime, padChords[padIndex]);
      const ambienceTimer = window.setInterval(() => {
        if (!audio || !audio.enabled) return;
        padIndex = (padIndex + 1) % padChords.length;
        playSoftPad(context.currentTime, padChords[padIndex]);
      }, 3200);
      audio = { context, master, lowpass, ambienceTimer, enabled: true };
      state.soundEnabled = true;
    }

    function sfx(kind) {
      if (!audio || !audio.enabled) return;
      const now = audio.context.currentTime;
      const gain = audio.context.createGain();
      gain.connect(audio.master);
      if (kind === "steam") {
        const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 0.35, audio.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.22;
        const noise = audio.context.createBufferSource();
        const filter = audio.context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 520;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        noise.buffer = buffer;
        noise.connect(filter).connect(gain);
        noise.start(now);
        noise.stop(now + 0.34);
        return;
      }
      const osc = audio.context.createOscillator();
      osc.type = { serve: "triangle", arrive: "sine", error: "sawtooth", leave: "square", trash: "square", cup: "triangle", start: "triangle", stop: "triangle" }[kind] || "square";
      const cfg = {
        brew: { f: 180, e: 120, d: 0.2, v: 0.14 },
        cup: { f: 640, e: 760, d: 0.12, v: 0.12 },
        serve: { f: 720, e: 1080, d: 0.28, v: 0.16 },
        arrive: { f: 420, e: 520, d: 0.2, v: 0.1 },
        error: { f: 220, e: 180, d: 0.22, v: 0.12 },
        leave: { f: 180, e: 140, d: 0.18, v: 0.09 },
        trash: { f: 120, e: 90, d: 0.15, v: 0.09 },
        start: { f: 440, e: 660, d: 0.22, v: 0.15 },
        stop: { f: 420, e: 220, d: 0.28, v: 0.12 }
      }[kind] || { f: 240, e: 280, d: 0.15, v: 0.08 };
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(cfg.v, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.d);
      osc.connect(gain);
      osc.frequency.setValueAtTime(cfg.f, now);
      osc.frequency.exponentialRampToValueAtTime(cfg.e, now + cfg.d);
      osc.start(now);
      osc.stop(now + cfg.d);
    }
    function doAction(actionKey) {
      if (!state.started || state.paused || state.view !== "game" || player.task) return;
      const station = nearbyStation();
      if (!station) return;
      if (actionKey === "serve") return serveFrontCustomer();
      if (station.actions.indexOf(actionKey) === -1) return;
      if (!state.activeCup && actionKey.indexOf("cup_") !== 0) {
        speak("Grab a cup first", "#ffbc57");
        sfx("error");
        return;
      }
      if (state.activeCup && actionKey.indexOf("cup_") === 0) {
        speak("Finish or trash the current cup first", "#ffbc57");
        sfx("error");
        return;
      }
      const durations = { cup_espresso: 0.45, cup_tulip: 0.45, cup_mug: 0.45, grind: 1.25, espresso: 1.5, ristretto: 1.4, hot_water: 0.9, steam_milk: 1.3, foam_cap: 1.1, microfoam: 1.2, mocha_sauce: 0.8, whip: 0.75 };
      player.task = actionKey;
      player.taskTime = 0;
      player.taskDuration = durations[actionKey] || 1;
      speak(Data.actionMeta[actionKey].label, "#c8f6ff");
      notify(true);
    }

    function finishTask(actionKey) {
      if (actionKey.indexOf("cup_") === 0) {
        state.activeCup = { steps: [actionKey] };
        sfx("cup");
      } else if (state.activeCup) {
        state.activeCup.steps.push(actionKey);
        sfx(actionKey === "steam_milk" || actionKey === "foam_cap" || actionKey === "microfoam" ? "steam" : "brew");
      }
      emitParticles(player.x, player.y, actionKey === "steam_milk" ? "#dffcff" : "#ffbc57");
      player.task = null;
      player.taskTime = 0;
      player.taskDuration = 0;
      notify(true);
    }

    function serveFrontCustomer() {
      if (!state.activeCup) {
        speak("No drink to serve", "#ffbc57");
        sfx("error");
        return;
      }
      const customer = state.customers[0];
      if (!customer) {
        speak("No customer at the counter", "#ffbc57");
        sfx("error");
        return;
      }
      const recipe = Data.recipes.find((entry) => entry.key === customer.recipeKey);
      const perfect = state.activeCup.steps.length === recipe.sequence.length && state.activeCup.steps.every((step, index) => step === recipe.sequence[index]);
      if (perfect) {
        const patienceRatio = customer.patience / customer.patienceMax;
        const reward = Math.round(customer.offerPrice * 10 * (1 + patienceRatio * 0.5) * state.combo);
        state.score += reward * 10;
        state.coins += reward;
        state.combo = Math.min(state.combo + 0.25, 4);
        state.reputation = Math.min(100, state.reputation + 2);
        state.customersServed += 1;
        state.customers.shift();
        state.activeCup = null;
        sfx("serve");
        speak(`Perfect ${recipe.name}! +${reward}`, "#8be28f");
      } else {
        state.combo = 1;
        state.reputation = Math.max(0, state.reputation - 6);
        customer.patience = Math.max(1, customer.patience - 18);
        sfx("error");
        speak("Wrong build. Check trainee mode.", "#ff687b");
      }
      notify(true);
    }

    function trashCup() {
      if (!state.activeCup) {
        speak("No cup to trash", "#ffbc57");
        return;
      }
      state.activeCup = null;
      state.combo = 1;
      sfx("trash");
      speak("Cup trashed", "#ff687b");
      notify(true);
    }

    function startShift() {
      initAudio();
      state.view = "game";
      state.started = true;
      state.paused = false;
      state.gameOver = false;
      state.score = 0;
      state.coins = 0;
      state.reputation = 100;
      state.customersServed = 0;
      state.combo = 1;
      state.shiftRemaining = state.shiftLength;
      state.spawnCooldown = 2;
      state.activeCup = null;
      state.customers = [];
      state.particles = [];
      state.floatingText = [];
      player.x = 4;
      player.y = 5;
      player.targetX = 4;
      player.targetY = 5;
      player.task = null;
      sfx("start");
      speak("Shift started", "#8be28f");
      notify(true);
    }

    function stopShift() {
      state.started = false;
      state.paused = false;
      state.gameOver = false;
      state.customers = [];
      state.activeCup = null;
      state.keys.clear();
      player.task = null;
      sfx("stop");
      speak("Shift stopped", "#ffbc57");
      notify(true);
    }

    function setView(view) {
      state.view = view;
      state.paused = state.started && view !== "game";
      state.keys.clear();
      notify(true);
    }

    function toggleSound() {
      if (!audio) initAudio();
      else {
        audio.enabled = !audio.enabled;
        state.soundEnabled = audio.enabled;
        if (audio.enabled && audio.context.state === "suspended") audio.context.resume();
      }
      if (state.soundEnabled) sfx("start");
      notify(true);
    }

    function debugSetPlayer(tileX, tileY) {
      player.x = clamp(tileX, 0, GRID_W - 1);
      player.y = clamp(tileY, 0, GRID_H - 1);
      player.targetX = player.x;
      player.targetY = player.y;
      player.task = null;
      player.taskTime = 0;
      player.taskDuration = 0;
      notify(true);
    }

    function debugInjectCustomer(recipeKey) {
      state.customers.push(customerFactory(recipeKey));
      notify(true);
    }

    function debugClearCustomers() {
      state.customers = [];
      notify(true);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * ratio);
      canvas.height = Math.floor(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      origin.x = rect.width / 2;
      origin.y = 188;
    }

    function drawFloor() {
      for (let y = 0; y < GRID_H; y += 1) {
        for (let x = 0; x < GRID_W; x += 1) {
          const p = isoToScreen(x, y);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
          ctx.lineTo(p.x, p.y + TILE_H);
          ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
          ctx.closePath();
          ctx.fillStyle = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1 ? "#244151" : ((x + y) % 2 === 0 ? "#315468" : "#284658");
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.stroke();
        }
      }
    }

    function drawWalls() {
      for (let i = 0; i < GRID_W - 1; i += 1) {
        const p = isoToScreen(i, 0);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
        ctx.lineTo(p.x + TILE_W / 2, p.y - 94);
        ctx.lineTo(p.x, p.y - 118);
        ctx.closePath();
        ctx.fillStyle = "#183142";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
        ctx.lineTo(p.x - TILE_W / 2, p.y - 72);
        ctx.lineTo(p.x, p.y - 118);
        ctx.closePath();
        ctx.fillStyle = "#132635";
        ctx.fill();
      }
    }

    function drawTable(tileX, tileY, color) {
      const p = isoToScreen(tileX, tileY);
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 22, 44, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 6, 42, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(p.x - 5, p.y - 6, 10, 40);
    }

    function drawQueue() {
      const p = isoToScreen(4, 7.2);
      ctx.fillStyle = "rgba(255,188,87,0.08)";
      ctx.fillRect(p.x - 240, p.y - 12, 320, 84);
      Data.queueTiles.forEach((tile, index) => {
        const marker = isoToScreen(tile.x, tile.y);
        ctx.strokeStyle = index === 0 ? "rgba(255,188,87,0.8)" : "rgba(255,255,255,0.16)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(marker.x, marker.y + 14);
        ctx.lineTo(marker.x + 16, marker.y + 22);
        ctx.lineTo(marker.x, marker.y + 30);
        ctx.lineTo(marker.x - 16, marker.y + 22);
        ctx.closePath();
        ctx.stroke();
      });
    }

    function drawStation(station) {
      const p = isoToScreen(station.tile.x, station.tile.y);
      prism(p.x, p.y, TILE_W * 0.92, TILE_H * 0.82, station.height, station.color);
      ctx.fillStyle = shade(station.color, 16);
      ctx.fillRect(p.x - 34, p.y - station.height + 12, 68, 14);
      if (station.type === "cups") {
        ["#f3efe7", "#d1ecf0", "#f2d6a4"].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(p.x - 28 + i * 18, p.y - station.height + 4, 12, 24); });
      } else if (station.type === "grinder") {
        ctx.fillStyle = "#202c34"; ctx.fillRect(p.x - 18, p.y - station.height + 12, 36, 46);
        ctx.fillStyle = "#667c89"; ctx.beginPath(); ctx.moveTo(p.x - 13, p.y - station.height + 12); ctx.lineTo(p.x + 13, p.y - station.height + 12); ctx.lineTo(p.x + 8, p.y - station.height - 18); ctx.lineTo(p.x - 8, p.y - station.height - 18); ctx.closePath(); ctx.fill();
      } else if (station.type === "espresso") {
        ctx.fillStyle = "#d8dee6"; ctx.fillRect(p.x - 34, p.y - station.height + 6, 68, 42);
        ctx.fillStyle = "#1f2020"; ctx.fillRect(p.x - 30, p.y - station.height + 16, 60, 12);
        ctx.fillStyle = "#ffbc57"; ctx.fillRect(p.x - 20, p.y - station.height + 32, 10, 6); ctx.fillRect(p.x - 4, p.y - station.height + 32, 10, 6); ctx.fillRect(p.x + 12, p.y - station.height + 32, 10, 6);
      } else if (station.type === "steam") {
        ctx.fillStyle = "#cad5dd"; ctx.fillRect(p.x - 24, p.y - station.height + 12, 48, 34);
        ctx.strokeStyle = "#d8f6ff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x + 12, p.y - station.height + 12); ctx.lineTo(p.x + 24, p.y - station.height - 28); ctx.stroke();
      } else if (station.type === "water") {
        ctx.fillStyle = "#b8c9d8"; ctx.fillRect(p.x - 14, p.y - station.height + 8, 28, 48);
        ctx.strokeStyle = "#d9f4ff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x - 2, p.y - station.height + 12); ctx.lineTo(p.x + 18, p.y - station.height + 12); ctx.lineTo(p.x + 18, p.y - station.height + 24); ctx.lineTo(p.x + 8, p.y - station.height + 24); ctx.lineTo(p.x + 8, p.y - station.height + 40); ctx.stroke();
      } else if (station.type === "syrup") {
        ["#f29b68", "#f5d98f", "#df7285"].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(p.x - 26 + i * 18, p.y - station.height + 10, 12, 34); });
      } else if (station.type === "topping") {
        ctx.fillStyle = "#eef2f7"; ctx.fillRect(p.x - 24, p.y - station.height + 12, 16, 34); ctx.fillRect(p.x + 8, p.y - station.height + 12, 16, 34);
      } else if (station.type === "counter") {
        ctx.fillStyle = "#f1f4fb"; ctx.fillRect(p.x - 34, p.y - station.height + 10, 68, 16);
        ctx.fillStyle = "#151b21"; ctx.fillRect(p.x - 20, p.y - station.height + 28, 40, 20);
        ctx.fillStyle = "#67d9df"; ctx.fillRect(p.x - 12, p.y - station.height + 34, 24, 6);
      }
      const near = nearbyStation();
      if (near && near.id === station.id) {
        ctx.strokeStyle = "rgba(255,188,87,0.85)"; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(p.x, p.y - station.height - 8); ctx.lineTo(p.x + 38, p.y - station.height + 10); ctx.lineTo(p.x, p.y - station.height + 28); ctx.lineTo(p.x - 38, p.y - station.height + 10); ctx.closePath(); ctx.stroke();
      }
      roundedRect(p.x - 66, p.y - station.height - 36, 132, 24, 10, "rgba(7,16,24,0.88)");
      ctx.fillStyle = "#f1f7fa"; ctx.font = "bold 11px Trebuchet MS"; ctx.fillText(station.label, p.x - 55, p.y - station.height - 19);
    }

    function drawCharacter(point, look, playerMode) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath(); ctx.ellipse(point.x, point.y + 16, 24, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.pants; ctx.fillRect(point.x - 14, point.y - 18, 12, 28); ctx.fillRect(point.x + 2, point.y - 18, 12, 28);
      ctx.fillStyle = look.shirt; ctx.fillRect(point.x - 18, point.y - 52, 36, 34);
      ctx.fillStyle = look.skin; ctx.fillRect(point.x - 21, point.y - 49, 6, 22); ctx.fillRect(point.x + 15, point.y - 49, 6, 22);
      if (playerMode) { ctx.fillStyle = "#f1f4fb"; ctx.fillRect(point.x - 10, point.y - 48, 20, 30); }
      ctx.fillStyle = look.skin; ctx.fillRect(point.x - 17, point.y - 86, 34, 32);
      ctx.fillStyle = "#20160f"; ctx.fillRect(point.x - 17, point.y - 92, 34, 14);
      ctx.fillStyle = playerMode ? "#ff8a3d" : "#20160f"; ctx.fillRect(point.x - 6, point.y - 64, 12, 3);
    }

    function drawSpeechBubble(x, y, a, b) {
      roundedRect(x, y, 132, 48, 14, "rgba(7,15,23,0.92)");
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(x, y, 132, 48);
      ctx.fillStyle = "#edf5f7"; ctx.font = "bold 13px Trebuchet MS"; ctx.fillText(a, x + 12, y + 17);
      ctx.fillStyle = "#9ab1bc"; ctx.font = "12px Trebuchet MS"; ctx.fillText(b, x + 12, y + 34);
    }

    function render() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "rgba(117,202,228,0.12)");
      grad.addColorStop(1, "rgba(8,17,24,0.12)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      drawWalls();
      drawFloor();
      drawTable(0.9, 6.1, "#7b5a47");
      drawTable(6.8, 6.9, "#755641");
      drawQueue();

      const drawables = [];
      Data.stations.forEach((station) => drawables.push({ z: station.tile.x + station.tile.y, type: "station", station }));
      state.customers.forEach((customer, index) => drawables.push({ z: Data.queueTiles[index].x + Data.queueTiles[index].y + 0.2, type: "customer", customer, tile: Data.queueTiles[index] }));
      drawables.push({ z: player.x + player.y + 0.25, type: "player" });
      drawables.sort((a, b) => a.z - b.z);

      drawables.forEach((item) => {
        if (item.type === "station") drawStation(item.station);
        if (item.type === "player") {
          const p = isoToScreen(player.x, player.y);
          drawCharacter({ x: p.x, y: p.y }, { skin: "#d5a07e", shirt: "#ffbc57", pants: "#24384b" }, true);
          if (state.activeCup) {
            ctx.fillStyle = "#f8efe5"; ctx.fillRect(p.x + 10, p.y - 56, 14, 14);
            ctx.fillStyle = "#5d392b"; ctx.fillRect(p.x + 11, p.y - 48, 12, 3);
          }
        }
        if (item.type === "customer") {
          const p = isoToScreen(item.tile.x, item.tile.y);
          drawCharacter({ x: p.x, y: p.y }, item.customer.look, false);
          const recipe = Data.recipes.find((entry) => entry.key === item.customer.recipeKey);
          drawSpeechBubble(p.x + 22, p.y - 108, item.customer.name, recipe.boardLabel);
        }
      });

      if (player.task) {
        const p = isoToScreen(player.x, player.y);
        const progress = player.taskTime / player.taskDuration;
        ctx.strokeStyle = "rgba(255,188,87,0.9)";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 84, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        ctx.stroke();
      }
      state.particles.forEach((particle) => {
        ctx.globalAlpha = Math.max(0, particle.life); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      });
      state.floatingText.forEach((item) => {
        ctx.globalAlpha = Math.min(1, item.life); ctx.fillStyle = item.color; ctx.font = "bold 22px Gill Sans"; ctx.fillText(item.text, item.x, item.y); ctx.globalAlpha = 1;
      });
    }

    function update(dt) {
      state.uiTick -= dt;
      if (state.started && !state.paused && !state.gameOver) {
        state.shiftRemaining -= dt;
        state.spawnCooldown -= dt;
        if (state.spawnCooldown <= 0 && state.customers.length < 4) {
          state.customers.push(customerFactory());
          state.spawnCooldown = Math.max(1.6, 4 - Math.min(state.customersServed * 0.1, 1.9) + Math.random() * 1.5);
          sfx("arrive");
        }
        state.customers.forEach((customer, index) => { customer.patience -= dt * (index === 0 ? 3.5 : 2.4); });
        while (state.customers[0] && state.customers[0].patience <= 0) {
          const unhappy = state.customers.shift();
          state.combo = 1;
          state.reputation = Math.max(0, state.reputation - 10);
          sfx("leave");
          speak(`${unhappy.name} left`, "#ff687b");
        }
        if (state.shiftRemaining <= 0 || state.reputation <= 0) {
          state.shiftRemaining = Math.max(0, state.shiftRemaining);
          state.started = false;
          state.paused = false;
          state.gameOver = true;
          speak(state.reputation <= 0 ? "The cafe lost confidence" : "Shift complete", "#ffbc57");
          notify(true);
        }
      }

      if (state.view === "game" && !state.paused && !player.task) {
        if (player.x === player.targetX && player.y === player.targetY) {
          if (state.keys.has("ArrowUp") || state.keys.has("w")) setTarget(player.x, player.y - 1);
          else if (state.keys.has("ArrowDown") || state.keys.has("s")) setTarget(player.x, player.y + 1);
          else if (state.keys.has("ArrowLeft") || state.keys.has("a")) setTarget(player.x - 1, player.y);
          else if (state.keys.has("ArrowRight") || state.keys.has("d")) setTarget(player.x + 1, player.y);
        }
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001) {
          const step = Math.min(dist, player.speed * dt);
          player.x += (dx / dist) * step;
          player.y += (dy / dist) * step;
        } else {
          player.x = player.targetX;
          player.y = player.targetY;
        }
      }

      if (player.task) {
        player.taskTime += dt;
        if (player.taskTime >= player.taskDuration) finishTask(player.task);
      }

      state.particles = state.particles.filter((particle) => {
        particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 100 * dt; return particle.life > 0;
      });
      state.floatingText = state.floatingText.filter((item) => {
        item.life -= dt; item.y -= 24 * dt; return item.life > 0;
      });
      notify(false);
    }

    function loop(now) {
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      update(dt);
      render();
      requestAnimationFrame(loop);
    }

    function canvasClick(event) {
      if (state.view !== "game" || state.paused) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const station = Data.stations.find((entry) => {
        const p = isoToScreen(entry.tile.x, entry.tile.y);
        return Math.abs(p.x - x) < 62 && Math.abs(p.y - y) < 76;
      });
      if (station) {
        setTarget(station.useTile.x, station.useTile.y);
        return;
      }
      const tile = screenToTile(x, y);
      if (canMoveTo(tile.x, tile.y)) setTarget(tile.x, tile.y);
    }

    function keyDown(event) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (audio && audio.context.state === "suspended") audio.context.resume();
      if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        state.keys.add(key);
        event.preventDefault();
      }
      if (["1", "2", "3"].includes(key)) {
        const action = snapshot().availableActions[Number(key) - 1];
        if (action) doAction(action);
      }
      if (key === " ") {
        const action = snapshot().availableActions[0];
        if (action) doAction(action);
        event.preventDefault();
      }
    }

    function keyUp(event) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      state.keys.delete(key);
    }

    canvas.addEventListener("click", canvasClick);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", () => { if (audio && audio.context.state === "suspended") audio.context.resume(); });

    resize();
    notify(true);
    requestAnimationFrame(loop);

    return {
      startShift,
      stopShift,
      toggleSound,
      trashCup,
      setView,
      doAction,
      getSnapshot: snapshot,
      formatEuro,
      getLivePrice,
      getDateParts,
      debugSetPlayer,
      debugInjectCustomer,
      debugClearCustomers
    };
  }

  global.VelvetPourGame = { createGame, formatEuro, getLivePrice, getDateParts };
}(window));
