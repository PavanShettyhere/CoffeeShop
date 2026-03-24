(function (global) {
  const Data = global.VelvetPourData;
  const TILE_W = 96;
  const TILE_H = 48;
  const GRID_W = 10;
  const GRID_H = 10;
  const TABLE_TILES = [
    { x: 0.9, y: 6.1 },
    { x: 6.8, y: 6.9 },
    { x: 2.2, y: 5.2 },
    { x: 7.7, y: 4.4 }
  ];

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

  function cloneProfile(profile) {
    return {
      gender: profile.gender,
      skin: profile.skin,
      shirt: profile.shirt,
      pants: profile.pants,
      hair: profile.hair,
      apron: profile.apron,
      cap: profile.cap,
      lowerWear: profile.lowerWear || "tapered",
      eyeColor: profile.eyeColor || "#4f3421",
      hairStyle: profile.hairStyle || "short",
      accessory: profile.accessory || "none"
    };
  }

  function cloneRestaurantProfile(profile) {
    return {
      wallTheme: profile.wallTheme,
      floorTheme: profile.floorTheme,
      tableCount: profile.tableCount,
      tableStyle: profile.tableStyle,
      machineFinish: profile.machineFinish,
      counterStyle: profile.counterStyle
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
      reactions: [],
      particles: [],
      floatingText: [],
      keys: new Set(),
      uiTick: 0,
      soundEnabled: true,
      musicEnabled: true,
      renderClock: 0,
      playerProfile: cloneProfile(Data.avatarOptions.defaultProfile),
      restaurantProfile: cloneRestaurantProfile(Data.restaurantOptions.defaultProfile)
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

    function roundedRect(x, y, w, h, r, fill, drawCtx) {
      const targetCtx = drawCtx || ctx;
      targetCtx.fillStyle = fill;
      targetCtx.beginPath();
      targetCtx.moveTo(x + r, y);
      targetCtx.lineTo(x + w - r, y);
      targetCtx.quadraticCurveTo(x + w, y, x + w, y + r);
      targetCtx.lineTo(x + w, y + h - r);
      targetCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      targetCtx.lineTo(x + r, y + h);
      targetCtx.quadraticCurveTo(x, y + h, x, y + h - r);
      targetCtx.lineTo(x, y + r);
      targetCtx.quadraticCurveTo(x, y, x + r, y);
      targetCtx.closePath();
      targetCtx.fill();
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
        musicEnabled: state.musicEnabled,
        playerProfile: cloneProfile(state.playerProfile),
        restaurantProfile: cloneRestaurantProfile(state.restaurantProfile),
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
        gender: customer.look.gender,
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
      const patienceScale = Math.max(1.04, 1.34 - state.customersServed * 0.015);
      const patienceBuffer = Math.max(8, 20 - state.customersServed * 0.45);
      return {
        id: `customer-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        recipeKey: recipe.key,
        offerPrice: getLivePrice(recipe, Date.now()),
        patience: recipe.patience * patienceScale + patienceBuffer,
        patienceMax: recipe.patience * patienceScale + patienceBuffer,
        name,
        look
      };
    }

    function reactionText(customer, mood) {
      const isWoman = customer.look && customer.look.gender === "woman";
      if (mood === "happy") return isWoman ? "She's happy!" : "He's happy!";
      return isWoman ? "She's angry!" : "He's angry!";
    }

    function pushReaction(customer, tile, mood) {
      const point = isoToScreen(tile.x, tile.y);
      state.reactions.push({
        x: point.x + 18,
        y: point.y - 128,
        mood,
        text: reactionText(customer, mood),
        life: 2.2
      });
    }

    function paceFactor() {
      return Math.min(1.08, 0.54 + state.customersServed * 0.042);
    }

    function nextSpawnCooldown() {
      return Math.max(2.35, 5.2 - Math.min(state.customersServed * 0.11, 2.1) + Math.random() * 1.25);
    }

    function initAudio() {
      if (audio) {
        audio.soundEnabled = true;
        audio.musicEnabled = true;
        state.soundEnabled = true;
        state.musicEnabled = true;
        if (audio.context.state === "suspended") audio.context.resume();
        return;
      }
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      const sfxGain = context.createGain();
      sfxGain.gain.value = 0.8;
      sfxGain.connect(master);
      const musicGain = context.createGain();
      musicGain.gain.value = 0.7;
      musicGain.connect(master);
      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 1900;
      lowpass.Q.value = 0.6;
      lowpass.connect(musicGain);

      function playSoftPad(now, notes) {
        const chordGain = context.createGain();
        chordGain.gain.setValueAtTime(0.0001, now);
        chordGain.gain.exponentialRampToValueAtTime(0.06, now + 0.4);
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

        const bass = context.createOscillator();
        const bassGain = context.createGain();
        bass.type = "sine";
        bass.frequency.setValueAtTime(notes[0] / 2, now);
        bassGain.gain.setValueAtTime(0.0001, now);
        bassGain.gain.exponentialRampToValueAtTime(0.028, now + 0.2);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
        bass.connect(bassGain);
        bassGain.connect(lowpass);
        bass.start(now);
        bass.stop(now + 2.9);
      }

      const padChords = [
        [196, 246.94, 293.66],
        [174.61, 220, 261.63],
        [164.81, 220, 246.94],
        [196, 233.08, 293.66]
      ];
      let padIndex = 0;
      const ambienceTimer = window.setInterval(() => {
        if (!audio || !audio.musicEnabled || !state.started) return;
        padIndex = (padIndex + 1) % padChords.length;
        playSoftPad(context.currentTime, padChords[padIndex]);
      }, 3200);
      audio = {
        context,
        master,
        sfxGain,
        musicGain,
        lowpass,
        ambienceTimer,
        soundEnabled: true,
        musicEnabled: true,
        padChords,
        get padIndex() { return padIndex; },
        set padIndex(v) { padIndex = v; },
        playSoftPad
      };
      state.soundEnabled = true;
      state.musicEnabled = true;
    }

    function sfx(kind) {
      if (!audio || !audio.soundEnabled) return;
      const now = audio.context.currentTime;
      const gain = audio.context.createGain();
      gain.connect(audio.sfxGain);
      if (kind === "grind") {
        const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 0.42, audio.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.28;
        const noise = audio.context.createBufferSource();
        const filter = audio.context.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 280;
        filter.Q.value = 0.8;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.38, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        noise.buffer = buffer;
        noise.connect(filter).connect(gain);
        noise.start(now);
        noise.stop(now + 0.4);
        return;
      }
      if (kind === "steam") {
        const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 0.35, audio.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.22;
        const noise = audio.context.createBufferSource();
        const filter = audio.context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 520;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.34, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
        noise.buffer = buffer;
        noise.connect(filter).connect(gain);
        noise.start(now);
        noise.stop(now + 0.34);
        return;
      }
      if (kind === "water") {
        const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 0.28, audio.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.12;
        const noise = audio.context.createBufferSource();
        const filter = audio.context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 1200;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
        noise.buffer = buffer;
        noise.connect(filter).connect(gain);
        noise.start(now);
        noise.stop(now + 0.28);
        return;
      }
      if (kind === "syrup") {
        const osc = audio.context.createOscillator();
        osc.type = "sine";
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(gain);
        osc.frequency.setValueAtTime(460, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
        return;
      }
      if (kind === "foam") {
        const osc = audio.context.createOscillator();
        osc.type = "triangle";
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.24, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.connect(gain);
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.16);
        osc.start(now);
        osc.stop(now + 0.18);
        return;
      }
      if (kind === "whip") {
        const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 0.24, audio.context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.18;
        const noise = audio.context.createBufferSource();
        const filter = audio.context.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 860;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.26, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        noise.buffer = buffer;
        noise.connect(filter).connect(gain);
        noise.start(now);
        noise.stop(now + 0.24);
        return;
      }
      if (kind === "espresso") {
        const pulse = audio.context.createOscillator();
        const tail = audio.context.createOscillator();
        pulse.type = "square";
        tail.type = "triangle";
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        pulse.connect(gain);
        tail.connect(gain);
        pulse.frequency.setValueAtTime(180, now);
        pulse.frequency.exponentialRampToValueAtTime(140, now + 0.18);
        tail.frequency.setValueAtTime(420, now + 0.04);
        tail.frequency.exponentialRampToValueAtTime(240, now + 0.26);
        pulse.start(now);
        tail.start(now + 0.03);
        pulse.stop(now + 0.22);
        tail.stop(now + 0.28);
        return;
      }
      const osc = audio.context.createOscillator();
      osc.type = { serve: "triangle", arrive: "sine", error: "sawtooth", leave: "square", trash: "square", cup: "triangle", start: "triangle", stop: "triangle", happy: "sine", angry: "square" }[kind] || "square";
      const cfg = {
        brew: { f: 180, e: 120, d: 0.2, v: 0.14 },
        cup: { f: 760, e: 980, d: 0.16, v: 0.26 },
        serve: { f: 720, e: 1080, d: 0.28, v: 0.16 },
        arrive: { f: 420, e: 520, d: 0.2, v: 0.1 },
        error: { f: 220, e: 180, d: 0.22, v: 0.12 },
        leave: { f: 180, e: 140, d: 0.18, v: 0.09 },
        trash: { f: 120, e: 90, d: 0.15, v: 0.09 },
        start: { f: 440, e: 660, d: 0.22, v: 0.15 },
        stop: { f: 420, e: 220, d: 0.28, v: 0.12 },
        happy: { f: 620, e: 980, d: 0.24, v: 0.12 },
        angry: { f: 210, e: 150, d: 0.24, v: 0.11 }
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
      if (actionKey.indexOf("cup_") === 0) sfx("cup");
      else if (actionKey === "grind") sfx("grind");
      else if (actionKey === "espresso" || actionKey === "ristretto") sfx("espresso");
      else if (actionKey === "hot_water") sfx("water");
      else if (actionKey === "mocha_sauce") sfx("syrup");
      else if (actionKey === "whip") sfx("whip");
      else if (actionKey === "foam_cap" || actionKey === "microfoam") sfx("foam");
      else if (actionKey === "steam_milk") sfx("steam");
      speak(Data.actionMeta[actionKey].label, "#c8f6ff");
      notify(true);
    }

    function finishTask(actionKey) {
      if (actionKey.indexOf("cup_") === 0) {
        state.activeCup = { steps: [actionKey] };
      } else if (state.activeCup) {
        state.activeCup.steps.push(actionKey);
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
        pushReaction(customer, Data.queueTiles[0], "happy");
        state.score += reward * 10;
        state.coins += reward;
        state.combo = Math.min(state.combo + 0.25, 4);
        state.reputation = Math.min(100, state.reputation + 2);
        state.customersServed += 1;
        state.customers.shift();
        state.activeCup = null;
        sfx("serve");
        sfx("happy");
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
      state.spawnCooldown = 2.6;
      state.activeCup = null;
      state.customers = [];
      state.reactions = [];
      state.particles = [];
      state.floatingText = [];
      player.x = 4;
      player.y = 5;
      player.targetX = 4;
      player.targetY = 5;
      player.task = null;
      if (audio && audio.musicEnabled) {
        audio.playSoftPad(audio.context.currentTime, audio.padChords[audio.padIndex]);
      }
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
      state.reactions = [];
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
      if (!audio) {
        initAudio();
        audio.soundEnabled = false;
        state.soundEnabled = false;
      } else {
        audio.soundEnabled = !audio.soundEnabled;
        state.soundEnabled = audio.soundEnabled;
        if ((audio.soundEnabled || audio.musicEnabled) && audio.context.state === "suspended") audio.context.resume();
      }
      if (state.soundEnabled) sfx("start");
      notify(true);
    }

    function toggleMusic() {
      if (!audio) {
        initAudio();
        audio.musicEnabled = false;
        state.musicEnabled = false;
      } else {
        audio.musicEnabled = !audio.musicEnabled;
        state.musicEnabled = audio.musicEnabled;
        if ((audio.soundEnabled || audio.musicEnabled) && audio.context.state === "suspended") audio.context.resume();
      }
      if (state.musicEnabled && state.started && audio) {
        audio.playSoftPad(audio.context.currentTime, audio.padChords[audio.padIndex]);
      }
      notify(true);
    }

    function setPlayerProfile(profile) {
      state.playerProfile = cloneProfile(profile);
      notify(true);
    }

    function getPlayerProfile() {
      return cloneProfile(state.playerProfile);
    }

    function setRestaurantProfile(profile) {
      state.restaurantProfile = cloneRestaurantProfile(profile);
      notify(true);
    }

    function getRestaurantProfile() {
      return cloneRestaurantProfile(state.restaurantProfile);
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

    function getWallTheme() {
      return Data.restaurantOptions.wallThemeMap[state.restaurantProfile.wallTheme] || Data.restaurantOptions.wallThemeMap.midnight;
    }

    function getFloorTheme() {
      return Data.restaurantOptions.floorThemeMap[state.restaurantProfile.floorTheme] || Data.restaurantOptions.floorThemeMap.blueprint;
    }

    function getTableColor() {
      return Data.restaurantOptions.tableStyleMap[state.restaurantProfile.tableStyle] || Data.restaurantOptions.tableStyleMap.walnut;
    }

    function getCounterStyle() {
      return Data.restaurantOptions.counterStyleMap[state.restaurantProfile.counterStyle] || Data.restaurantOptions.counterStyleMap.oak;
    }

    function getMachineTheme() {
      return Data.restaurantOptions.machineFinishMap[state.restaurantProfile.machineFinish] || Data.restaurantOptions.machineFinishMap.classic;
    }

    function getTableTiles() {
      const count = clamp(Number(state.restaurantProfile.tableCount) || 2, 1, TABLE_TILES.length);
      return TABLE_TILES.slice(0, count);
    }

    function getStationSkin(station) {
      const theme = getMachineTheme();
      const skin = theme[station.type] || {};
      return {
        color: skin.color || shade(station.color, theme.default.shift || 0),
        accent: skin.accent || shade(station.accent, theme.default.accentShift || 0),
        height: station.height
      };
    }

    function drawFloor() {
      const floorTheme = getFloorTheme();
      for (let y = 0; y < GRID_H; y += 1) {
        for (let x = 0; x < GRID_W; x += 1) {
          const p = isoToScreen(x, y);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
          ctx.lineTo(p.x, p.y + TILE_H);
          ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
          ctx.closePath();
          ctx.fillStyle = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1
            ? floorTheme.edge
            : ((x + y) % 2 === 0 ? floorTheme.even : floorTheme.odd);
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.stroke();
        }
      }
    }

    function drawWalls() {
      const wallTheme = getWallTheme();
      for (let i = 0; i < GRID_W - 1; i += 1) {
        const p = isoToScreen(i, 0);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
        ctx.lineTo(p.x + TILE_W / 2, p.y - 94);
        ctx.lineTo(p.x, p.y - 118);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? wallTheme.top : shade(wallTheme.top, 8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
        ctx.lineTo(p.x - TILE_W / 2, p.y - 72);
        ctx.lineTo(p.x, p.y - 118);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? wallTheme.left : wallTheme.right;
        ctx.fill();
        ctx.fillStyle = wallTheme.trim;
        ctx.fillRect(p.x - TILE_W / 2, p.y - 76, TILE_W, 5);
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
      const counterStyle = getCounterStyle();
      ctx.fillStyle = `${counterStyle.accent}22`;
      ctx.fillRect(p.x - 240, p.y - 12, 320, 84);
      Data.queueTiles.forEach((tile, index) => {
        const marker = isoToScreen(tile.x, tile.y);
        ctx.strokeStyle = index === 0 ? counterStyle.accent : "rgba(255,255,255,0.16)";
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
      const skin = getStationSkin(station);
      const counterStyle = getCounterStyle();
      prism(p.x, p.y, TILE_W * 0.92, TILE_H * 0.82, skin.height, station.type === "counter" ? counterStyle.color : skin.color);
      ctx.fillStyle = shade(station.type === "counter" ? counterStyle.color : skin.color, 16);
      ctx.fillRect(p.x - 34, p.y - skin.height + 12, 68, 14);
      if (station.type === "cups") {
        ["#f3efe7", "#d1ecf0", "#f2d6a4"].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(p.x - 28 + i * 18, p.y - skin.height + 4, 12, 24); });
      } else if (station.type === "grinder") {
        ctx.fillStyle = "#202c34"; ctx.fillRect(p.x - 18, p.y - skin.height + 12, 36, 46);
        ctx.fillStyle = shade(skin.accent, -40); ctx.beginPath(); ctx.moveTo(p.x - 13, p.y - skin.height + 12); ctx.lineTo(p.x + 13, p.y - skin.height + 12); ctx.lineTo(p.x + 8, p.y - skin.height - 18); ctx.lineTo(p.x - 8, p.y - skin.height - 18); ctx.closePath(); ctx.fill();
      } else if (station.type === "espresso") {
        ctx.fillStyle = "#d8dee6"; ctx.fillRect(p.x - 34, p.y - skin.height + 6, 68, 42);
        ctx.fillStyle = "#1f2020"; ctx.fillRect(p.x - 30, p.y - skin.height + 16, 60, 12);
        ctx.fillStyle = skin.accent; ctx.fillRect(p.x - 20, p.y - skin.height + 32, 10, 6); ctx.fillRect(p.x - 4, p.y - skin.height + 32, 10, 6); ctx.fillRect(p.x + 12, p.y - skin.height + 32, 10, 6);
      } else if (station.type === "steam") {
        ctx.fillStyle = "#cad5dd"; ctx.fillRect(p.x - 24, p.y - skin.height + 12, 48, 34);
        ctx.strokeStyle = skin.accent; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x + 12, p.y - skin.height + 12); ctx.lineTo(p.x + 24, p.y - skin.height - 28); ctx.stroke();
      } else if (station.type === "water") {
        ctx.fillStyle = "#b8c9d8"; ctx.fillRect(p.x - 14, p.y - skin.height + 8, 28, 48);
        ctx.strokeStyle = skin.accent; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x - 2, p.y - skin.height + 12); ctx.lineTo(p.x + 18, p.y - skin.height + 12); ctx.lineTo(p.x + 18, p.y - skin.height + 24); ctx.lineTo(p.x + 8, p.y - skin.height + 24); ctx.lineTo(p.x + 8, p.y - skin.height + 40); ctx.stroke();
      } else if (station.type === "syrup") {
        [shade(skin.accent, -10), "#f5d98f", shade(skin.color, 24)].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(p.x - 26 + i * 18, p.y - skin.height + 10, 12, 34); });
      } else if (station.type === "topping") {
        ctx.fillStyle = "#eef2f7"; ctx.fillRect(p.x - 24, p.y - skin.height + 12, 16, 34); ctx.fillRect(p.x + 8, p.y - skin.height + 12, 16, 34);
      } else if (station.type === "counter") {
        ctx.fillStyle = "#f1f4fb"; ctx.fillRect(p.x - 34, p.y - skin.height + 10, 68, 16);
        ctx.fillStyle = "#151b21"; ctx.fillRect(p.x - 20, p.y - skin.height + 28, 40, 20);
        ctx.fillStyle = counterStyle.accent; ctx.fillRect(p.x - 12, p.y - skin.height + 34, 24, 6);
      }
      const near = nearbyStation();
      if (near && near.id === station.id) {
        ctx.strokeStyle = "rgba(255,188,87,0.85)"; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(p.x, p.y - skin.height - 8); ctx.lineTo(p.x + 38, p.y - skin.height + 10); ctx.lineTo(p.x, p.y - skin.height + 28); ctx.lineTo(p.x - 38, p.y - skin.height + 10); ctx.closePath(); ctx.stroke();
      }
      roundedRect(p.x - 66, p.y - skin.height - 36, 132, 24, 10, "rgba(7,16,24,0.88)");
      ctx.fillStyle = "#f1f7fa"; ctx.font = "bold 11px Trebuchet MS"; ctx.fillText(station.label, p.x - 55, p.y - skin.height - 19);
    }

    function drawCharacter(point, look, playerMode, phase, drawCtx) {
      const targetCtx = drawCtx || ctx;
      const bob = Math.sin(state.renderClock * 2.2 + phase) * 2.2;
      const x = point.x;
      const y = point.y + bob;
      const isWoman = look.gender === "woman";
      const isMan = look.gender === "man";
      const shirt = look.shirt;
      const apron = look.apron || shade(look.shirt, 34);
      const hair = look.hair || "#2c1b12";
      const skin = look.skin;
      const headR = isWoman ? 16 : 17;
      const armInset = isMan ? 25 : 23;
      const shoulderW = isMan ? 24 : (isWoman ? 18 : 21);
      const waistW = isMan ? 18 : (isWoman ? 13 : 16);
      const hipW = isWoman ? 22 : (isMan ? 17 : 19);

      targetCtx.fillStyle = "rgba(0,0,0,0.18)";
      targetCtx.beginPath();
      targetCtx.ellipse(x, y + 18, 24, 9, 0, 0, Math.PI * 2);
      targetCtx.fill();

      if (look.lowerWear === "skirt" || look.lowerWear === "pleated") {
        targetCtx.fillStyle = look.pants;
        targetCtx.beginPath();
        targetCtx.moveTo(x - 18, y - 18);
        targetCtx.lineTo(x + 18, y - 18);
        targetCtx.lineTo(x + 28, y + 14);
        targetCtx.lineTo(x - 28, y + 14);
        targetCtx.closePath();
        targetCtx.fill();
        if (look.lowerWear === "pleated") {
          targetCtx.strokeStyle = shade(look.pants, 22);
          targetCtx.lineWidth = 2;
          for (let i = -16; i <= 16; i += 8) {
            targetCtx.beginPath();
            targetCtx.moveTo(x + i, y - 12);
            targetCtx.lineTo(x + i + 3, y + 12);
            targetCtx.stroke();
          }
        }
        targetCtx.fillStyle = shade(look.pants, -22);
        targetCtx.fillRect(x - 12, y + 6, 8, 20);
        targetCtx.fillRect(x + 4, y + 6, 8, 20);
        targetCtx.fillStyle = "#171a1f";
        targetCtx.fillRect(x - 13, y + 23, 10, 4);
        targetCtx.fillRect(x + 3, y + 23, 10, 4);
      } else if (look.lowerWear === "wide" || look.lowerWear === "culottes") {
        targetCtx.fillStyle = shade(look.pants, -8);
        targetCtx.fillRect(x - 18, y - 16, 14, 34);
        targetCtx.fillRect(x + 4, y - 16, 14, 34);
        targetCtx.fillStyle = "#171a1f";
        targetCtx.fillRect(x - 19, y + 15, 16, 4);
        targetCtx.fillRect(x + 3, y + 15, 16, 4);
      } else if (look.lowerWear === "joggers" || look.lowerWear === "apron_pants") {
        targetCtx.fillStyle = shade(look.pants, -18);
        roundedRect(x - 16, y - 16, 12, 32, 6, shade(look.pants, -18), targetCtx);
        roundedRect(x + 4, y - 16, 12, 32, 6, shade(look.pants, -18), targetCtx);
        targetCtx.fillStyle = shade(look.pants, 16);
        targetCtx.fillRect(x - 16, y - 18, 12, 4);
        targetCtx.fillRect(x + 4, y - 18, 12, 4);
        targetCtx.fillStyle = "#171a1f";
        targetCtx.fillRect(x - 17, y + 13, 14, 4);
        targetCtx.fillRect(x + 3, y + 13, 14, 4);
      } else {
        targetCtx.fillStyle = shade(look.pants, -22);
        targetCtx.fillRect(x - 14, y - 14, 10, 30);
        targetCtx.fillRect(x + 4, y - 14, 10, 30);
        targetCtx.fillStyle = "#171a1f";
        targetCtx.fillRect(x - 15, y + 13, 12, 4);
        targetCtx.fillRect(x + 3, y + 13, 12, 4);
      }

      targetCtx.fillStyle = shirt;
      targetCtx.beginPath();
      targetCtx.moveTo(x - shoulderW, y - 50);
      targetCtx.lineTo(x + shoulderW, y - 50);
      targetCtx.lineTo(x + waistW, y - 26);
      targetCtx.lineTo(x + hipW, y - 16);
      targetCtx.lineTo(x - hipW, y - 16);
      targetCtx.lineTo(x - waistW, y - 26);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.fillStyle = skin;
      roundedRect(x - armInset, y - 48, 6, 19, 3, skin, targetCtx);
      roundedRect(x + armInset - 6, y - 48, 6, 19, 3, skin, targetCtx);

      targetCtx.fillStyle = apron;
      roundedRect(x - 11, y - 48, 22, 28, 6, apron, targetCtx);
      targetCtx.fillStyle = playerMode ? "#ffb24a" : (look.accent || "#eef4fa");
      targetCtx.fillRect(x - 8, y - 44, 16, 4);

      drawHairStyle(look, x, y, headR, hair, "back", targetCtx);
      targetCtx.fillStyle = skin;
      targetCtx.beginPath();
      targetCtx.arc(x, y - 72, headR, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.beginPath();
      targetCtx.ellipse(x, y - 69, headR - 3, headR - 5, 0, 0, Math.PI * 2);
      targetCtx.fill();

      drawHairStyle(look, x, y, headR, hair, "front", targetCtx);

      if (look.cap === "barista") {
        roundedRect(x - 16, y - 88, 32, 12, 5, playerMode ? "#f0a24d" : shade(shirt, 12), targetCtx);
        targetCtx.fillRect(x - 1, y - 78, 20, 3);
      } else if (look.cap === "visor") {
        roundedRect(x - 15, y - 84, 30, 7, 5, playerMode ? "#f0a24d" : shade(shirt, 12), targetCtx);
        targetCtx.beginPath();
        targetCtx.moveTo(x + 4, y - 78);
        targetCtx.lineTo(x + 18, y - 75);
        targetCtx.lineTo(x + 4, y - 72);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.cap === "beanie") {
        roundedRect(x - 15, y - 88, 30, 15, 8, shade(hair, 16), targetCtx);
      } else if (look.cap === "beret") {
        targetCtx.beginPath();
        targetCtx.ellipse(x - 4, y - 82, 18, 8, -0.2, 0, Math.PI * 2);
        targetCtx.fillStyle = playerMode ? "#f0a24d" : shade(shirt, 20);
        targetCtx.fill();
      } else if (look.cap === "snapback") {
        roundedRect(x - 16, y - 88, 32, 12, 6, playerMode ? "#f0a24d" : shade(shirt, 16), targetCtx);
        targetCtx.fillRect(x + 6, y - 78, 14, 3);
      } else if (look.cap === "headwrap") {
        roundedRect(x - 16, y - 90, 32, 16, 9, playerMode ? "#f0a24d" : shade(shirt, 14), targetCtx);
        targetCtx.fillStyle = playerMode ? "#f7c27b" : shade(shirt, 28);
        targetCtx.fillRect(x - 2, y - 89, 4, 14);
      }

      drawAccessory(look, x, y, headR, targetCtx);

      targetCtx.fillStyle = look.eyeColor || "#1d1714";
      targetCtx.fillRect(x - 8, y - 72, 5, 3);
      targetCtx.fillRect(x + 3, y - 72, 5, 3);
      targetCtx.fillStyle = "#ffffff";
      targetCtx.fillRect(x - 7, y - 72, 1, 1);
      targetCtx.fillRect(x + 4, y - 72, 1, 1);
      if (isWoman) {
        targetCtx.strokeStyle = "#1d1714";
        targetCtx.lineWidth = 1.5;
        targetCtx.beginPath();
        targetCtx.moveTo(x - 10, y - 75);
        targetCtx.lineTo(x - 2, y - 74);
        targetCtx.moveTo(x + 2, y - 74);
        targetCtx.lineTo(x + 10, y - 75);
        targetCtx.stroke();
      }
      targetCtx.fillStyle = "#d27473";
      targetCtx.fillRect(x - 5, y - 64, 10, 2);
    }

    function drawHairStyle(look, x, y, headR, hair, layer, drawCtx) {
      const targetCtx = drawCtx || ctx;
      targetCtx.fillStyle = hair;
      if (look.hairStyle === "bob") {
        if (layer === "back") {
          roundedRect(x - headR - 3, y - 86, (headR + 3) * 2, 24, 8, hair, targetCtx);
          return;
        }
        targetCtx.beginPath();
        targetCtx.arc(x, y - 77, headR + 1, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR - 4, y - 76);
        targetCtx.lineTo(x - headR + 4, y - 76);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.hairStyle === "ponytail") {
        if (layer === "back") {
          roundedRect(x - headR - 2, y - 86, (headR + 2) * 2, 20, 8, hair, targetCtx);
          targetCtx.fillRect(x + 10, y - 76, 6, 24);
          return;
        }
        targetCtx.beginPath();
        targetCtx.arc(x, y - 77, headR + 1, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR - 4, y - 76);
        targetCtx.lineTo(x - headR + 4, y - 76);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.hairStyle === "bun") {
        if (layer === "back") {
          roundedRect(x - headR - 2, y - 84, (headR + 2) * 2, 18, 8, hair, targetCtx);
          targetCtx.beginPath();
          targetCtx.arc(x + 1, y - 89, 6, 0, Math.PI * 2);
          targetCtx.fill();
          return;
        }
        targetCtx.beginPath();
        targetCtx.arc(x, y - 77, headR + 1, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR - 4, y - 76);
        targetCtx.lineTo(x - headR + 4, y - 76);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.hairStyle === "braid") {
        if (layer === "back") {
          roundedRect(x - headR - 2, y - 84, (headR + 2) * 2, 18, 8, hair, targetCtx);
          targetCtx.fillRect(x + 10, y - 74, 4, 24);
          return;
        }
        targetCtx.beginPath();
        targetCtx.arc(x, y - 77, headR + 1, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR - 4, y - 76);
        targetCtx.lineTo(x - headR + 4, y - 76);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.hairStyle === "long") {
        if (layer === "back") {
          roundedRect(x - headR - 4, y - 86, (headR + 4) * 2, 40, 10, hair, targetCtx);
          return;
        }
        targetCtx.beginPath();
        targetCtx.arc(x, y - 77, headR + 1, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR - 4, y - 77);
        targetCtx.lineTo(x - headR + 4, y - 77);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.hairStyle === "fade") {
        if (layer === "back") return;
        targetCtx.beginPath();
        targetCtx.arc(x, y - 80, headR - 4, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR - 4, y - 74);
        targetCtx.lineTo(x - headR + 4, y - 74);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.hairStyle === "quiff") {
        if (layer === "back") return;
        targetCtx.beginPath();
        targetCtx.ellipse(x, y - 79, headR + 1, 10, -0.2, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR, y - 70);
        targetCtx.lineTo(x - headR + 4, y - 67);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.hairStyle === "curly") {
        if (layer === "back") {
          for (let i = -1; i <= 1; i += 1) {
            targetCtx.beginPath();
            targetCtx.arc(x + i * 9, y - 80 + Math.abs(i), 7, 0, Math.PI * 2);
            targetCtx.fill();
          }
          return;
        }
        for (let i = -1; i <= 1; i += 1) {
          targetCtx.beginPath();
          targetCtx.arc(x + i * 7, y - 80, 5, 0, Math.PI * 2);
          targetCtx.fill();
        }
      } else if (look.hairStyle === "slick") {
        if (layer === "back") return;
        targetCtx.beginPath();
        targetCtx.ellipse(x, y - 79, headR + 2, 8, -0.24, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR, y - 71);
        targetCtx.lineTo(x - headR + 3, y - 74);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.hairStyle === "wave") {
        if (layer === "back") {
          roundedRect(x - headR - 3, y - 86, (headR + 3) * 2, 26, 9, hair, targetCtx);
          return;
        }
        targetCtx.beginPath();
        targetCtx.arc(x, y - 77, headR + 1, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR - 4, y - 76);
        targetCtx.lineTo(x - headR + 4, y - 76);
        targetCtx.closePath();
        targetCtx.fill();
      } else {
        if (layer === "back") return;
        targetCtx.beginPath();
        targetCtx.arc(x, y - 77, headR + 1, Math.PI, Math.PI * 2);
        targetCtx.lineTo(x + headR + 1, y - 70);
        targetCtx.lineTo(x - headR - 1, y - 70);
        targetCtx.closePath();
        targetCtx.fill();
      }
    }

    function drawAccessory(look, x, y, headR, drawCtx) {
      const targetCtx = drawCtx || ctx;
      if (look.accessory === "flower") {
        ["#f7d85a", "#f08fb1", "#f7d85a", "#f08fb1"].forEach((color, index) => {
          const angle = (Math.PI / 2) * index;
          targetCtx.fillStyle = color;
          targetCtx.beginPath();
          targetCtx.arc(x + headR - 1 + Math.cos(angle) * 4, y - 83 + Math.sin(angle) * 4, 4, 0, Math.PI * 2);
          targetCtx.fill();
        });
        targetCtx.fillStyle = "#fff2c9";
        targetCtx.beginPath();
        targetCtx.arc(x + headR - 1, y - 83, 2.5, 0, Math.PI * 2);
        targetCtx.fill();
      } else if (look.accessory === "clip") {
        targetCtx.fillStyle = "#dce8ff";
        targetCtx.fillRect(x + headR - 4, y - 82, 10, 3);
      } else if (look.accessory === "ribbon") {
        targetCtx.fillStyle = "#ff8fb6";
        targetCtx.beginPath();
        targetCtx.moveTo(x + headR - 1, y - 86);
        targetCtx.lineTo(x + headR + 8, y - 82);
        targetCtx.lineTo(x + headR + 2, y - 76);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.beginPath();
        targetCtx.moveTo(x + headR - 1, y - 86);
        targetCtx.lineTo(x + headR - 10, y - 82);
        targetCtx.lineTo(x + headR - 4, y - 76);
        targetCtx.closePath();
        targetCtx.fill();
      } else if (look.accessory === "band") {
        targetCtx.fillStyle = "#d2d7de";
        targetCtx.fillRect(x - headR, y - 80, headR * 2, 3);
      } else if (look.accessory === "stud") {
        targetCtx.fillStyle = "#eef6ff";
        targetCtx.beginPath();
        targetCtx.arc(x - headR + 1, y - 66, 1.8, 0, Math.PI * 2);
        targetCtx.fill();
      }
    }

    function renderAvatarPreview(targetCanvas, profile) {
      const previewCtx = targetCanvas.getContext("2d");
      const width = targetCanvas.width;
      const height = targetCanvas.height;
      previewCtx.clearRect(0, 0, width, height);
      const grad = previewCtx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#223b4f");
      grad.addColorStop(1, "#101922");
      previewCtx.fillStyle = grad;
      previewCtx.fillRect(0, 0, width, height);
      previewCtx.fillStyle = "rgba(255,255,255,0.05)";
      previewCtx.beginPath();
      previewCtx.arc(width / 2, 150, 120, 0, Math.PI * 2);
      previewCtx.fill();
      previewCtx.save();
      previewCtx.translate(width / 2, height * 0.8);
      previewCtx.scale(3.45, 3.45);
      drawCharacter({ x: 0, y: 0 }, cloneProfile(profile), true, 0, previewCtx);
      previewCtx.restore();
    }

    function renderRestaurantPreview(targetCanvas) {
      const previewCtx = targetCanvas.getContext("2d");
      const width = targetCanvas.width;
      const height = targetCanvas.height;
      const wallTheme = getWallTheme();
      const floorTheme = getFloorTheme();
      const tableColor = getTableColor();
      const counterStyle = getCounterStyle();
      previewCtx.clearRect(0, 0, width, height);
      const grad = previewCtx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#29495e");
      grad.addColorStop(1, "#101a24");
      previewCtx.fillStyle = grad;
      previewCtx.fillRect(0, 0, width, height);

      const previewOrigin = { x: width / 2, y: 96 };
      const tileW = 42;
      const tileH = 22;
      function previewIso(tileX, tileY) {
        return {
          x: previewOrigin.x + (tileX - tileY) * (tileW / 2),
          y: previewOrigin.y + (tileX + tileY) * (tileH / 2)
        };
      }

      for (let i = 0; i < GRID_W - 1; i += 1) {
        const p = previewIso(i, 0);
        previewCtx.beginPath();
        previewCtx.moveTo(p.x, p.y);
        previewCtx.lineTo(p.x + tileW / 2, p.y + tileH / 2);
        previewCtx.lineTo(p.x + tileW / 2, p.y - 54);
        previewCtx.lineTo(p.x, p.y - 70);
        previewCtx.closePath();
        previewCtx.fillStyle = i % 2 === 0 ? wallTheme.top : shade(wallTheme.top, 8);
        previewCtx.fill();
        previewCtx.beginPath();
        previewCtx.moveTo(p.x, p.y);
        previewCtx.lineTo(p.x - tileW / 2, p.y + tileH / 2);
        previewCtx.lineTo(p.x - tileW / 2, p.y - 40);
        previewCtx.lineTo(p.x, p.y - 70);
        previewCtx.closePath();
        previewCtx.fillStyle = i % 2 === 0 ? wallTheme.left : wallTheme.right;
        previewCtx.fill();
      }

      for (let y = 0; y < GRID_H; y += 1) {
        for (let x = 0; x < GRID_W; x += 1) {
          const p = previewIso(x, y);
          previewCtx.beginPath();
          previewCtx.moveTo(p.x, p.y);
          previewCtx.lineTo(p.x + tileW / 2, p.y + tileH / 2);
          previewCtx.lineTo(p.x, p.y + tileH);
          previewCtx.lineTo(p.x - tileW / 2, p.y + tileH / 2);
          previewCtx.closePath();
          previewCtx.fillStyle = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1
            ? floorTheme.edge
            : ((x + y) % 2 === 0 ? floorTheme.even : floorTheme.odd);
          previewCtx.fill();
          previewCtx.strokeStyle = "rgba(255,255,255,0.05)";
          previewCtx.stroke();
        }
      }

      getTableTiles().forEach((tile, index) => {
        const p = previewIso(tile.x, tile.y);
        previewCtx.fillStyle = "rgba(0,0,0,0.16)";
        previewCtx.beginPath();
        previewCtx.ellipse(p.x, p.y + 10, 20, 8, 0, 0, Math.PI * 2);
        previewCtx.fill();
        previewCtx.fillStyle = index % 2 === 0 ? tableColor : shade(tableColor, -8);
        previewCtx.beginPath();
        previewCtx.ellipse(p.x, p.y - 2, 20, 8, 0, 0, Math.PI * 2);
        previewCtx.fill();
        previewCtx.fillRect(p.x - 3, p.y - 2, 6, 18);
      });

      Data.stations.forEach((station) => {
        const p = previewIso(station.tile.x, station.tile.y);
        const stationSkin = getStationSkin(station);
        const baseColor = station.type === "counter" ? counterStyle.color : stationSkin.color;
        previewCtx.fillStyle = baseColor;
        previewCtx.beginPath();
        previewCtx.moveTo(p.x, p.y - 30);
        previewCtx.lineTo(p.x + 18, p.y - 20);
        previewCtx.lineTo(p.x + 18, p.y + 8);
        previewCtx.lineTo(p.x, p.y - 2);
        previewCtx.closePath();
        previewCtx.fill();
        previewCtx.beginPath();
        previewCtx.moveTo(p.x, p.y - 30);
        previewCtx.lineTo(p.x - 18, p.y - 20);
        previewCtx.lineTo(p.x - 18, p.y + 8);
        previewCtx.lineTo(p.x, p.y - 2);
        previewCtx.closePath();
        previewCtx.fillStyle = shade(baseColor, -18);
        previewCtx.fill();
        previewCtx.fillStyle = shade(baseColor, 16);
        previewCtx.fillRect(p.x - 14, p.y - 42, 28, 12);
        previewCtx.fillStyle = station.type === "counter" ? counterStyle.accent : stationSkin.accent;
        previewCtx.fillRect(p.x - 8, p.y - 37, 16, 4);
      });

      previewCtx.fillStyle = "rgba(255,255,255,0.08)";
      previewCtx.fillRect(16, 16, width - 32, height - 32);
      previewCtx.strokeStyle = "rgba(255,255,255,0.08)";
      previewCtx.strokeRect(16, 16, width - 32, height - 32);
      previewCtx.fillStyle = "#eff6f8";
      previewCtx.font = "bold 13px Trebuchet MS";
      previewCtx.fillText("Live Restaurant Preview", 28, 38);
      previewCtx.fillStyle = "#9cb3be";
      previewCtx.font = "12px Trebuchet MS";
      previewCtx.fillText("Walls, tables, machines, and counter update here as you edit.", 28, 56);
    }

    function drawSpeechBubble(x, y, a, b) {
      roundedRect(x, y, 132, 48, 14, "rgba(7,15,23,0.92)");
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(x, y, 132, 48);
      ctx.fillStyle = "#edf5f7"; ctx.font = "bold 13px Trebuchet MS"; ctx.fillText(a, x + 12, y + 17);
      ctx.fillStyle = "#9ab1bc"; ctx.font = "12px Trebuchet MS"; ctx.fillText(b, x + 12, y + 34);
    }

    function drawReactionBubble(item) {
      const fill = item.mood === "happy" ? "rgba(18,39,28,0.94)" : "rgba(52,18,22,0.94)";
      const accent = item.mood === "happy" ? "#8be28f" : "#ff687b";
      roundedRect(item.x, item.y, 118, 34, 14, fill);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.strokeRect(item.x, item.y, 118, 34);
      ctx.fillStyle = accent;
      ctx.font = "bold 12px Trebuchet MS";
      ctx.fillText(item.text, item.x + 10, item.y + 21);
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
      getTableTiles().forEach((tile, index) => {
        drawTable(tile.x, tile.y, index % 2 === 0 ? getTableColor() : shade(getTableColor(), -8));
      });
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
          drawCharacter({ x: p.x, y: p.y }, state.playerProfile, true, 0.3);
          if (state.activeCup) {
            ctx.fillStyle = "#f8efe5"; ctx.fillRect(p.x + 10, p.y - 56, 14, 14);
            ctx.fillStyle = "#5d392b"; ctx.fillRect(p.x + 11, p.y - 48, 12, 3);
          }
        }
        if (item.type === "customer") {
          const p = isoToScreen(item.tile.x, item.tile.y);
          drawCharacter({ x: p.x, y: p.y }, item.customer.look, false, item.tile.x * 0.4 + item.tile.y * 0.2);
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
      state.reactions.forEach((item) => {
        ctx.globalAlpha = Math.min(1, item.life);
        drawReactionBubble(item);
        ctx.globalAlpha = 1;
      });
      state.particles.forEach((particle) => {
        ctx.globalAlpha = Math.max(0, particle.life); ctx.fillStyle = particle.color; ctx.beginPath(); ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      });
      state.floatingText.forEach((item) => {
        ctx.globalAlpha = Math.min(1, item.life); ctx.fillStyle = item.color; ctx.font = "bold 22px Gill Sans"; ctx.fillText(item.text, item.x, item.y); ctx.globalAlpha = 1;
      });
    }

    function update(dt) {
      state.renderClock += dt;
      state.uiTick -= dt;
      if (state.started && !state.paused && !state.gameOver) {
        state.shiftRemaining -= dt;
        state.spawnCooldown -= dt;
        if (state.spawnCooldown <= 0 && state.customers.length < 4) {
          state.customers.push(customerFactory());
          state.spawnCooldown = nextSpawnCooldown();
          sfx("arrive");
        }
        const pace = paceFactor();
        state.customers.forEach((customer, index) => {
          const drainRate = (index === 0 ? 1.85 : 1.18) * pace;
          customer.patience -= dt * drainRate;
        });
        while (state.customers[0] && state.customers[0].patience <= 0) {
          const unhappy = state.customers.shift();
          pushReaction(unhappy, Data.queueTiles[0], "angry");
          state.combo = 1;
          state.reputation = Math.max(0, state.reputation - 10);
          sfx("leave");
          sfx("angry");
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
      state.reactions = state.reactions.filter((item) => {
        item.life -= dt;
        item.y -= 12 * dt;
        return item.life > 0;
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
      setPlayerProfile,
      getPlayerProfile,
        setRestaurantProfile,
        getRestaurantProfile,
        renderAvatarPreview,
        renderRestaurantPreview,
        toggleMusic,
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
