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
      gameTab: document.getElementById("gameTabButton"),
      trainingTab: document.getElementById("trainingTabButton"),
      gameView: document.getElementById("gameView"),
      trainingView: document.getElementById("trainingView"),
      overlay: document.getElementById("overlayCard"),
      stationTitle: document.getElementById("stationTitle"),
      stationDescription: document.getElementById("stationDescription"),
      actionList: document.getElementById("actionList"),
      cupTitle: document.getElementById("cupTitle"),
      cupSubtitle: document.getElementById("cupSubtitle"),
      cupProgress: document.getElementById("cupProgress"),
      ordersList: document.getElementById("ordersList"),
      recipeList: document.getElementById("recipeList"),
      boardClock: document.getElementById("boardClock"),
      boardDay: document.getElementById("boardDay"),
      boardDate: document.getElementById("boardDate"),
      boardRows: document.getElementById("boardRows"),
      trainingGrid: document.getElementById("trainingGrid"),
      sourceList: document.getElementById("sourceList"),
      canvas: document.getElementById("gameCanvas")
    };

    const cache = { actionSig: "", cupSig: "", orderSig: "", boardRows: {}, menuRows: {} };
    const game = Game.createGame({ canvas: ui.canvas, onStateChange: renderState });

    function setView(view) {
      ui.gameTab.classList.toggle("is-active", view === "game");
      ui.trainingTab.classList.toggle("is-active", view === "training");
      ui.gameView.classList.toggle("is-active", view === "game");
      ui.trainingView.classList.toggle("is-active", view === "training");
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
      Data.recipes.forEach((recipe) => {
        const row = document.createElement("div");
        row.className = "menu-board__row";
        row.innerHTML = `
          <div class="menu-board__name">
            <span>${recipe.boardLabel}</span>
            <span class="menu-board__dots">....................................</span>
          </div>
          <span data-price></span>
        `;
        ui.boardRows.appendChild(row);
        cache.boardRows[recipe.key] = row.querySelector("[data-price]");
      });
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
        cache.menuRows[recipe.key] = card.querySelector("[data-price]");
        ui.recipeList.appendChild(card);
      });
    }

    function updateBoard() {
      const parts = game.getDateParts();
      ui.boardClock.textContent = parts.time;
      ui.boardDay.textContent = parts.day;
      ui.boardDate.textContent = parts.date;
      Data.recipes.forEach((recipe) => {
        const price = game.formatEuro(game.getLivePrice(recipe, Date.now()));
        if (cache.boardRows[recipe.key]) cache.boardRows[recipe.key].textContent = price;
        if (cache.menuRows[recipe.key]) cache.menuRows[recipe.key].textContent = price;
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

    buildTraining();
    buildSources();
    buildBoard();
    buildSidebarMenu();
    updateBoard();
    renderState(game.getSnapshot());
    window.setInterval(updateBoard, 1000);
  });
}(window));
