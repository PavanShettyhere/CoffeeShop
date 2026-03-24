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
    const STORAGE_KEY = "velvet-pour-avatar";
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
      gameView: document.getElementById("gameView"),
      trainingView: document.getElementById("trainingView"),
      avatarView: document.getElementById("avatarView"),
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
      avatarApply: document.getElementById("avatarApplyButton"),
      avatarReset: document.getElementById("avatarResetButton"),
      skinSwatches: document.getElementById("skinSwatches"),
      shirtSwatches: document.getElementById("shirtSwatches"),
      pantsSwatches: document.getElementById("pantsSwatches"),
      hairSwatches: document.getElementById("hairSwatches"),
      apronSwatches: document.getElementById("apronSwatches")
    };

    const cache = { actionSig: "", cupSig: "", orderSig: "", boardSlots: [], menuRows: {} };
    const game = Game.createGame({ canvas: ui.canvas, onStateChange: renderState });
    let avatarDraft = null;

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
      ui.gameView.classList.toggle("is-active", view === "game");
      ui.trainingView.classList.toggle("is-active", view === "training");
      ui.avatarView.classList.toggle("is-active", view === "avatar");
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
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...Data.avatarOptions.defaultProfile };
        return { ...Data.avatarOptions.defaultProfile, ...JSON.parse(raw) };
      } catch (error) {
        return { ...Data.avatarOptions.defaultProfile };
      }
    }

    function saveAvatarProfile(profile) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }

    function renderAvatarPreview(profile) {
      const ctx = ui.avatarCanvas.getContext("2d");
      const width = ui.avatarCanvas.width;
      const height = ui.avatarCanvas.height;
      ctx.clearRect(0, 0, width, height);
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#223b4f");
      grad.addColorStop(1, "#101922");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.arc(width / 2, 150, 120, 0, Math.PI * 2);
      ctx.fill();

      const x = width / 2;
      const y = 270;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(x, y + 70, 80, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      if (profile.lowerWear === "skirt" || profile.lowerWear === "pleated") {
        ctx.fillStyle = profile.pants;
        ctx.beginPath();
        ctx.moveTo(x - 44, y + 8);
        ctx.lineTo(x + 44, y + 8);
        ctx.lineTo(x + 62, y + 78);
        ctx.lineTo(x - 62, y + 78);
        ctx.closePath();
        ctx.fill();
        if (profile.lowerWear === "pleated") {
          ctx.strokeStyle = "rgba(255,255,255,0.22)";
          ctx.lineWidth = 3;
          for (let i = -32; i <= 32; i += 16) {
            ctx.beginPath();
            ctx.moveTo(x + i, y + 16);
            ctx.lineTo(x + i + 6, y + 70);
            ctx.stroke();
          }
        }
        ctx.fillStyle = shadePreview(profile.pants, -20);
        ctx.fillRect(x - 26, y + 62, 14, 54);
        ctx.fillRect(x + 12, y + 62, 14, 54);
        ctx.fillStyle = "#161a1f";
        ctx.fillRect(x - 28, y + 112, 18, 10);
        ctx.fillRect(x + 10, y + 112, 18, 10);
      } else if (profile.lowerWear === "wide" || profile.lowerWear === "culottes") {
        ctx.fillStyle = shadePreview(profile.pants, -8);
        ctx.fillRect(x - 50, y + 12, 30, 104);
        ctx.fillRect(x + 20, y + 12, 30, 104);
        ctx.fillStyle = "#161a1f";
        ctx.fillRect(x - 52, y + 112, 34, 10);
        ctx.fillRect(x + 18, y + 112, 34, 10);
      } else if (profile.lowerWear === "joggers" || profile.lowerWear === "apron_pants") {
        ctx.fillStyle = shadePreview(profile.pants, -18);
        ctx.beginPath();
        ctx.roundRect(x - 42, y + 14, 24, 98, 12);
        ctx.roundRect(x + 18, y + 14, 24, 98, 12);
        ctx.fill();
        ctx.fillStyle = shadePreview(profile.pants, 12);
        ctx.fillRect(x - 42, y + 8, 24, 8);
        ctx.fillRect(x + 18, y + 8, 24, 8);
        ctx.fillStyle = "#161a1f";
        ctx.fillRect(x - 44, y + 108, 28, 10);
        ctx.fillRect(x + 16, y + 108, 28, 10);
      } else {
        ctx.fillStyle = profile.pants;
        ctx.fillRect(x - 42, y + 18, 26, 88);
        ctx.fillRect(x + 16, y + 18, 26, 88);
        ctx.fillStyle = "#161a1f";
        ctx.fillRect(x - 44, y + 102, 30, 10);
        ctx.fillRect(x + 14, y + 102, 30, 10);
      }
      ctx.fillStyle = profile.shirt;
      ctx.beginPath();
      ctx.roundRect(x - 62, y - 48, 124, 92, 24);
      ctx.fill();
      ctx.fillStyle = profile.apron;
      ctx.beginPath();
      ctx.roundRect(x - 30, y - 34, 60, 82, 18);
      ctx.fill();
      ctx.fillStyle = profile.skin;
      ctx.beginPath();
      ctx.roundRect(x - 74, y - 34, 12, 52, 6);
      ctx.roundRect(x + 62, y - 34, 12, 52, 6);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 102, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = profile.hair;
      ctx.beginPath();
      ctx.arc(x, y - 112, 54, Math.PI, Math.PI * 2);
      ctx.lineTo(x + 54, y - 86);
      ctx.lineTo(x - 54, y - 86);
      ctx.closePath();
      ctx.fill();
      if (profile.cap === "barista") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 54, y - 156, 108, 26, 10);
        ctx.fill();
        ctx.fillRect(x - 18, y - 132, 56, 10);
      } else if (profile.cap === "visor") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 44, y - 148, 88, 18, 8);
        ctx.fill();
        ctx.fillRect(x - 12, y - 132, 48, 8);
      } else if (profile.cap === "beanie") {
        ctx.fillStyle = profile.hair;
        ctx.beginPath();
        ctx.roundRect(x - 46, y - 156, 92, 38, 14);
        ctx.fill();
      } else if (profile.cap === "beret") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 50, y - 154, 96, 22, 12);
        ctx.fill();
        ctx.fillRect(x - 8, y - 132, 12, 10);
      } else if (profile.cap === "snapback") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 52, y - 154, 104, 26, 10);
        ctx.fill();
        ctx.fillRect(x + 8, y - 132, 34, 8);
      } else if (profile.cap === "headwrap") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 52, y - 160, 104, 34, 16);
        ctx.fill();
      }
      ctx.fillStyle = "#1c1714";
      ctx.fillRect(x - 18, y - 100, 10, 4);
      ctx.fillRect(x + 8, y - 100, 10, 4);
      ctx.fillStyle = "#cf7b7b";
      ctx.fillRect(x - 10, y - 76, 20, 4);
    }

    function shadePreview(hex, amount) {
      const raw = parseInt(hex.replace("#", ""), 16);
      const r = Math.max(0, Math.min(255, (raw >> 16) + amount));
      const g = Math.max(0, Math.min(255, ((raw >> 8) & 255) + amount));
      const b = Math.max(0, Math.min(255, (raw & 255) + amount));
      return `rgb(${r}, ${g}, ${b})`;
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
      markSelectedSwatch(ui.apronSwatches, avatarDraft.apron);
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
      buildSwatches(ui.apronSwatches, Data.avatarOptions.aprons, "apron");

      ui.avatarGender.addEventListener("change", () => {
        avatarDraft.gender = ui.avatarGender.value;
        populateLowerWearOptions(avatarDraft.gender, avatarDraft.lowerWear);
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

    function updateBoard() {
      const parts = game.getDateParts();
      setFlipText(ui.boardTitle, "HOT DRINKS");
      setFlipText(ui.boardClock, parts.time);
      setFlipText(ui.boardDay, parts.day);
      setFlipText(ui.boardDate, parts.date);
      const now = Date.now();
      const priced = Data.recipes.map((recipe) => {
        const livePrice = game.getLivePrice(recipe, now);
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
        ui.overlay.innerHTML = `<div class="eyebrow">Shift Complete</div><h2>${snapshot.reputation <= 0 ? "The cafe lost confidence" : "Doors closed for today"}</h2><p>Score ${snapshot.score}, coins ${snapshot.coins}, served ${snapshot.customersServed}, rank ${snapshot.rank}.</p><p class="overlay-tip">Start Shift to run a new day.</p>`;
        ui.overlay.style.display = "block";
        return;
      }
      if (!snapshot.started) {
        ui.overlay.innerHTML = `<div class="eyebrow">Shift Briefing</div><h2>Open The Cafe</h2><p>Move through the room, build the requested drinks on the correct machines, and serve them at the front counter.</p><p class="overlay-tip">Start Shift unlocks audio and begins the customer rush.</p>`;
        ui.overlay.style.display = "block";
        return;
      }
      if (snapshot.paused) {
        ui.overlay.innerHTML = `<div class="eyebrow">Training Mode</div><h2>Shift paused</h2><p>The live queue is paused while you are in the Coffee Trainee Zone.</p><p class="overlay-tip">Switch back to Game Zone to continue.</p>`;
        ui.overlay.style.display = "block";
        return;
      }
      ui.overlay.style.display = "none";
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

    buildTraining();
    buildSources();
    buildBoard();
    buildSidebarMenu();
    buildAvatarStudio();
    const savedProfile = loadAvatarProfile();
    syncAvatarForm(savedProfile);
    game.setPlayerProfile(savedProfile);
    updateBoard();
    renderState(game.getSnapshot());
    window.setInterval(updateBoard, 60000);
    global.__VelvetPourApp = { game, setView };
  });
}(window));
