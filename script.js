(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const ui = {
    score: document.getElementById("scoreValue"),
    coins: document.getElementById("coinsValue"),
    reputation: document.getElementById("reputationValue"),
    shift: document.getElementById("shiftValue"),
    served: document.getElementById("servedValue"),
    combo: document.getElementById("comboValue"),
    rank: document.getElementById("rankValue"),
    stationTitle: document.getElementById("stationTitle"),
    stationDescription: document.getElementById("stationDescription"),
    actionList: document.getElementById("actionList"),
    cupTitle: document.getElementById("cupTitle"),
    cupSubtitle: document.getElementById("cupSubtitle"),
    cupProgress: document.getElementById("cupProgress"),
    ordersList: document.getElementById("ordersList"),
    recipeList: document.getElementById("recipeList"),
    traineeGrid: document.getElementById("traineeGrid"),
    sourceList: document.getElementById("sourceList"),
    overlay: document.getElementById("overlayCard"),
    startButton: document.getElementById("startButton"),
    stopButton: document.getElementById("stopButton"),
    gameTabButton: document.getElementById("gameTabButton"),
    trainingTabButton: document.getElementById("trainingTabButton"),
    gameView: document.getElementById("gameView"),
    trainingView: document.getElementById("trainingView"),
    soundButton: document.getElementById("soundButton"),
    trashButton: document.getElementById("trashButton")
  };

  const uiCache = {
    actionSignature: "",
    menuPrices: {}
  };

  const TILE_W = 94;
  const TILE_H = 46;
  const GRID_W = 9;
  const GRID_H = 9;
  const origin = { x: 700, y: 155 };

  const actionMeta = {
    cup_espresso: { label: "Espresso Cup", detail: "Grab a small ceramic espresso cup." },
    cup_tulip: { label: "Tulip Cup", detail: "Grab a balanced cafe cup for milk drinks." },
    cup_mug: { label: "House Mug", detail: "Grab the large mug for mochas and americanos." },
    grind: { label: "Grind Beans", detail: "Prepare fresh espresso grounds." },
    espresso: { label: "Pull Espresso", detail: "Extract a full espresso shot." },
    ristretto: { label: "Pull Ristretto", detail: "Extract a sweeter, shorter shot." },
    hot_water: { label: "Add Hot Water", detail: "Lengthen the drink with hot water." },
    steam_milk: { label: "Steam Milk", detail: "Create silky steamed milk." },
    foam_cap: { label: "Top With Foam", detail: "Finish with airy cappuccino foam." },
    microfoam: { label: "Pour Microfoam", detail: "Velvety milk for flat whites." },
    mocha_sauce: { label: "Add Mocha Sauce", detail: "Lay down bittersweet chocolate." },
    whip: { label: "Top Whipped Cream", detail: "Finish with a whipped crown." },
    serve: { label: "Serve Drink", detail: "Hand the current drink to the first customer in line." }
  };

  const recipes = [
    {
      key: "espresso",
      name: "Espresso",
      boardLabel: "ESPRESSO",
      basePrice: 2.5,
      patience: 88,
      cupName: "Espresso cup",
      stationNote: "A focused shot with crema in a small cup.",
      tools: "Cup wall, grinder, espresso machine",
      trainerTip: "Keep it compact and intense. This is the base for several other drinks.",
      steps: ["Grab espresso cup", "Grind beans", "Pull espresso shot"],
      sequence: ["cup_espresso", "grind", "espresso"]
    },
    {
      key: "americano",
      name: "Caffe Americano",
      boardLabel: "AMERICANO",
      basePrice: 3.5,
      patience: 92,
      cupName: "House mug",
      stationNote: "Hot water first, then two espresso shots.",
      tools: "Cup wall, water tap, grinder, espresso machine",
      trainerTip: "Water goes in before the espresso shots to preserve the crema feel of the pour.",
      steps: ["Grab house mug", "Add hot water", "Grind beans", "Pull espresso shot", "Pull second espresso shot"],
      sequence: ["cup_mug", "hot_water", "grind", "espresso", "espresso"]
    },
    {
      key: "cappuccino",
      name: "Classic Cappuccino",
      boardLabel: "CAPPUCCINO",
      basePrice: 3.75,
      patience: 98,
      cupName: "Tulip cup",
      stationNote: "Espresso with milk and a generous foam cap.",
      tools: "Cup wall, grinder, espresso machine, steam wand",
      trainerTip: "The foam finish should feel taller and airier than a latte.",
      steps: ["Grab tulip cup", "Grind beans", "Pull espresso shot", "Steam milk", "Top with foam cap"],
      sequence: ["cup_tulip", "grind", "espresso", "steam_milk", "foam_cap"]
    },
    {
      key: "latte",
      name: "Caffe Latte",
      boardLabel: "LATTE",
      basePrice: 4.5,
      patience: 104,
      cupName: "Tulip cup",
      stationNote: "Espresso finished with steamed milk and a light foam layer.",
      tools: "Cup wall, grinder, espresso machine, steam wand",
      trainerTip: "This drink leans silkier than cappuccino and should finish smoother.",
      steps: ["Grab tulip cup", "Grind beans", "Pull espresso shot", "Steam milk"],
      sequence: ["cup_tulip", "grind", "espresso", "steam_milk"]
    },
    {
      key: "flat_white",
      name: "Flat White",
      boardLabel: "FLAT WHITE",
      basePrice: 4.2,
      patience: 108,
      cupName: "Tulip cup",
      stationNote: "Two ristretto shots and velvety microfoam.",
      tools: "Cup wall, grinder, espresso machine, steam wand",
      trainerTip: "Shorter ristretto shots plus polished microfoam keep it dense and glossy.",
      steps: ["Grab tulip cup", "Grind beans", "Pull ristretto shot", "Pull second ristretto shot", "Pour microfoam"],
      sequence: ["cup_tulip", "grind", "ristretto", "ristretto", "microfoam"]
    },
    {
      key: "mocha",
      name: "Caffe Mocha",
      boardLabel: "MOCHA",
      basePrice: 4.9,
      patience: 112,
      cupName: "House mug",
      stationNote: "Mocha sauce, espresso, milk, then whipped cream.",
      tools: "Cup wall, syrup rail, grinder, espresso machine, steam wand, topping bar",
      trainerTip: "Build the chocolate base first so the espresso integrates into it cleanly.",
      steps: ["Grab house mug", "Add mocha sauce", "Grind beans", "Pull espresso shot", "Steam milk", "Top whipped cream"],
      sequence: ["cup_mug", "mocha_sauce", "grind", "espresso", "steam_milk", "whip"]
    }
  ];

  const recipeMap = Object.fromEntries(recipes.map((recipe) => [recipe.key, recipe]));

  const stations = [
    { id: "cups", name: "Cup Wall", label: "CUP WALL", description: "Pick the right vessel before you start building the drink.", tile: { x: 1, y: 1 }, interactionTile: { x: 2, y: 1 }, height: 74, color: "#bc9164", accent: "#ffcf87", actions: ["cup_espresso", "cup_tulip", "cup_mug"] },
    { id: "grinder", name: "Precision Grinder", label: "GRINDER", description: "Fresh grounds first. Espresso drinks start here.", tile: { x: 1, y: 3 }, interactionTile: { x: 2, y: 3 }, height: 82, color: "#6a7785", accent: "#4fd3db", actions: ["grind"] },
    { id: "espresso_machine", name: "Aurora Espresso", label: "ESPRESSO", description: "Pull standard shots or shorter ristretto shots.", tile: { x: 3, y: 1 }, interactionTile: { x: 3, y: 2 }, height: 90, color: "#8c5d47", accent: "#ff8a3d", actions: ["espresso", "ristretto"] },
    { id: "steam_wand", name: "Steam Wand", label: "STEAM WAND", description: "Steam milk, build airy foam, or groom microfoam.", tile: { x: 5, y: 1 }, interactionTile: { x: 5, y: 2 }, height: 88, color: "#6c808f", accent: "#b7eff5", actions: ["steam_milk", "foam_cap", "microfoam"] },
    { id: "water_tap", name: "Water Tap", label: "WATER", description: "Only used for americanos. Water goes in before the shots.", tile: { x: 7, y: 1 }, interactionTile: { x: 7, y: 2 }, height: 74, color: "#4c6d86", accent: "#7fe1ff", actions: ["hot_water"] },
    { id: "syrup_rail", name: "Syrup Rail", label: "SYRUP", description: "Mocha sauce for chocolate builds.", tile: { x: 7, y: 3 }, interactionTile: { x: 6, y: 3 }, height: 74, color: "#83575c", accent: "#ffc46d", actions: ["mocha_sauce"] },
    { id: "topping_bar", name: "Topping Bar", label: "TOPPING", description: "Finish mochas with whipped cream.", tile: { x: 7, y: 5 }, interactionTile: { x: 6, y: 5 }, height: 68, color: "#68735f", accent: "#f0f4ff", actions: ["whip"] },
    { id: "service_counter", name: "Service Counter", label: "COUNTER", description: "Serve the front customer when the drink is complete.", tile: { x: 4, y: 7 }, interactionTile: { x: 4, y: 6 }, height: 92, color: "#846851", accent: "#ffbc57", actions: ["serve"] }
  ];

  const customerNames = ["Mia", "Noah", "Avery", "Theo", "Lina", "Kai", "Nova", "Jules", "Ivy", "Zara", "Otis", "Ezra"];
  const palette = [
    { skin: "#f1c7a7", shirt: "#ff8b64", pants: "#355f74" },
    { skin: "#cc9377", shirt: "#4fd3db", pants: "#264356" },
    { skin: "#a86f56", shirt: "#f3d36c", pants: "#5c3853" },
    { skin: "#efd0bf", shirt: "#91e0a0", pants: "#524d77" },
    { skin: "#8c5f4d", shirt: "#ee6c8d", pants: "#335149" }
  ];

  const state = {
    started: false,
    gameOver: false,
    paused: false,
    view: "game",
    score: 0,
    coins: 0,
    reputation: 100,
    customersServed: 0,
    failedOrders: 0,
    combo: 1,
    shiftLength: 180,
    shiftRemaining: 180,
    spawnCooldown: 3,
    customers: [],
    particles: [],
    floatingText: [],
    activeCup: null,
    uiRefresh: 0,
    keys: new Set()
  };

  const player = {
    tileX: 4,
    tileY: 5,
    targetX: 4,
    targetY: 5,
    moveSpeed: 4.3,
    currentTask: null,
    taskTime: 0,
    taskDuration: 0
  };

  let audio = null;
  let lastTime = performance.now();

  function isoToScreen(tileX, tileY) {
    return {
      x: origin.x + (tileX - tileY) * (TILE_W / 2),
      y: origin.y + (tileX + tileY) * (TILE_H / 2)
    };
  }

  function screenToTile(screenX, screenY) {
    const localX = screenX - origin.x;
    const localY = screenY - origin.y;
    const x = (localY / (TILE_H / 2) + localX / (TILE_W / 2)) / 2;
    const y = (localY / (TILE_H / 2) - localX / (TILE_W / 2)) / 2;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function clampTile(x, y) {
    return {
      x: Math.max(0, Math.min(GRID_W - 1, x)),
      y: Math.max(0, Math.min(GRID_H - 1, y))
    };
  }

  function isInBounds(tileX, tileY) {
    return tileX >= 0 && tileX < GRID_W && tileY >= 0 && tileY < GRID_H;
  }

  function canMoveTo(tileX, tileY) {
    if (!isInBounds(tileX, tileY)) {
      return false;
    }
    return !stations.some((station) => station.tile.x === tileX && station.tile.y === tileY);
  }

  function setMoveTarget(tileX, tileY) {
    const next = clampTile(tileX, tileY);
    if (canMoveTo(next.x, next.y)) {
      player.targetX = next.x;
      player.targetY = next.y;
    }
  }

  function getNearbyStation() {
    return stations.find((station) => {
      const dx = Math.abs(player.tileX - station.interactionTile.x);
      const dy = Math.abs(player.tileY - station.interactionTile.y);
      return dx + dy <= 0.16;
    }) || null;
  }

  function bestRecipeMatch(steps) {
    if (!steps.length) {
      return null;
    }
    let best = null;
    let bestScore = -1;
    recipes.forEach((recipe) => {
      const max = Math.min(recipe.sequence.length, steps.length);
      let prefix = 0;
      for (let i = 0; i < max; i += 1) {
        if (recipe.sequence[i] !== steps[i]) {
          break;
        }
        prefix += 1;
      }
      if (prefix > bestScore) {
        best = recipe;
        bestScore = prefix;
      }
    });
    return best;
  }

  function rankForScore(score) {
    if (score >= 2400) return "Legendary Brewer";
    if (score >= 1600) return "Gold Shift Lead";
    if (score >= 900) return "Velvet Pro";
    if (score >= 300) return "Rising Roaster";
    return "Apprentice";
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

  function getRecipePrice(recipe, timeMs = Date.now()) {
    const drift = Math.sin((timeMs / 1000) * 0.025 + recipe.basePrice) * 0.18;
    const pulse = Math.cos((timeMs / 1000) * 0.011 + recipe.sequence.length) * 0.1;
    return Math.max(2, recipe.basePrice + drift + pulse);
  }

  function getBoardDateParts() {
    const now = new Date();
    return {
      day: now.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase(),
      date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase(),
      time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    };
  }

  function queueTile(index) {
    const queue = [
      { x: 4, y: 8 },
      { x: 3, y: 8 },
      { x: 2, y: 8 },
      { x: 1, y: 8 }
    ];
    return queue[index] || queue[queue.length - 1];
  }

  function makeOrder(id) {
    const recipe = recipes[Math.floor(Math.random() * recipes.length)];
    const colors = palette[Math.floor(Math.random() * palette.length)];
    const name = customerNames[Math.floor(Math.random() * customerNames.length)];
    return {
      id,
      name,
      recipeKey: recipe.key,
      offerPrice: getRecipePrice(recipe),
      patience: recipe.patience,
      patienceMax: recipe.patience,
      colors
    };
  }

  function flashMessage(text, color) {
    state.floatingText.push({
      x: canvas.clientWidth / 2,
      y: 70,
      text,
      color,
      life: 1.8
    });
  }

  function spawnParticles(tileX, tileY, actionKey) {
    const point = isoToScreen(tileX, tileY);
    const color = ["steam_milk", "foam_cap", "microfoam"].includes(actionKey) ? "#dffcff" : "#ffbc57";
    for (let i = 0; i < 14; i += 1) {
      state.particles.push({
        x: point.x,
        y: point.y - 48,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 90,
        life: 0.7 + Math.random() * 0.4,
        color
      });
    }
  }

  function syncUi() {
    ui.score.textContent = state.score;
    ui.coins.textContent = state.coins;
    ui.reputation.textContent = state.reputation;
    ui.shift.textContent = formatTime(state.shiftRemaining);
    ui.served.textContent = state.customersServed;
    ui.combo.textContent = `x${state.combo.toFixed(2).replace(/\.00$/, "")}`;
    ui.rank.textContent = rankForScore(state.score);
    ui.soundButton.textContent = `Sound: ${audio && audio.enabled ? "On" : "Off"}`;
    ui.stopButton.disabled = !state.started && !state.paused;
    ui.gameTabButton.classList.toggle("is-active", state.view === "game");
    ui.trainingTabButton.classList.toggle("is-active", state.view === "training");
    ui.gameView.classList.toggle("is-active", state.view === "game");
    ui.trainingView.classList.toggle("is-active", state.view === "training");

    const station = getNearbyStation();
    const actionSignature = [
      station ? station.id : "none",
      state.started ? 1 : 0,
      state.paused ? 1 : 0,
      player.currentTask ? 1 : 0,
      state.customers.length,
      state.view
    ].join("|");
    if (uiCache.actionSignature !== actionSignature) {
      ui.actionList.innerHTML = "";
      if (!station) {
        ui.stationTitle.textContent = "Walk up to a machine";
        ui.stationDescription.textContent = state.view === "training"
          ? "Switch back to the game zone when you want to work the floor."
          : "Machines expose different drink actions when you are in range.";
      } else {
        ui.stationTitle.textContent = station.name;
        ui.stationDescription.textContent = station.description;
        const actions = station.id === "service_counter" ? ["serve"] : station.actions;
        actions.forEach((actionKey, index) => {
          const button = document.createElement("button");
          button.className = "action-button";
          button.disabled = !state.started || state.paused || !!player.currentTask || (actionKey === "serve" && !state.customers.length);
          button.innerHTML = `<strong>${index + 1}. ${actionMeta[actionKey].label}</strong><span>${actionMeta[actionKey].detail}</span>`;
          button.addEventListener("click", () => startTask(actionKey));
          ui.actionList.appendChild(button);
        });
      }
      uiCache.actionSignature = actionSignature;
    }

    if (!state.activeCup) {
      ui.cupTitle.textContent = "No drink in hand";
      ui.cupSubtitle.textContent = "Grab a cup from the cup wall to start a new order.";
      ui.cupProgress.innerHTML = "";
    } else {
      const matching = bestRecipeMatch(state.activeCup.steps);
      ui.cupTitle.textContent = matching ? `Building: ${matching.name}` : "Experimental build";
      ui.cupSubtitle.textContent = `${state.activeCup.steps.length} step${state.activeCup.steps.length === 1 ? "" : "s"} in current cup`;
      ui.cupProgress.innerHTML = "";
      state.activeCup.steps.forEach((step, index) => {
        const chip = document.createElement("div");
        chip.className = "progress-chip";
        chip.innerHTML = `<strong>${index + 1}. ${actionMeta[step].label}</strong><span>${actionMeta[step].detail}</span>`;
        ui.cupProgress.appendChild(chip);
      });
    }

    ui.ordersList.innerHTML = "";
    if (!state.customers.length) {
      const empty = document.createElement("div");
      empty.className = "order-card";
      empty.innerHTML = "<h3>No one in line</h3><div class=\"order-meta\"><span>Doors closed for the moment</span><span>Prep for the next rush</span></div>";
      ui.ordersList.appendChild(empty);
    } else {
      state.customers.forEach((customer, index) => {
        const recipe = recipeMap[customer.recipeKey];
        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = `
          <h3>${index === 0 ? "Front" : "Queue"}: ${customer.name}</h3>
          <div class="order-meta">
            <span>${recipe.name}</span>
            <span>${formatEuro(customer.offerPrice)}</span>
          </div>
          <div class="order-meta">
            <span>${recipe.stationNote}</span>
            <span>${Math.ceil(customer.patience)} patience</span>
          </div>
          <div class="patience-bar"><i style="width:${(customer.patience / customer.patienceMax) * 100}%"></i></div>
        `;
        ui.ordersList.appendChild(card);
      });
    }

    recipes.forEach((recipe) => {
      if (uiCache.menuPrices[recipe.key]) {
        uiCache.menuPrices[recipe.key].textContent = formatEuro(getRecipePrice(recipe));
      }
    });
  }

  function startTask(actionKey) {
    if (!state.started || state.gameOver || state.paused || state.view !== "game" || player.currentTask) {
      return;
    }
    const station = getNearbyStation();
    if (!station) {
      return;
    }
    if (actionKey === "serve") {
      serveFrontCustomer();
      return;
    }
    if (!station.actions.includes(actionKey)) {
      return;
    }
    if (!state.activeCup && !actionKey.startsWith("cup_")) {
      flashMessage("Grab a cup first", "#ffbc57");
      playSfx("error");
      return;
    }
    if (state.activeCup && actionKey.startsWith("cup_")) {
      flashMessage("Trash or serve the current cup first", "#ffbc57");
      playSfx("error");
      return;
    }

    const duration = {
      cup_espresso: 0.45,
      cup_tulip: 0.45,
      cup_mug: 0.45,
      grind: 1.35,
      espresso: 1.7,
      ristretto: 1.55,
      hot_water: 1,
      steam_milk: 1.55,
      foam_cap: 1.15,
      microfoam: 1.35,
      mocha_sauce: 0.8,
      whip: 0.75
    }[actionKey] || 1;

    player.currentTask = actionKey;
    player.taskTime = 0;
    player.taskDuration = duration;
    flashMessage(actionMeta[actionKey].label, "#b7eff5");
  }

  function finishTask(actionKey) {
    if (actionKey.startsWith("cup_")) {
      state.activeCup = { steps: [actionKey] };
      playSfx("cup");
    } else {
      state.activeCup.steps.push(actionKey);
      playSfx(["steam_milk", "foam_cap", "microfoam"].includes(actionKey) ? "steam" : "brew");
    }
    spawnParticles(player.tileX, player.tileY, actionKey);
    player.currentTask = null;
    player.taskTime = 0;
    player.taskDuration = 0;
    syncUi();
  }

  function serveFrontCustomer() {
    if (!state.activeCup) {
      flashMessage("No drink to serve", "#ffbc57");
      playSfx("error");
      return;
    }
    const customer = state.customers[0];
    if (!customer) {
      flashMessage("No customer at the counter", "#ffbc57");
      playSfx("error");
      return;
    }

    const recipe = recipeMap[customer.recipeKey];
    const built = state.activeCup.steps;
    const target = recipe.sequence;
    const perfect = built.length === target.length && built.every((step, index) => step === target[index]);

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
      playSfx("serve");
      flashMessage(`Perfect ${recipe.name}! +${reward} coins`, "#8be28f");
    } else {
      state.combo = 1;
      state.reputation = Math.max(0, state.reputation - 6);
      customer.patience = Math.max(1, customer.patience - 18);
      flashMessage("Wrong build. Check the recipe board.", "#ff7f8f");
      playSfx("error");
    }
    syncUi();
  }

  function trashCup() {
    if (!state.activeCup) {
      flashMessage("Nothing to trash", "#ffbc57");
      return;
    }
    state.activeCup = null;
    state.combo = 1;
    flashMessage("Cup trashed", "#ff7f8f");
    playSfx("trash");
    syncUi();
  }

  function updateMovement(dt) {
    if (player.currentTask || state.paused || state.view !== "game") {
      return;
    }

    if (player.tileX === player.targetX && player.tileY === player.targetY) {
      if (state.keys.has("ArrowUp") || state.keys.has("w")) {
        setMoveTarget(player.tileX, player.tileY - 1);
      }
      if (state.keys.has("ArrowDown") || state.keys.has("s")) {
        setMoveTarget(player.tileX, player.tileY + 1);
      }
      if (state.keys.has("ArrowLeft") || state.keys.has("a")) {
        setMoveTarget(player.tileX - 1, player.tileY);
      }
      if (state.keys.has("ArrowRight") || state.keys.has("d")) {
        setMoveTarget(player.tileX + 1, player.tileY);
      }
    }

    const dx = player.targetX - player.tileX;
    const dy = player.targetY - player.tileY;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.001) {
      const step = Math.min(dist, player.moveSpeed * dt);
      player.tileX += (dx / dist) * step;
      player.tileY += (dy / dist) * step;
    } else {
      player.tileX = player.targetX;
      player.tileY = player.targetY;
    }
  }

  function updateTask(dt) {
    if (!player.currentTask) {
      return;
    }
    player.taskTime += dt;
    if (player.taskTime >= player.taskDuration) {
      finishTask(player.currentTask);
    }
  }

  function updateParticles(dt) {
    state.particles = state.particles.filter((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 120 * dt;
      return particle.life > 0;
    });

    state.floatingText = state.floatingText.filter((item) => {
      item.life -= dt;
      item.y -= 24 * dt;
      return item.life > 0;
    });
  }

  function spawnCustomer() {
    if (state.customers.length >= 4) {
      return;
    }
    state.customers.push(makeOrder(`customer-${Date.now()}-${Math.floor(Math.random() * 1000)}`));
    playSfx("arrive");
    flashMessage("New customer", "#ffbc57");
  }

  function update(dt) {
    if (state.started && !state.gameOver && !state.paused) {
      state.shiftRemaining -= dt;
      state.spawnCooldown -= dt;

      if (state.shiftRemaining <= 0 || state.reputation <= 0) {
        state.shiftRemaining = Math.max(0, state.shiftRemaining);
        state.started = false;
        state.gameOver = true;
        ui.overlay.style.display = "block";
        ui.overlay.innerHTML = `
          <div class="eyebrow">Shift complete</div>
          <h3>${state.reputation <= 0 ? "The line lost faith" : "Doors closed for today"}</h3>
          <p>Score ${state.score}, coins ${state.coins}, served ${state.customersServed}, rank ${rankForScore(state.score)}.</p>
          <p class="overlay-tip">Press Start Shift to run a new day.</p>
        `;
        playSfx("close");
      }

      if (!state.gameOver && state.spawnCooldown <= 0) {
        spawnCustomer();
        const wavePressure = 3.8 - Math.min(state.customersServed * 0.08, 1.7);
        state.spawnCooldown = Math.max(1.8, wavePressure + Math.random() * 1.8);
      }

      state.customers.forEach((customer) => {
        customer.patience -= dt * (state.customers[0] === customer ? 3.8 : 2.6);
      });

      while (state.customers[0] && state.customers[0].patience <= 0) {
        const lost = state.customers.shift();
        state.combo = 1;
        state.failedOrders += 1;
        state.reputation = Math.max(0, state.reputation - 10);
        playSfx("leave");
        flashMessage(`${lost.name} left unhappy`, "#ff7f8f");
      }
    }

    updateMovement(dt);
    updateTask(dt);
    updateParticles(dt);

    state.uiRefresh -= dt;
    if (state.uiRefresh <= 0) {
      syncUi();
      state.uiRefresh = 0.12;
    }
  }

  function shade(hex, delta) {
    const raw = hex.replace("#", "");
    const num = parseInt(raw, 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + delta));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + delta));
    const b = Math.max(0, Math.min(255, (num & 0xff) + delta));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function roundedRect(x, y, width, height, radius, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  function buildRecipeBoard() {
    ui.traineeGrid.innerHTML = "";
    recipes.forEach((recipe) => {
      const item = document.createElement("div");
      item.className = "training-card";
      const sequence = recipe.steps.map((step) => `<li>${step}</li>`).join("");
      item.innerHTML = `
        <h3>${recipe.name}</h3>
        <div class="training-meta">${formatEuro(recipe.basePrice)} base menu price</div>
        <p>${recipe.stationNote}</p>
        <div class="recipe-tools">Tools: ${recipe.tools}</div>
        <p>Cup: ${recipe.cupName}</p>
        <p>${recipe.trainerTip}</p>
        <ul>${sequence}</ul>
      `;
      ui.traineeGrid.appendChild(item);
    });
  }

  function buildSideMenuList() {
    ui.recipeList.innerHTML = "";
    uiCache.menuPrices = {};
    recipes.forEach((recipe) => {
      const item = document.createElement("div");
      item.className = "recipe-item";
      const priceEl = document.createElement("span");
      priceEl.textContent = formatEuro(getRecipePrice(recipe));
      uiCache.menuPrices[recipe.key] = priceEl;

      const meta = document.createElement("div");
      meta.className = "order-meta";
      meta.innerHTML = `<span>${recipe.cupName}</span>`;
      meta.appendChild(priceEl);

      const title = document.createElement("h3");
      title.textContent = recipe.name;

      const note = document.createElement("p");
      note.textContent = recipe.stationNote;

      item.appendChild(title);
      item.appendChild(meta);
      item.appendChild(note);
      ui.recipeList.appendChild(item);
    });
  }

  function buildSourceBoard() {
    const sources = [
      { label: "Coffee Association of Canada: Styles of Coffee", href: "https://coffeeassoc.com/coffee-101/styles-of-coffee/" },
      { label: "Starbucks At Home: Classic Cappuccino", href: "https://athome.starbucks.com/recipe/classic-cappuccino" },
      { label: "Starbucks At Home: Caffe Latte", href: "https://athome.starbucks.com/recipe/caffe-latte" },
      { label: "Starbucks At Home: Caffe Mocha", href: "https://athome.starbucks.com/recipe/caffe-mocha" },
      { label: "Starbucks At Home: Flat White", href: "https://athome.starbucks.com/recipe/flat-white" },
      { label: "Starbucks At Home: Caffe Americano", href: "https://athome.starbucks.com/recipe/caffe-americano" }
    ];
    sources.forEach((source) => {
      const item = document.createElement("div");
      item.className = "source-link";
      item.innerHTML = `<a href="${source.href}" target="_blank" rel="noreferrer">${source.label}</a>`;
      ui.sourceList.appendChild(item);
    });
  }

  function setView(view) {
    state.view = view;
    if (state.started) {
      state.paused = view === "training";
    }
    state.keys.clear();
    syncUi();
  }

  function stopShift() {
    state.started = false;
    state.paused = false;
    state.gameOver = false;
    state.customers = [];
    state.activeCup = null;
    state.keys.clear();
    player.currentTask = null;
    ui.overlay.style.display = "block";
    ui.overlay.innerHTML = `
      <div class="eyebrow">Shift stopped</div>
      <h3>Floor closed by owner</h3>
      <p>The room is idle. Start a new shift when you want the live queue back.</p>
      <p class="overlay-tip">Use the trainee zone to review recipes before restarting.</p>
    `;
    syncUi();
  }

  function drawWallPanel(tileX, tileY, length, color, rightSide = false) {
    for (let i = 0; i < length; i += 1) {
      const x = rightSide ? tileX : i;
      const y = rightSide ? i : tileY;
      const p = isoToScreen(x, y);

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2);
      ctx.lineTo(p.x + TILE_W / 2, p.y - 84);
      ctx.lineTo(p.x, p.y - 108);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2);
      ctx.lineTo(p.x - TILE_W / 2, p.y - 60);
      ctx.lineTo(p.x, p.y - 108);
      ctx.closePath();
      ctx.fillStyle = shade(color, -20);
      ctx.fill();
    }
  }

  function drawBackdrop() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(89, 177, 214, 0.18)");
    gradient.addColorStop(0.55, "rgba(12, 27, 40, 0)");
    gradient.addColorStop(1, "rgba(3, 8, 14, 0.22)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255, 188, 87, 0.14)";
    ctx.beginPath();
    ctx.arc(170, 120, 110, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(79, 211, 219, 0.12)";
    ctx.beginPath();
    ctx.arc(width - 180, 110, 140, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFloor() {
    for (let y = 0; y < GRID_H; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        const p = isoToScreen(x, y);
        const wave = Math.sin((x + y + performance.now() * 0.001) * 0.55) * 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + wave);
        ctx.lineTo(p.x + TILE_W / 2, p.y + TILE_H / 2 + wave);
        ctx.lineTo(p.x, p.y + TILE_H + wave);
        ctx.lineTo(p.x - TILE_W / 2, p.y + TILE_H / 2 + wave);
        ctx.closePath();
        ctx.fillStyle = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1 ? "#294556" : ((x + y) % 2 === 0 ? "#315468" : "#284658");
        ctx.fill();
        ctx.strokeStyle = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1 ? "rgba(255, 204, 127, 0.35)" : "rgba(255, 255, 255, 0.06)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }

  function drawDecor() {
    drawWallPanel(0, 0, GRID_W - 1, "#1e3446");
    drawWallPanel(GRID_W - 1, 0, GRID_H - 1, "#162937", true);
    const signPos = isoToScreen(1, 0);
    roundedRect(signPos.x - 40, signPos.y - 86, 230, 56, 18, "rgba(8,16,24,0.82)");
    ctx.strokeStyle = "rgba(255,188,87,0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(signPos.x - 38, signPos.y - 84, 226, 52);
    ctx.fillStyle = "#ffbc57";
    ctx.font = "bold 28px Gill Sans";
    ctx.fillText("VELVET POUR", signPos.x - 18, signPos.y - 48);

    drawCafeTable(isoToScreen(0.95, 6.15), "#7b5a47");
    drawCafeTable(isoToScreen(6.9, 6.75), "#815f49");
    drawQueueMarkers();
    drawLiveMenuBoard();
  }

  function drawCafeTable(point, color) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + 18, 42, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y - 8, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(point.x - 6, point.y - 8, 12, 40);

    [
      { x: -42, y: 8 },
      { x: 42, y: 8 },
      { x: -24, y: 28 },
      { x: 24, y: 28 }
    ].forEach((chair) => {
      ctx.fillStyle = shade(color, -22);
      ctx.fillRect(point.x + chair.x - 12, point.y + chair.y - 4, 24, 10);
      ctx.fillRect(point.x + chair.x - 9, point.y + chair.y + 6, 4, 16);
      ctx.fillRect(point.x + chair.x + 5, point.y + chair.y + 6, 4, 16);
    });
  }

  function drawQueueMarkers() {
    [
      queueTile(0),
      queueTile(1),
      queueTile(2),
      queueTile(3)
    ].forEach((tile, index) => {
      const p = isoToScreen(tile.x, tile.y);
      ctx.strokeStyle = index === 0 ? "rgba(255,188,87,0.75)" : "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 12);
      ctx.lineTo(p.x + 16, p.y + 20);
      ctx.lineTo(p.x, p.y + 28);
      ctx.lineTo(p.x - 16, p.y + 20);
      ctx.closePath();
      ctx.stroke();
    });
  }

  function drawLiveMenuBoard() {
    const parts = getBoardDateParts();
    const boardW = 420;
    const boardH = 252;
    const boardX = (canvas.clientWidth / 2) - (boardW / 2);
    const boardY = 38;

    for (let i = 0; i < 28; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? "#6d4c39" : "#5f412f";
      ctx.fillRect(boardX - 26 + i * 17, boardY - 22, 10, boardH + 44);
    }

    roundedRect(boardX - 10, boardY - 10, boardW + 20, boardH + 20, 18, "#2b211b");
    ctx.fillStyle = "#17120f";
    ctx.fillRect(boardX, boardY, boardW, boardH);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.strokeRect(boardX, boardY, boardW, boardH);

    ctx.fillStyle = "#eef2f5";
    ctx.font = "bold 18px Consolas";
    ctx.fillText("HOT DRINKS", boardX + 20, boardY + 30);
    ctx.fillText(parts.time, boardX + 324, boardY + 30);
    ctx.font = "15px Consolas";
    ctx.fillText(parts.day, boardX + 20, boardY + 54);
    ctx.fillText(parts.date, boardX + 224, boardY + 54);

    recipes.forEach((recipe, index) => {
      const y = boardY + 90 + index * 24;
      const price = getRecipePrice(recipe).toFixed(2);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(boardX + 16, y - 14, boardW - 32, 20);
      ctx.fillStyle = "#eef2f5";
      ctx.fillText(recipe.boardLabel, boardX + 22, y);
      ctx.fillText(".".repeat(Math.max(6, 25 - recipe.boardLabel.length)), boardX + 166, y);
      ctx.fillText(`EUR ${price}`, boardX + 302, y);
    });
  }

  function drawPrism(centerX, baseY, width, depth, height, color) {
    const halfW = width / 2;
    const halfD = depth / 2;

    ctx.beginPath();
    ctx.moveTo(centerX, baseY);
    ctx.lineTo(centerX + halfW, baseY + halfD);
    ctx.lineTo(centerX + halfW, baseY + halfD - height);
    ctx.lineTo(centerX, baseY - height);
    ctx.closePath();
    ctx.fillStyle = shade(color, 10);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX, baseY);
    ctx.lineTo(centerX - halfW, baseY + halfD);
    ctx.lineTo(centerX - halfW, baseY + halfD - height);
    ctx.lineTo(centerX, baseY - height);
    ctx.closePath();
    ctx.fillStyle = shade(color, -18);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(centerX, baseY - height);
    ctx.lineTo(centerX + halfW, baseY + halfD - height);
    ctx.lineTo(centerX, baseY + depth - height);
    ctx.lineTo(centerX - halfW, baseY + halfD - height);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawStation(station) {
    const p = isoToScreen(station.tile.x, station.tile.y);
    drawPrism(p.x, p.y, TILE_W * 0.9, TILE_H * 0.84, station.height, station.color);

    ctx.fillStyle = shade(station.color, 14);
    ctx.fillRect(p.x - 30, p.y - station.height + 16, 60, 14);

    if (station.id === "cups") {
      ctx.fillStyle = "#f3efe7";
      ctx.fillRect(p.x - 34, p.y - station.height + 28, 68, 8);
      ["#f0efe8", "#d1ecf0", "#f2d6a4"].forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(p.x - 28 + index * 18, p.y - station.height + 4, 12, 24);
      });
    }

    if (station.id === "grinder") {
      ctx.fillStyle = "#222d35";
      ctx.fillRect(p.x - 18, p.y - station.height + 12, 36, 44);
      ctx.fillStyle = "#5d7482";
      ctx.beginPath();
      ctx.moveTo(p.x - 14, p.y - station.height + 12);
      ctx.lineTo(p.x + 14, p.y - station.height + 12);
      ctx.lineTo(p.x + 8, p.y - station.height - 18);
      ctx.lineTo(p.x - 8, p.y - station.height - 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#a16e4e";
      ctx.fillRect(p.x + 12, p.y - station.height + 34, 22, 5);
    }

    if (station.id === "espresso_machine") {
      ctx.fillStyle = "#d8dee6";
      ctx.fillRect(p.x - 34, p.y - station.height + 6, 68, 38);
      ctx.fillStyle = "#1f2020";
      ctx.fillRect(p.x - 30, p.y - station.height + 16, 60, 12);
      ctx.fillStyle = "#ffbc57";
      ctx.fillRect(p.x - 22, p.y - station.height + 32, 10, 6);
      ctx.fillRect(p.x - 5, p.y - station.height + 32, 10, 6);
      ctx.fillRect(p.x + 12, p.y - station.height + 32, 10, 6);
      ctx.fillStyle = "#4b372b";
      ctx.fillRect(p.x - 6, p.y - station.height + 44, 22, 5);
    }

    if (station.id === "steam_wand") {
      ctx.fillStyle = "#c5d0d7";
      ctx.fillRect(p.x - 22, p.y - station.height + 12, 44, 34);
      ctx.strokeStyle = "#d8f6ff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x + 10, p.y - station.height + 12);
      ctx.lineTo(p.x + 22, p.y - station.height - 26);
      ctx.stroke();
      ctx.fillStyle = "#90a6b3";
      ctx.fillRect(p.x - 10, p.y - station.height + 46, 20, 16);
    }

    if (station.id === "water_tap") {
      ctx.fillStyle = "#b8c9d8";
      ctx.fillRect(p.x - 14, p.y - station.height + 6, 28, 48);
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y - station.height + 10);
      ctx.lineTo(p.x + 18, p.y - station.height + 10);
      ctx.lineTo(p.x + 18, p.y - station.height + 22);
      ctx.lineTo(p.x + 8, p.y - station.height + 22);
      ctx.lineTo(p.x + 8, p.y - station.height + 38);
      ctx.strokeStyle = "#d9f4ff";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = "#4fd3db";
      ctx.fillRect(p.x - 8, p.y - station.height + 44, 16, 8);
    }

    if (station.id === "syrup_rail") {
      ["#f29b68", "#f5d98f", "#df7285"].forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(p.x - 26 + index * 18, p.y - station.height + 8, 12, 34);
        ctx.fillStyle = "#f1f7fa";
        ctx.fillRect(p.x - 24 + index * 18, p.y - station.height + 4, 8, 6);
      });
    }

    if (station.id === "topping_bar") {
      ctx.fillStyle = "#eef2f7";
      ctx.fillRect(p.x - 24, p.y - station.height + 10, 16, 34);
      ctx.fillRect(p.x + 8, p.y - station.height + 10, 16, 34);
      ctx.fillStyle = "#ffefe6";
      ctx.beginPath();
      ctx.arc(p.x - 16, p.y - station.height + 8, 8, Math.PI, 0);
      ctx.arc(p.x + 16, p.y - station.height + 8, 8, Math.PI, 0);
      ctx.fill();
    }

    if (station.id === "service_counter") {
      ctx.fillStyle = "#f1f4fb";
      ctx.fillRect(p.x - 32, p.y - station.height + 8, 64, 16);
      ctx.fillStyle = "#151b21";
      ctx.fillRect(p.x - 18, p.y - station.height + 24, 36, 18);
      ctx.fillStyle = "#4fd3db";
      ctx.fillRect(p.x - 10, p.y - station.height + 29, 20, 6);
      ctx.fillStyle = "rgba(255, 188, 87, 0.18)";
      ctx.beginPath();
      ctx.arc(p.x, p.y + 6, 48, 0, Math.PI * 2);
      ctx.fill();
    }

    const hover = getNearbyStation();
    if (hover && hover.id === station.id) {
      ctx.strokeStyle = "rgba(255, 188, 87, 0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - station.height - 8);
      ctx.lineTo(p.x + 36, p.y - station.height + 10);
      ctx.lineTo(p.x, p.y - station.height + 30);
      ctx.lineTo(p.x - 36, p.y - station.height + 10);
      ctx.closePath();
      ctx.stroke();
    }

    roundedRect(p.x - 60, p.y - station.height - 36, 120, 24, 10, "rgba(7,16,24,0.88)");
    ctx.fillStyle = "#f1f7fa";
    ctx.font = "bold 11px Trebuchet MS";
    ctx.fillText(station.label || station.name.toUpperCase(), p.x - 48, p.y - station.height - 18);
  }

  function drawAvatar(centerX, baseY, colors, isPlayer) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(centerX, baseY + 14, 24, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colors.pants;
    ctx.fillRect(centerX - 14, baseY - 18, 12, 28);
    ctx.fillRect(centerX + 2, baseY - 18, 12, 28);
    ctx.fillStyle = colors.shirt;
    ctx.fillRect(centerX - 18, baseY - 52, 36, 34);
    ctx.fillStyle = colors.skin;
    ctx.fillRect(centerX - 21, baseY - 49, 6, 22);
    ctx.fillRect(centerX + 15, baseY - 49, 6, 22);

    if (colors.apron) {
      ctx.fillStyle = colors.apron;
      ctx.fillRect(centerX - 10, baseY - 48, 20, 30);
      ctx.fillStyle = "#c7d1de";
      ctx.fillRect(centerX - 10, baseY - 46, 20, 5);
    }

    ctx.fillStyle = colors.skin;
    ctx.fillRect(centerX - 17, baseY - 86, 34, 32);
    ctx.fillStyle = colors.hair || "#20160f";
    ctx.fillRect(centerX - 17, baseY - 92, 34, 14);
    ctx.fillRect(centerX - 17, baseY - 84, 8, 10);
    ctx.fillStyle = "#1f1b18";
    ctx.fillRect(centerX - 8, baseY - 74, 4, 4);
    ctx.fillRect(centerX + 4, baseY - 74, 4, 4);
    ctx.fillStyle = isPlayer ? "#ff8a3d" : "#20160f";
    ctx.fillRect(centerX - 6, baseY - 64, 12, 3);
  }

  function drawSpeechBubble(x, y, text) {
    const lines = text.split("\n");
    roundedRect(x, y, 120, 46, 14, "rgba(7,15,23,0.92)");
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, 120, 46);
    ctx.fillStyle = "#edf5f7";
    ctx.font = "bold 13px Trebuchet MS";
    ctx.fillText(lines[0], x + 12, y + 16);
    ctx.fillStyle = "#9ab1bc";
    ctx.font = "12px Trebuchet MS";
    ctx.fillText(lines[1], x + 12, y + 32);
  }

  function drawPlayer() {
    const p = isoToScreen(player.tileX, player.tileY);
    const bob = Math.sin(performance.now() * 0.008) * 2;
    drawAvatar(p.x, p.y - 4 + bob, {
      skin: "#d5a07e",
      shirt: "#ffbc57",
      pants: "#24384b",
      apron: "#f1f4fb",
      hair: "#20160f"
    }, true);

    if (state.activeCup) {
      ctx.fillStyle = "#f8efe5";
      ctx.fillRect(p.x + 10, p.y - 56 + bob, 14, 14);
      ctx.fillStyle = "#5d392b";
      ctx.fillRect(p.x + 11, p.y - 48 + bob, 12, 3);
    }
  }

  function drawCustomer(customer, tile) {
    const p = isoToScreen(tile.x, tile.y);
    const bob = Math.sin((performance.now() * 0.006) + tile.x) * 1.5;
    drawAvatar(p.x, p.y - 2 + bob, {
      skin: customer.colors.skin,
      shirt: customer.colors.shirt,
      pants: customer.colors.pants,
      hair: "#1b1511"
    }, false);
    drawSpeechBubble(p.x + 22, p.y - 106 + bob, `${customer.name}\n${recipeMap[customer.recipeKey].name}`);
  }

  function drawTaskHalo() {
    if (!player.currentTask) {
      return;
    }
    const p = isoToScreen(player.tileX, player.tileY);
    const progress = player.taskTime / player.taskDuration;
    ctx.strokeStyle = "rgba(255, 188, 87, 0.9)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 80, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.stroke();
    ctx.fillStyle = "#edf5f7";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText(actionMeta[player.currentTask].label, p.x - 50, p.y - 120);
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function drawFloatingText() {
    state.floatingText.forEach((item) => {
      ctx.globalAlpha = Math.min(1, item.life);
      ctx.fillStyle = item.color;
      ctx.font = "bold 22px Gill Sans";
      ctx.fillText(item.text, item.x, item.y);
      ctx.globalAlpha = 1;
    });
  }

  function drawHudHints() {
    const width = canvas.clientWidth;
    roundedRect(width - 272, 24, 248, 104, 20, "rgba(7, 16, 24, 0.76)");
    ctx.fillStyle = "#ffbc57";
    ctx.font = "bold 14px Trebuchet MS";
    ctx.fillText("Controls", width - 244, 48);
    ctx.fillStyle = "#edf5f7";
    ctx.font = "13px Trebuchet MS";
    ctx.fillText("Move: click floor or WASD", width - 244, 72);
    ctx.fillText("Action: click button or press 1-3", width - 244, 92);
    ctx.fillText("Serve: stand at counter, press 1", width - 244, 112);
  }

  function render() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    drawBackdrop();
    drawFloor();
    drawDecor();

    const renderables = [];
    stations.forEach((station) => renderables.push({ type: "station", z: station.tile.x + station.tile.y, entity: station }));
    state.customers.forEach((customer, index) => {
      const tile = queueTile(index);
      renderables.push({ type: "customer", z: tile.x + tile.y + 0.2, entity: customer, tile });
    });
    renderables.push({ type: "player", z: player.tileX + player.tileY + 0.2, entity: player });
    renderables.sort((a, b) => a.z - b.z);

    renderables.forEach((item) => {
      if (item.type === "station") drawStation(item.entity);
      if (item.type === "customer") drawCustomer(item.entity, item.tile);
      if (item.type === "player") drawPlayer();
    });

    drawTaskHalo();
    drawParticles();
    drawFloatingText();
    drawHudHints();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    origin.x = rect.width / 2;
    origin.y = 155;
  }

  function initAudio() {
    if (audio) {
      audio.enabled = true;
      if (audio.context.state === "suspended") {
        audio.context.resume();
      }
      return;
    }

    const context = new (window.AudioContext || window.webkitAudioContext)();
    const master = context.createGain();
    master.gain.value = 0.38;
    master.connect(context.destination);

    const ambience = context.createGain();
    ambience.gain.value = 0.06;
    ambience.connect(master);

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.14;
    }

    const noise = context.createBufferSource();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 450;
    noise.buffer = noiseBuffer;
    noise.loop = true;
    noise.connect(filter).connect(ambience);
    noise.start();

    audio = {
      context,
      master,
      enabled: true,
      ambienceTimer: window.setInterval(() => {
        if (!audio || !audio.enabled) {
          return;
        }
        const now = context.currentTime;
        const pad = context.createOscillator();
        const lift = context.createOscillator();
        const padGain = context.createGain();
        pad.type = "sine";
        lift.type = "triangle";
        pad.frequency.setValueAtTime(196, now);
        lift.frequency.setValueAtTime(392, now);
        padGain.gain.setValueAtTime(0.0001, now);
        padGain.gain.exponentialRampToValueAtTime(0.04, now + 0.08);
        padGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
        pad.connect(padGain);
        lift.connect(padGain);
        padGain.connect(master);
        pad.start(now);
        lift.start(now);
        pad.stop(now + 1.7);
        lift.stop(now + 1.7);
      }, 4500)
    };
  }

  function playSfx(kind) {
    if (!audio || !audio.enabled) {
      return;
    }
    const now = audio.context.currentTime;
    const gain = audio.context.createGain();
    gain.connect(audio.master);

    if (kind === "steam") {
      const buffer = audio.context.createBuffer(1, audio.context.sampleRate * 0.3, audio.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * 0.22;
      }
      const noise = audio.context.createBufferSource();
      const filter = audio.context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 500;
      noise.buffer = buffer;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      noise.connect(filter).connect(gain);
      noise.start(now);
      noise.stop(now + 0.3);
      return;
    }

    const osc = audio.context.createOscillator();
    osc.type = {
      serve: "triangle",
      arrive: "sine",
      error: "sawtooth",
      close: "triangle",
      leave: "square",
      trash: "square",
      cup: "triangle"
    }[kind] || "square";

    const config = {
      brew: { freq: 180, end: 120, dur: 0.2, vol: 0.13 },
      cup: { freq: 640, end: 720, dur: 0.12, vol: 0.12 },
      serve: { freq: 660, end: 990, dur: 0.28, vol: 0.16 },
      arrive: { freq: 420, end: 520, dur: 0.2, vol: 0.1 },
      error: { freq: 220, end: 180, dur: 0.22, vol: 0.12 },
      leave: { freq: 180, end: 140, dur: 0.18, vol: 0.09 },
      trash: { freq: 120, end: 90, dur: 0.15, vol: 0.09 },
      close: { freq: 440, end: 240, dur: 0.8, vol: 0.1 }
    }[kind] || { freq: 240, end: 280, dur: 0.15, vol: 0.08 };

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(config.vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.dur);
    osc.connect(gain);
    osc.frequency.setValueAtTime(config.freq, now);
    osc.frequency.exponentialRampToValueAtTime(config.end, now + config.dur);
    osc.start(now);
    osc.stop(now + config.dur);
  }

  function startShift() {
    initAudio();
    state.started = true;
    state.gameOver = false;
    state.paused = false;
    state.view = "game";
    state.score = 0;
    state.coins = 0;
    state.reputation = 100;
    state.customersServed = 0;
    state.failedOrders = 0;
    state.combo = 1;
    state.shiftRemaining = state.shiftLength;
    state.spawnCooldown = 2;
    state.customers = [];
    state.activeCup = null;
    state.uiRefresh = 0;
    state.particles = [];
    state.floatingText = [];
    player.tileX = 4;
    player.tileY = 5;
    player.targetX = 4;
    player.targetY = 5;
    player.currentTask = null;
    ui.overlay.style.display = "none";
    flashMessage("Shift started", "#8be28f");
    playSfx("arrive");
    syncUi();
  }

  function handleCanvasClick(event) {
    if (state.view !== "game" || state.paused) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const targetStation = stations.find((station) => {
      const stationPoint = isoToScreen(station.tile.x, station.tile.y);
      return Math.abs(stationPoint.x - x) < 56 && Math.abs((stationPoint.y - station.height / 2) - y) < 68;
    });
    if (targetStation) {
      setMoveTarget(targetStation.interactionTile.x, targetStation.interactionTile.y);
      return;
    }
    const tile = screenToTile(x, y);
    if (isInBounds(tile.x, tile.y) && canMoveTo(tile.x, tile.y)) {
      setMoveTarget(tile.x, tile.y);
    }
  }

  function handleKeyDown(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key) && state.view === "game" && !state.paused) {
      state.keys.add(key);
      event.preventDefault();
    }
    if (["1", "2", "3"].includes(key) && state.view === "game" && !state.paused) {
      const station = getNearbyStation();
      if (station) {
        const actions = station.id === "service_counter" ? ["serve"] : station.actions;
        const action = actions[Number(key) - 1];
        if (action) {
          startTask(action);
        }
      }
    }
    if (key === " " && state.view === "game" && !state.paused) {
      const station = getNearbyStation();
      if (station) {
        const actions = station.id === "service_counter" ? ["serve"] : station.actions;
        if (actions[0]) {
          startTask(actions[0]);
        }
      }
      event.preventDefault();
    }
  }

  function handleKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    state.keys.delete(key);
  }

  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(gameLoop);
  }

  ui.startButton.addEventListener("click", startShift);
  ui.stopButton.addEventListener("click", stopShift);
  ui.gameTabButton.addEventListener("click", () => setView("game"));
  ui.trainingTabButton.addEventListener("click", () => setView("training"));
  ui.soundButton.addEventListener("click", () => {
    if (!audio) {
      initAudio();
    } else {
      audio.enabled = !audio.enabled;
      if (audio.enabled && audio.context.state === "suspended") {
        audio.context.resume();
      }
    }
    syncUi();
  });
  ui.trashButton.addEventListener("click", trashCup);
  canvas.addEventListener("click", handleCanvasClick);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("pointerdown", () => {
    if (audio && audio.context.state === "suspended") {
      audio.context.resume();
    }
  });
  window.addEventListener("resize", resizeCanvas);

  buildRecipeBoard();
  buildSideMenuList();
  buildSourceBoard();
  resizeCanvas();
  syncUi();
  requestAnimationFrame(gameLoop);
}());
