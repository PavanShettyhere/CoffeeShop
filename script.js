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
    sourceList: document.getElementById("sourceList"),
    overlay: document.getElementById("overlayCard"),
    startButton: document.getElementById("startButton"),
    soundButton: document.getElementById("soundButton"),
    trashButton: document.getElementById("trashButton")
  };

  const TILE_W = 94;
  const TILE_H = 46;
  const GRID_W = 9;
  const GRID_H = 9;
  const origin = { x: 700, y: 155 };

  const actionMeta = {
    cup_espresso: { label: "Espresso Cup", detail: "Grab a small ceramic espresso cup." },
    cup_tulip: { label: "Tulip Cup", detail: "Grab a balanced café cup for milk drinks." },
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
    { key: "espresso", name: "Espresso", price: 6, patience: 88, stationNote: "A focused shot with crema in a small cup.", tools: "Cup wall, grinder, espresso machine", sequence: ["cup_espresso", "grind", "espresso"] },
    { key: "americano", name: "Caffè Americano", price: 8, patience: 92, stationNote: "Hot water first, then two espresso shots.", tools: "Cup wall, water tap, grinder, espresso machine", sequence: ["cup_mug", "hot_water", "grind", "espresso", "espresso"] },
    { key: "cappuccino", name: "Classic Cappuccino", price: 10, patience: 98, stationNote: "Espresso with milk and a generous foam cap.", tools: "Cup wall, grinder, espresso machine, steam wand", sequence: ["cup_tulip", "grind", "espresso", "steam_milk", "foam_cap"] },
    { key: "latte", name: "Caffè Latte", price: 11, patience: 104, stationNote: "Espresso finished with steamed milk and a light foam layer.", tools: "Cup wall, grinder, espresso machine, steam wand", sequence: ["cup_tulip", "grind", "espresso", "steam_milk"] },
    { key: "flat_white", name: "Flat White", price: 12, patience: 108, stationNote: "Two ristretto shots and velvety microfoam.", tools: "Cup wall, grinder, espresso machine, steam wand", sequence: ["cup_tulip", "grind", "ristretto", "ristretto", "microfoam"] },
    { key: "mocha", name: "Caffè Mocha", price: 13, patience: 112, stationNote: "Mocha sauce, espresso, milk, then whipped cream.", tools: "Cup wall, syrup rail, grinder, espresso machine, steam wand, topping bar", sequence: ["cup_mug", "mocha_sauce", "grind", "espresso", "steam_milk", "whip"] }
  ];

  const recipeMap = Object.fromEntries(recipes.map((recipe) => [recipe.key, recipe]));

  const stations = [
    { id: "cups", name: "Cup Wall", description: "Pick the right vessel before you start building the drink.", tile: { x: 1, y: 2 }, interactionTile: { x: 2, y: 2 }, height: 74, color: "#bc9164", accent: "#ffcf87", actions: ["cup_espresso", "cup_tulip", "cup_mug"] },
    { id: "grinder", name: "Precision Grinder", description: "Fresh grounds first. Espresso drinks start here.", tile: { x: 2, y: 4 }, interactionTile: { x: 2, y: 5 }, height: 82, color: "#6a7785", accent: "#4fd3db", actions: ["grind"] },
    { id: "espresso_machine", name: "Aurora Espresso", description: "Pull standard shots or shorter ristretto shots.", tile: { x: 4, y: 3 }, interactionTile: { x: 4, y: 4 }, height: 90, color: "#8c5d47", accent: "#ff8a3d", actions: ["espresso", "ristretto"] },
    { id: "steam_wand", name: "Steam Wand", description: "Steam milk, build airy foam, or groom microfoam.", tile: { x: 6, y: 3 }, interactionTile: { x: 6, y: 4 }, height: 88, color: "#6c808f", accent: "#b7eff5", actions: ["steam_milk", "foam_cap", "microfoam"] },
    { id: "water_tap", name: "Water Tap", description: "Only used for americanos. Water goes in before the shots.", tile: { x: 7, y: 2 }, interactionTile: { x: 7, y: 3 }, height: 74, color: "#4c6d86", accent: "#7fe1ff", actions: ["hot_water"] },
    { id: "syrup_rail", name: "Syrup Rail", description: "Mocha sauce for chocolate builds.", tile: { x: 7, y: 5 }, interactionTile: { x: 6, y: 5 }, height: 74, color: "#83575c", accent: "#ffc46d", actions: ["mocha_sauce"] },
    { id: "topping_bar", name: "Topping Bar", description: "Finish mochas with whipped cream.", tile: { x: 5, y: 6 }, interactionTile: { x: 5, y: 5 }, height: 68, color: "#68735f", accent: "#f0f4ff", actions: ["whip"] },
    { id: "service_counter", name: "Service Counter", description: "Serve the front customer when the drink is complete.", tile: { x: 4, y: 7 }, interactionTile: { x: 4, y: 6 }, height: 78, color: "#846851", accent: "#ffbc57", actions: ["serve"] }
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

  function queueTile(index) {
    const queue = [
      { x: 4, y: 8 },
      { x: 3, y: 8 },
      { x: 5, y: 8 },
      { x: 2, y: 8 }
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

    const station = getNearbyStation();
    ui.actionList.innerHTML = "";
    if (!station) {
      ui.stationTitle.textContent = "Walk up to a machine";
      ui.stationDescription.textContent = "Machines expose different drink actions when you are in range.";
    } else {
      ui.stationTitle.textContent = station.name;
      ui.stationDescription.textContent = station.description;
      const actions = station.id === "service_counter" ? ["serve"] : station.actions;
      actions.forEach((actionKey, index) => {
        const button = document.createElement("button");
        button.className = "action-button";
        button.disabled = !state.started || !!player.currentTask;
        button.innerHTML = `<strong>${index + 1}. ${actionMeta[actionKey].label}</strong><span>${actionMeta[actionKey].detail}</span>`;
        button.addEventListener("click", () => startTask(actionKey));
        ui.actionList.appendChild(button);
      });
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
            <span>${recipe.price} coins</span>
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
  }

  function startTask(actionKey) {}

  function serveFrontCustomer() {}

  function trashCup() {}

  function updateMovement() {}

  function updateTask() {}

  function updateParticles() {}

  function update() {}

  function render() {}
}());
