(function (global) {
  const Data = global.VelvetPourData;
  const Game = global.VelvetPourGame;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    const AVATAR_STORAGE_KEY = "velvet-pour-avatar";
    const RESTAURANT_STORAGE_KEY = "velvet-pour-restaurant";
    const ui = {
      score: document.getElementById("scoreValue"),
      coins: document.getElementById("coinsValue"),
      reputation: document.getElementById("reputationValue"),
      shift: document.getElementById("shiftValue"),
      served: document.getElementById("servedValue"),
      combo: document.getElementById("comboValue"),
      rank: document.getElementById("rankValue"),
      start: document.getElementById("startButton"),
      stop: document.getElementById("stopButton"),
      sound: document.getElementById("soundButton"),
      trash: document.getElementById("trashButton"),
      moreMenu: document.querySelector(".more-menu"),
      gameTab: document.getElementById("gameTabButton"),
      trainingTab: document.getElementById("trainingTabButton"),
      avatarTab: document.getElementById("avatarTabButton"),
      restaurantTab: document.getElementById("restaurantTabButton"),
      gameView: document.getElementById("gameView"),
      trainingView: document.getElementById("trainingView"),
      avatarView: document.getElementById("avatarView"),
      restaurantView: document.getElementById("restaurantView"),
      overlay: document.getElementById("overlayCard"),
      stationTitle: document.getElementById("stationTitle"),
      stationDescription: document.getElementById("stationDescription"),
      actionList: document.getElementById("actionList"),
      cupTitle: document.getElementById("cupTitle"),
      cupSubtitle: document.getElementById("cupSubtitle"),
      cupProgress: document.getElementById("cupProgress"),
      ordersList: document.getElementById("ordersList"),
      recipeList: document.getElementById("recipeList"),
      boardTitle: document.getElementById("boardTitle"),
      boardClock: document.getElementById("boardClock"),
      boardDay: document.getElementById("boardDay"),
      boardDate: document.getElementById("boardDate"),
      boardRows: document.getElementById("boardRows"),
      trainingGrid: document.getElementById("trainingGrid"),
      sourceList: document.getElementById("sourceList"),
      canvas: document.getElementById("gameCanvas"),
      avatarCanvas: document.getElementById("avatarCanvas"),
      avatarForm: document.getElementById("avatarForm"),
      avatarGender: document.getElementById("avatarGender"),
      avatarCap: document.getElementById("avatarCap"),
      avatarLowerWear: document.getElementById("avatarLowerWear"),
      avatarHairStyle: document.getElementById("avatarHairStyle"),
      avatarAccessory: document.getElementById("avatarAccessory"),
      avatarApply: document.getElementById("avatarApplyButton"),
      avatarReset: document.getElementById("avatarResetButton"),
      skinSwatches: document.getElementById("skinSwatches"),
      shirtSwatches: document.getElementById("shirtSwatches"),
      pantsSwatches: document.getElementById("pantsSwatches"),
      hairSwatches: document.getElementById("hairSwatches"),
      eyeSwatches: document.getElementById("eyeSwatches"),
      apronSwatches: document.getElementById("apronSwatches"),
      restaurantForm: document.getElementById("restaurantForm"),
      restaurantWallTheme: document.getElementById("restaurantWallTheme"),
      restaurantFloorTheme: document.getElementById("restaurantFloorTheme"),
      restaurantTableCount: document.getElementById("restaurantTableCount"),
      restaurantTableStyle: document.getElementById("restaurantTableStyle"),
      restaurantMachineFinish: document.getElementById("restaurantMachineFinish"),
      restaurantCounterStyle: document.getElementById("restaurantCounterStyle"),
      restaurantDone: document.getElementById("restaurantDoneButton"),
      restaurantReset: document.getElementById("restaurantResetButton"),
      restaurantSummary: document.getElementById("restaurantSummary")
    };

    const cache = { actionSig: "", cupSig: "", orderSig: "", boardSlots: [], menuRows: {} };
    const game = Game.createGame({ canvas: ui.canvas, onStateChange: renderState });
    let avatarDraft = null;
    let restaurantDraft = null;

    function normalizeGlyph(symbol) {
      return symbol === " " ? "\u00a0" : symbol;
    }

    function buildGlyph(symbol) {
      const glyph = document.createElement("span");
      glyph.className = "flip-glyph";
      glyph.dataset.symbol = symbol;
      glyph.innerHTML = `
        <span class="flip-glyph__static flip-glyph__static--top"><span>${normalizeGlyph(symbol)}</span></span>
        <span class="flip-glyph__static flip-glyph__static--bottom"><span>${normalizeGlyph(symbol)}</span></span>
        <span class="flip-glyph__flap flip-glyph__flap--top"><span>${normalizeGlyph(symbol)}</span></span>
        <span class="flip-glyph__flap flip-glyph__flap--bottom"><span>${normalizeGlyph(symbol)}</span></span>
      `;
      return glyph;
    }

    function paintGlyph(glyph, currentSymbol, nextSymbol) {
      glyph.dataset.symbol = currentSymbol;
      glyph.setAttribute("data-symbol", currentSymbol);
      glyph.querySelector(".flip-glyph__static--top span").textContent = normalizeGlyph(currentSymbol);
      glyph.querySelector(".flip-glyph__static--bottom span").textContent = normalizeGlyph(currentSymbol);
      glyph.querySelector(".flip-glyph__flap--top span").textContent = normalizeGlyph(currentSymbol);
      glyph.querySelector(".flip-glyph__flap--bottom span").textContent = normalizeGlyph(nextSymbol);
    }

    function animateGlyph(glyph, nextSymbol) {
      const currentSymbol = glyph.dataset.symbol || " ";
      if (currentSymbol === nextSymbol) return;
      if (glyph._flipTimer) window.clearTimeout(glyph._flipTimer);
      paintGlyph(glyph, currentSymbol, nextSymbol);
      glyph.classList.remove("is-animating");
      void glyph.offsetWidth;
      glyph.classList.add("is-animating");
      glyph._flipTimer = window.setTimeout(() => {
        glyph.classList.remove("is-animating");
        paintGlyph(glyph, nextSymbol, nextSymbol);
      }, 390);
    }

    function setFlipText(node, value) {
      if (!node) return;
      const chars = Array.from(String(value));
      const glyphs = Array.from(node.children);
      node.classList.add("flip-display");
      if (glyphs.length !== chars.length) {
        node.textContent = "";
        chars.forEach((symbol) => {
          const glyph = buildGlyph(symbol);
          paintGlyph(glyph, symbol, symbol);
          node.appendChild(glyph);
        });
        return;
      }
      chars.forEach((symbol, index) => {
        animateGlyph(glyphs[index], symbol);
      });
    }

    function setText(node, value) {
      if (!node) return;
      if (node.textContent !== value) node.textContent = value;
    }

    function closeMoreMenu() {
      if (ui.moreMenu) ui.moreMenu.open = false;
    }

    function setView(view) {
      ui.gameTab.classList.toggle("is-active", view === "game");
      ui.trainingTab.classList.toggle("is-active", view === "training");
      ui.avatarTab.classList.toggle("is-active", view === "avatar");
      ui.restaurantTab.classList.toggle("is-active", view === "restaurant");
      ui.gameView.classList.toggle("is-active", view === "game");
      ui.trainingView.classList.toggle("is-active", view === "training");
      ui.avatarView.classList.toggle("is-active", view === "avatar");
      ui.restaurantView.classList.toggle("is-active", view === "restaurant");
      closeMoreMenu();
      game.setView(view);
    }

    function buildTraining() {
      Data.recipes.forEach((recipe) => {
        const card = document.createElement("article");
        card.className = "training-card";
        card.innerHTML = `
          <div class="eyebrow">${recipe.boardLabel}</div>
          <h3>${recipe.name}</h3>
          <div class="training-meta">${recipe.cupName} | ${game.formatEuro(recipe.basePrice)}</div>
          <p>${recipe.note}</p>
          <p>${recipe.trainerTip}</p>
          <p><strong>Tools:</strong> ${recipe.tools}</p>
        `;
        const list = document.createElement("ul");
        recipe.steps.forEach((step) => {
          const li = document.createElement("li");
          li.textContent = step;
          list.appendChild(li);
        });
        card.appendChild(list);
        ui.trainingGrid.appendChild(card);
      });
    }

    function buildSources() {
      Data.sources.forEach((source) => {
        const row = document.createElement("div");
        row.className = "source-link";
        row.innerHTML = `<a href="${source.href}" target="_blank" rel="noreferrer">${source.label}</a>`;
        ui.sourceList.appendChild(row);
      });
    }

    function buildBoard() {
      for (let index = 0; index < Data.recipes.length; index += 1) {
        const row = document.createElement("div");
        row.className = "menu-board__row";
        row.innerHTML = `
          <span data-name class="flip-value"></span>
          <span data-price class="flip-value"></span>
        `;
        ui.boardRows.appendChild(row);
        cache.boardSlots.push({
          row,
          nameNode: row.querySelector("[data-name]"),
          priceNode: row.querySelector("[data-price]")
        });
      }
    }

    function buildSidebarMenu() {
      Data.recipes.forEach((recipe) => {
        const card = document.createElement("div");
        card.className = "recipe-card";
        card.innerHTML = `
          <h3>${recipe.name}</h3>
          <div class="order-meta">
            <span>${recipe.cupName}</span>
            <span data-price></span>
          </div>
          <p>${recipe.note}</p>
        `;
        cache.menuRows[recipe.key] = {
          row: card,
          priceNode: card.querySelector("[data-price]")
        };
        ui.recipeList.appendChild(card);
      });
    }

    function loadAvatarProfile() {
      try {
        const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY);
        if (!raw) return { ...Data.avatarOptions.defaultProfile };
        return { ...Data.avatarOptions.defaultProfile, ...JSON.parse(raw) };
      } catch (error) {
        return { ...Data.avatarOptions.defaultProfile };
      }
    }

    function saveAvatarProfile(profile) {
      window.localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(profile));
    }

    function loadRestaurantProfile() {
      try {
        const raw = window.localStorage.getItem(RESTAURANT_STORAGE_KEY);
        if (!raw) return { ...Data.restaurantOptions.defaultProfile };
        return { ...Data.restaurantOptions.defaultProfile, ...JSON.parse(raw) };
      } catch (error) {
        return { ...Data.restaurantOptions.defaultProfile };
      }
    }

    function saveRestaurantProfile(profile) {
      window.localStorage.setItem(RESTAURANT_STORAGE_KEY, JSON.stringify(profile));
    }

    function renderAvatarPreview(profile) {
      game.renderAvatarPreview(ui.avatarCanvas, profile);
    }

    function markSelectedSwatch(container, value) {
      Array.from(container.querySelectorAll(".swatch")).forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.value === value);
      });
    }

    function buildSwatches(container, values, key) {
      values.forEach((value) => {
        const button = document.createElement("button");
        button.className = "swatch";
        button.type = "button";
        button.dataset.value = value;
        button.style.setProperty("--swatch", value);
        button.addEventListener("click", () => {
          avatarDraft[key] = value;
          markSelectedSwatch(container, value);
          renderAvatarPreview(avatarDraft);
        });
        container.appendChild(button);
      });
    }

    function syncAvatarForm(profile) {
      avatarDraft = { ...profile };
      ui.avatarGender.value = avatarDraft.gender;
      ui.avatarCap.value = avatarDraft.cap;
      populateLowerWearOptions(avatarDraft.gender, avatarDraft.lowerWear);
      markSelectedSwatch(ui.skinSwatches, avatarDraft.skin);
      markSelectedSwatch(ui.shirtSwatches, avatarDraft.shirt);
      markSelectedSwatch(ui.pantsSwatches, avatarDraft.pants);
      markSelectedSwatch(ui.hairSwatches, avatarDraft.hair);
      markSelectedSwatch(ui.eyeSwatches, avatarDraft.eyeColor);
      markSelectedSwatch(ui.apronSwatches, avatarDraft.apron);
      populateHairStyleOptions(avatarDraft.gender, avatarDraft.hairStyle);
      populateAccessoryOptions(avatarDraft.gender, avatarDraft.accessory);
      renderAvatarPreview(avatarDraft);
    }

    function populateLowerWearOptions(gender, selectedValue) {
      const options = Data.avatarOptions.lowerWearByGender[gender] || Data.avatarOptions.lowerWearByGender.neutral;
      ui.avatarLowerWear.innerHTML = "";
      options.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        ui.avatarLowerWear.appendChild(option);
      });
      ui.avatarLowerWear.value = options.some((entry) => entry.value === selectedValue) ? selectedValue : options[0].value;
      avatarDraft.lowerWear = ui.avatarLowerWear.value;
    }

    function populateHairStyleOptions(gender, selectedValue) {
      const options = Data.avatarOptions.hairStylesByGender[gender] || Data.avatarOptions.hairStylesByGender.neutral;
      ui.avatarHairStyle.innerHTML = "";
      options.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        ui.avatarHairStyle.appendChild(option);
      });
      ui.avatarHairStyle.value = options.some((entry) => entry.value === selectedValue) ? selectedValue : options[0].value;
      avatarDraft.hairStyle = ui.avatarHairStyle.value;
    }

    function populateAccessoryOptions(gender, selectedValue) {
      const options = Data.avatarOptions.accessoriesByGender[gender] || Data.avatarOptions.accessoriesByGender.neutral;
      ui.avatarAccessory.innerHTML = "";
      options.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        ui.avatarAccessory.appendChild(option);
      });
      ui.avatarAccessory.value = options.some((entry) => entry.value === selectedValue) ? selectedValue : options[0].value;
      avatarDraft.accessory = ui.avatarAccessory.value;
    }

    function buildAvatarStudio() {
      Data.avatarOptions.genders.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        ui.avatarGender.appendChild(option);
      });
      Data.avatarOptions.caps.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        ui.avatarCap.appendChild(option);
      });
      buildSwatches(ui.skinSwatches, Data.avatarOptions.skinTones, "skin");
      buildSwatches(ui.shirtSwatches, Data.avatarOptions.shirts, "shirt");
      buildSwatches(ui.pantsSwatches, Data.avatarOptions.pants, "pants");
      buildSwatches(ui.hairSwatches, Data.avatarOptions.hair, "hair");
      buildSwatches(ui.eyeSwatches, Data.avatarOptions.eyeColors, "eyeColor");
      buildSwatches(ui.apronSwatches, Data.avatarOptions.aprons, "apron");

      ui.avatarGender.addEventListener("change", () => {
        avatarDraft.gender = ui.avatarGender.value;
        populateLowerWearOptions(avatarDraft.gender, avatarDraft.lowerWear);
        populateHairStyleOptions(avatarDraft.gender, avatarDraft.hairStyle);
        populateAccessoryOptions(avatarDraft.gender, avatarDraft.accessory);
        renderAvatarPreview(avatarDraft);
      });
      ui.avatarCap.addEventListener("change", () => {
        avatarDraft.cap = ui.avatarCap.value;
        renderAvatarPreview(avatarDraft);
      });
      ui.avatarLowerWear.addEventListener("change", () => {
        avatarDraft.lowerWear = ui.avatarLowerWear.value;
        renderAvatarPreview(avatarDraft);
      });
      ui.avatarHairStyle.addEventListener("change", () => {
        avatarDraft.hairStyle = ui.avatarHairStyle.value;
        renderAvatarPreview(avatarDraft);
      });
      ui.avatarAccessory.addEventListener("change", () => {
        avatarDraft.accessory = ui.avatarAccessory.value;
        renderAvatarPreview(avatarDraft);
      });

      ui.avatarForm.addEventListener("submit", (event) => {
        event.preventDefault();
        game.setPlayerProfile(avatarDraft);
        saveAvatarProfile(avatarDraft);
        setView("game");
      });

      ui.avatarReset.addEventListener("click", () => {
        syncAvatarForm({ ...Data.avatarOptions.defaultProfile });
      });
    }

    function renderRestaurantSummary(profile) {
      const wallLabel = Data.restaurantOptions.wallThemes.find((entry) => entry.value === profile.wallTheme)?.label || profile.wallTheme;
      const floorLabel = Data.restaurantOptions.floorThemes.find((entry) => entry.value === profile.floorTheme)?.label || profile.floorTheme;
      const tableLabel = Data.restaurantOptions.tableCounts.find((entry) => entry.value === profile.tableCount)?.label || profile.tableCount;
      const tableStyle = Data.restaurantOptions.tableStyles.find((entry) => entry.value === profile.tableStyle)?.label || profile.tableStyle;
      const machineFinish = Data.restaurantOptions.machineFinishes.find((entry) => entry.value === profile.machineFinish)?.label || profile.machineFinish;
      const counterStyle = Data.restaurantOptions.counterStyles.find((entry) => entry.value === profile.counterStyle)?.label || profile.counterStyle;
      ui.restaurantSummary.innerHTML = `
        <div class="summary-pill"><strong>Walls</strong><span>${wallLabel}</span></div>
        <div class="summary-pill"><strong>Floor</strong><span>${floorLabel}</span></div>
        <div class="summary-pill"><strong>Tables</strong><span>${tableLabel} · ${tableStyle}</span></div>
        <div class="summary-pill"><strong>Machines</strong><span>${machineFinish}</span></div>
        <div class="summary-pill"><strong>Counter</strong><span>${counterStyle}</span></div>
      `;
    }

    function syncRestaurantForm(profile) {
      restaurantDraft = { ...profile };
      ui.restaurantWallTheme.value = restaurantDraft.wallTheme;
      ui.restaurantFloorTheme.value = restaurantDraft.floorTheme;
      ui.restaurantTableCount.value = restaurantDraft.tableCount;
      ui.restaurantTableStyle.value = restaurantDraft.tableStyle;
      ui.restaurantMachineFinish.value = restaurantDraft.machineFinish;
      ui.restaurantCounterStyle.value = restaurantDraft.counterStyle;
      renderRestaurantSummary(restaurantDraft);
    }

    function applyRestaurantDraft(save) {
      game.setRestaurantProfile(restaurantDraft);
      renderRestaurantSummary(restaurantDraft);
      if (save) saveRestaurantProfile(restaurantDraft);
    }

    function buildRestaurantSelect(selectNode, options) {
      options.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.value;
        option.textContent = entry.label;
        selectNode.appendChild(option);
      });
    }

    function buildRestaurantStudio() {
      buildRestaurantSelect(ui.restaurantWallTheme, Data.restaurantOptions.wallThemes);
      buildRestaurantSelect(ui.restaurantFloorTheme, Data.restaurantOptions.floorThemes);
      buildRestaurantSelect(ui.restaurantTableCount, Data.restaurantOptions.tableCounts);
      buildRestaurantSelect(ui.restaurantTableStyle, Data.restaurantOptions.tableStyles);
      buildRestaurantSelect(ui.restaurantMachineFinish, Data.restaurantOptions.machineFinishes);
      buildRestaurantSelect(ui.restaurantCounterStyle, Data.restaurantOptions.counterStyles);

      [
        ["wallTheme", ui.restaurantWallTheme],
        ["floorTheme", ui.restaurantFloorTheme],
        ["tableCount", ui.restaurantTableCount],
        ["tableStyle", ui.restaurantTableStyle],
        ["machineFinish", ui.restaurantMachineFinish],
        ["counterStyle", ui.restaurantCounterStyle]
      ].forEach(([key, node]) => {
        node.addEventListener("change", () => {
          restaurantDraft[key] = node.value;
          applyRestaurantDraft(true);
        });
      });

      ui.restaurantForm.addEventListener("submit", (event) => {
        event.preventDefault();
        applyRestaurantDraft(true);
        setView("game");
      });

      ui.restaurantReset.addEventListener("click", () => {
        syncRestaurantForm({ ...Data.restaurantOptions.defaultProfile });
        applyRestaurantDraft(true);
      });
    }

    function updateBoard() {
      const parts = game.getDateParts();
      setFlipText(ui.boardTitle, "HOT DRINKS");
      setFlipText(ui.boardClock, parts.time);
      setFlipText(ui.boardDay, parts.day);
      setFlipText(ui.boardDate, parts.date);
      const now = Date.now();
      const boardMinute = Math.floor(now / 60000) * 60000;
      const priced = Data.recipes.map((recipe) => {
        const livePrice = game.getLivePrice(recipe, boardMinute);
        return {
          recipe,
          livePrice,
          priceLabel: game.formatEuro(livePrice)
        };
      }).sort((a, b) => b.livePrice - a.livePrice);

      priced.forEach((entry, index) => {
        const boardRow = cache.boardSlots[index];
        const menuRow = cache.menuRows[entry.recipe.key];
        if (boardRow) {
          setFlipText(boardRow.nameNode, entry.recipe.boardLabel);
          setFlipText(boardRow.priceNode, entry.priceLabel);
        }
        if (menuRow) {
          setText(menuRow.priceNode, entry.priceLabel);
          ui.recipeList.appendChild(menuRow.row);
        }
      });
    }

    function renderActions(snapshot) {
      const sig = [
        snapshot.currentStation ? snapshot.currentStation.id : "none",
        snapshot.availableActions.join(","),
        snapshot.started ? 1 : 0,
        snapshot.paused ? 1 : 0,
        snapshot.view
      ].join("|");
      if (cache.actionSig === sig) return;
      cache.actionSig = sig;
      ui.actionList.innerHTML = "";
      if (!snapshot.currentStation) {
        ui.stationTitle.textContent = snapshot.view === "training" ? "Training mode active" : "Walk up to a machine";
        ui.stationDescription.textContent = snapshot.view === "training"
          ? "Switch back to Game Zone when you want to work the floor."
          : "Each machine exposes the actions you can perform there.";
        return;
      }
      ui.stationTitle.textContent = snapshot.currentStation.name;
      ui.stationDescription.textContent = snapshot.currentStation.description;
      snapshot.availableActions.forEach((actionKey, index) => {
        const button = document.createElement("button");
        button.className = "action-button";
        button.type = "button";
        button.disabled = !snapshot.started || snapshot.paused || snapshot.gameOver;
        button.innerHTML = `<strong>${index + 1}. ${Data.actionMeta[actionKey].label}</strong><span>${Data.actionMeta[actionKey].detail}</span>`;
        button.addEventListener("click", () => game.doAction(actionKey));
        ui.actionList.appendChild(button);
      });
    }

    function renderCup(snapshot) {
      const sig = snapshot.activeCup ? snapshot.activeCup.steps.join("|") : "none";
      if (cache.cupSig === sig) return;
      cache.cupSig = sig;
      ui.cupProgress.innerHTML = "";
      if (!snapshot.activeCup) {
        ui.cupTitle.textContent = "No drink in hand";
        ui.cupSubtitle.textContent = "Grab a cup from the cup wall to begin.";
        return;
      }
      ui.cupTitle.textContent = snapshot.activeCup.bestMatch ? `Building: ${snapshot.activeCup.bestMatch.name}` : "Experimental drink";
      ui.cupSubtitle.textContent = `${snapshot.activeCup.steps.length} step${snapshot.activeCup.steps.length === 1 ? "" : "s"} in the cup`;
      snapshot.activeCup.steps.forEach((step, index) => {
        const chip = document.createElement("div");
        chip.className = "progress-chip";
        chip.innerHTML = `<strong>${index + 1}. ${Data.actionMeta[step].label}</strong><span>${Data.actionMeta[step].detail}</span>`;
        ui.cupProgress.appendChild(chip);
      });
    }

    function renderOrders(snapshot) {
      const sig = snapshot.customers.map((entry) => `${entry.id}:${Math.round(entry.patience)}`).join("|");
      if (cache.orderSig === sig) return;
      cache.orderSig = sig;
      ui.ordersList.innerHTML = "";
      if (!snapshot.customers.length) {
        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = "<h3>No customers in line</h3><p>The front counter is clear right now.</p>";
        ui.ordersList.appendChild(card);
        return;
      }
      snapshot.customers.forEach((customer) => {
        const card = document.createElement("div");
        card.className = "order-card";
        card.innerHTML = `
          <h3>${customer.front ? "Front" : "Queue"}: ${customer.name}</h3>
          <div class="order-meta"><span>${customer.recipeName}</span><span>${customer.priceLabel}</span></div>
          <p>${customer.note}</p>
          <div class="order-meta"><span>${Math.ceil(customer.patience)} patience</span><span>${customer.front ? "Counter now" : "Waiting"}</span></div>
          <div class="patience-bar"><i style="width:${(customer.patience / customer.patienceMax) * 100}%"></i></div>
        `;
        ui.ordersList.appendChild(card);
      });
    }

    function renderOverlay(snapshot) {
      if (snapshot.gameOver) {
        ui.overlay.innerHTML = `<strong>${snapshot.reputation <= 0 ? "The cafe lost confidence" : "Doors closed for today"}</strong><span>Score ${snapshot.score}, coins ${snapshot.coins}, served ${snapshot.customersServed}, rank ${snapshot.rank}. Start Shift to run a new day.</span>`;
        ui.overlay.dataset.state = "alert";
        return;
      }
      if (!snapshot.started) {
        ui.overlay.innerHTML = "<strong>Open The Cafe</strong><span>Move through the room, build the requested drinks on the correct machines, and serve them at the front counter. Start Shift unlocks audio and begins the customer rush.</span>";
        ui.overlay.dataset.state = "default";
        return;
      }
      if (snapshot.paused) {
        ui.overlay.innerHTML = "<strong>Shift paused</strong><span>The live queue is paused while you are in a studio or trainee view. Switch back to Game Zone to continue.</span>";
        ui.overlay.dataset.state = "alert";
        return;
      }
      ui.overlay.innerHTML = "<strong>Shift live</strong><span>Work the stations on the left wall, finish the drink, and serve the first customer at the front counter.</span>";
      ui.overlay.dataset.state = "live";
    }

    function renderState(snapshot) {
      ui.score.textContent = snapshot.score;
      ui.coins.textContent = snapshot.coins;
      ui.reputation.textContent = snapshot.reputation;
      ui.shift.textContent = snapshot.shiftLabel;
      ui.served.textContent = snapshot.customersServed;
      ui.combo.textContent = snapshot.comboLabel;
      ui.rank.textContent = snapshot.rank;
      ui.sound.textContent = `Sound: ${snapshot.soundEnabled ? "On" : "Off"}`;
      ui.stop.disabled = !snapshot.started && !snapshot.gameOver && !snapshot.paused;
      renderActions(snapshot);
      renderCup(snapshot);
      renderOrders(snapshot);
      renderOverlay(snapshot);
    }

    ui.start.addEventListener("click", game.startShift);
    ui.stop.addEventListener("click", game.stopShift);
    ui.sound.addEventListener("click", game.toggleSound);
    ui.trash.addEventListener("click", game.trashCup);
    ui.gameTab.addEventListener("click", () => setView("game"));
    ui.trainingTab.addEventListener("click", () => setView("training"));
    ui.avatarTab.addEventListener("click", () => setView("avatar"));
    ui.restaurantTab.addEventListener("click", () => setView("restaurant"));

    buildTraining();
    buildSources();
    buildBoard();
    buildSidebarMenu();
    buildAvatarStudio();
    buildRestaurantStudio();
    const savedProfile = loadAvatarProfile();
    const savedRestaurant = loadRestaurantProfile();
    syncAvatarForm(savedProfile);
    syncRestaurantForm(savedRestaurant);
    game.setPlayerProfile(savedProfile);
    game.setRestaurantProfile(savedRestaurant);
    updateBoard();
    renderState(game.getSnapshot());
    window.setInterval(updateBoard, 60000);
    global.__VelvetPourApp = { game, setView };
  });
}(window));
