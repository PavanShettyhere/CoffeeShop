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
      avatarHairStyle: document.getElementById("avatarHairStyle"),
      avatarAccessory: document.getElementById("avatarAccessory"),
      avatarApply: document.getElementById("avatarApplyButton"),
      avatarReset: document.getElementById("avatarResetButton"),
      skinSwatches: document.getElementById("skinSwatches"),
      shirtSwatches: document.getElementById("shirtSwatches"),
      pantsSwatches: document.getElementById("pantsSwatches"),
      hairSwatches: document.getElementById("hairSwatches"),
      eyeSwatches: document.getElementById("eyeSwatches"),
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
      const isWoman = profile.gender === "woman";
      const isMan = profile.gender === "man";
      const torsoWidth = isMan ? 138 : (isWoman ? 112 : 124);
      const torsoHeight = isWoman ? 98 : 90;
      const headRadius = isWoman ? 48 : 52;
      const shoulderSpread = isMan ? 76 : (isWoman ? 58 : 66);
      const waistSpread = isMan ? 52 : (isWoman ? 40 : 46);
      const hipSpread = isWoman ? 58 : (isMan ? 44 : 50);
      const armOffset = isMan ? 78 : 70;
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
      ctx.moveTo(x - shoulderSpread, y - 44);
      ctx.lineTo(x + shoulderSpread, y - 44);
      ctx.lineTo(x + waistSpread, y - 2);
      ctx.lineTo(x + hipSpread, y + torsoHeight - 54);
      ctx.lineTo(x - hipSpread, y + torsoHeight - 54);
      ctx.lineTo(x - waistSpread, y - 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = profile.apron;
      ctx.beginPath();
      ctx.roundRect(x - (isWoman ? 26 : 30), y - 34, isWoman ? 52 : 60, 82, 18);
      ctx.fill();
      ctx.fillStyle = profile.skin;
      ctx.beginPath();
      ctx.roundRect(x - armOffset, y - 34, 12, 52, 6);
      ctx.roundRect(x + armOffset - 12, y - 34, 12, 52, 6);
      ctx.fill();
      drawPreviewHair(ctx, profile, x, y, headRadius, "back");
      ctx.beginPath();
      ctx.arc(x, y - 102, headRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - 98, headRadius - 7, headRadius - 9, 0, 0, Math.PI * 2);
      ctx.fill();
      drawPreviewHair(ctx, profile, x, y, headRadius, "front");
      if (profile.cap === "barista") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 42, y - 156, 84, 24, 10);
        ctx.fill();
        ctx.fillRect(x - 4, y - 136, 56, 8);
      } else if (profile.cap === "visor") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 40, y - 148, 80, 16, 8);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 10, y - 132);
        ctx.lineTo(x + 54, y - 126);
        ctx.lineTo(x + 10, y - 120);
        ctx.closePath();
        ctx.fill();
      } else if (profile.cap === "beanie") {
        ctx.fillStyle = profile.hair;
        ctx.beginPath();
        ctx.roundRect(x - 40, y - 154, 80, 34, 16);
        ctx.fill();
      } else if (profile.cap === "beret") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.ellipse(x - 10, y - 142, 48, 20, -0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (profile.cap === "snapback") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 44, y - 154, 88, 24, 10);
        ctx.fill();
        ctx.fillRect(x + 14, y - 136, 34, 6);
      } else if (profile.cap === "headwrap") {
        ctx.fillStyle = "#f0a24d";
        ctx.beginPath();
        ctx.roundRect(x - 44, y - 156, 88, 28, 14);
        ctx.fill();
        ctx.fillStyle = "#f7c27b";
        ctx.fillRect(x - 8, y - 154, 16, 26);
      }
      drawPreviewAccessory(ctx, profile, x, y, headRadius);
      ctx.fillStyle = profile.eyeColor || "#3b2a1e";
      ctx.beginPath();
      ctx.ellipse(x - 16, y - 102, 7, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 16, y - 102, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - 14, y - 104, 2, 0, Math.PI * 2);
      ctx.arc(x + 18, y - 104, 2, 0, Math.PI * 2);
      ctx.fill();
      if (isWoman) {
        ctx.strokeStyle = "#1d1714";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 23, y - 110);
        ctx.lineTo(x - 9, y - 108);
        ctx.moveTo(x + 9, y - 108);
        ctx.lineTo(x + 23, y - 110);
        ctx.stroke();
      }
      ctx.fillStyle = "#cf7b7b";
      ctx.fillRect(x - 10, y - 76, 20, 4);
    }

    function drawPreviewHair(ctx, profile, x, y, headRadius, layer) {
      const hair = profile.hair;
      ctx.fillStyle = hair;
      if (profile.hairStyle === "bob") {
        if (layer === "back") {
          ctx.beginPath();
          ctx.roundRect(x - headRadius - 8, y - 126, (headRadius + 8) * 2, 60, 18);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.arc(x, y - 118, headRadius + 4, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius - 6, y - 104);
        ctx.lineTo(x - headRadius + 6, y - 104);
        ctx.closePath();
        ctx.fill();
      } else if (profile.hairStyle === "ponytail") {
        if (layer === "back") {
          ctx.fillRect(x + 28, y - 108, 20, 62);
          ctx.beginPath();
          ctx.roundRect(x - headRadius - 4, y - 128, (headRadius + 4) * 2, 52, 18);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.arc(x, y - 118, headRadius + 3, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius - 6, y - 104);
        ctx.lineTo(x - headRadius + 6, y - 104);
        ctx.closePath();
        ctx.fill();
      } else if (profile.hairStyle === "bun") {
        if (layer === "back") {
          ctx.beginPath();
          ctx.roundRect(x - headRadius - 3, y - 124, (headRadius + 3) * 2, 50, 18);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + 2, y - 154, 18, 0, Math.PI * 2);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.arc(x, y - 118, headRadius + 2, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius - 5, y - 104);
        ctx.lineTo(x - headRadius + 5, y - 104);
        ctx.closePath();
        ctx.fill();
      } else if (profile.hairStyle === "braid") {
        if (layer === "back") {
          ctx.fillRect(x + 26, y - 108, 12, 84);
          ctx.beginPath();
          ctx.roundRect(x - headRadius - 3, y - 124, (headRadius + 3) * 2, 50, 18);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.arc(x, y - 118, headRadius + 2, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius - 5, y - 104);
        ctx.lineTo(x - headRadius + 5, y - 104);
        ctx.closePath();
        ctx.fill();
      } else if (profile.hairStyle === "long") {
        if (layer === "back") {
          ctx.beginPath();
          ctx.roundRect(x - headRadius - 8, y - 126, (headRadius + 8) * 2, 96, 20);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.arc(x, y - 118, headRadius + 4, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius - 5, y - 106);
        ctx.lineTo(x - headRadius + 5, y - 106);
        ctx.closePath();
        ctx.fill();
      } else if (profile.hairStyle === "fade") {
        if (layer === "back") return;
        ctx.beginPath();
        ctx.arc(x, y - 120, headRadius - 6, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius - 6, y - 100);
        ctx.lineTo(x - headRadius + 6, y - 100);
        ctx.closePath();
        ctx.fill();
      } else if (profile.hairStyle === "quiff") {
        if (layer === "back") return;
        ctx.beginPath();
        ctx.arc(x, y - 114, headRadius + 4, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius + 4, y - 92);
        ctx.lineTo(x - headRadius + 12, y - 86);
        ctx.lineTo(x - headRadius - 4, y - 92);
        ctx.closePath();
        ctx.fill();
      } else if (profile.hairStyle === "curly") {
        if (layer === "back") {
          for (let i = -2; i <= 2; i += 1) {
            ctx.beginPath();
            ctx.arc(x + i * 18, y - 122 + Math.abs(i) * 2, 16, 0, Math.PI * 2);
            ctx.fill();
          }
          return;
        }
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath();
          ctx.arc(x + i * 12, y - 122 + Math.abs(i) * 1, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (profile.hairStyle === "slick") {
        if (layer === "back") return;
        ctx.beginPath();
        ctx.ellipse(x, y - 118, headRadius + 6, 26, -0.18, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius, y - 92);
        ctx.lineTo(x - headRadius, y - 98);
        ctx.closePath();
        ctx.fill();
      } else if (profile.hairStyle === "wave") {
        if (layer === "back") {
          ctx.beginPath();
          ctx.roundRect(x - headRadius - 6, y - 126, (headRadius + 6) * 2, 64, 18);
          ctx.fill();
          return;
        }
        ctx.beginPath();
        ctx.arc(x, y - 118, headRadius + 3, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius - 7, y - 104);
        ctx.lineTo(x - headRadius + 7, y - 104);
        ctx.closePath();
        ctx.fill();
      } else {
        if (layer === "back") return;
        ctx.beginPath();
        ctx.arc(x, y - 112, headRadius + 2, Math.PI, Math.PI * 2);
        ctx.lineTo(x + headRadius + 2, y - 88);
        ctx.lineTo(x - headRadius - 2, y - 88);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawPreviewAccessory(ctx, profile, x, y, headRadius) {
      if (profile.accessory === "flower") {
        const petalColors = ["#f7d85a", "#f08fb1", "#f7d85a", "#f08fb1"];
        petalColors.forEach((color, index) => {
          const angle = (Math.PI / 2) * index;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x + 34 + Math.cos(angle) * 8, y - 132 + Math.sin(angle) * 8, 8, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#fff2c9";
        ctx.beginPath();
        ctx.arc(x + 34, y - 132, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (profile.accessory === "clip") {
        ctx.fillStyle = "#dce8ff";
        ctx.fillRect(x + headRadius - 8, y - 126, 20, 8);
      } else if (profile.accessory === "ribbon") {
        ctx.fillStyle = "#ff8fb6";
        ctx.beginPath();
        ctx.moveTo(x + 32, y - 134);
        ctx.lineTo(x + 50, y - 126);
        ctx.lineTo(x + 36, y - 116);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 32, y - 134);
        ctx.lineTo(x + 14, y - 126);
        ctx.lineTo(x + 28, y - 116);
        ctx.closePath();
        ctx.fill();
      } else if (profile.accessory === "band") {
        ctx.fillStyle = "#d2d7de";
        ctx.fillRect(x - headRadius, y - 122, headRadius * 2, 6);
      } else if (profile.accessory === "stud") {
        ctx.fillStyle = "#eef6ff";
        ctx.beginPath();
        ctx.arc(x - headRadius + 6, y - 90, 3, 0, Math.PI * 2);
        ctx.fill();
      }
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
