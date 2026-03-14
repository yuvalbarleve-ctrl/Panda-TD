(function () {
  const PandaTD = (window.PandaTD = window.PandaTD || {});

  class UI {
    constructor(game) {
      this.game = game;
      this.selectedTowerDomId = null;
      this.selectedAbilityIds = [];
      this.elements = this.cache();
      this.bind();
      this.populateMenus();
      this.showScreen("homeScreen");
      game.onStateChange = () => this.refresh();
      game.onGameOver = (result) => this.showGameOver(result);
      this.refresh();
    }

    cache() {
      return {
        overlay: document.getElementById("screenOverlay"),
        onePlayerBtn: document.getElementById("onePlayerBtn"),
        mapOptions: document.getElementById("mapOptions"),
        difficultyOptions: document.getElementById("difficultyOptions"),
        restartBtn: document.getElementById("restartBtn"),
        backToMenuBtn: document.getElementById("backToMenuBtn"),
        startWaveBtn: document.getElementById("startWaveBtn"),
        autoStartToggle: document.getElementById("autoStartToggle"),
        speedButtons: Array.from(document.querySelectorAll(".speed-btn")),
        towerButtons: document.getElementById("towerButtons"),
        livesValue: document.getElementById("livesValue"),
        moneyValue: document.getElementById("moneyValue"),
        waveValue: document.getElementById("waveValue"),
        difficultyValue: document.getElementById("difficultyValue"),
        selectedEmpty: document.getElementById("selectedTowerEmpty"),
        selectedPanel: document.getElementById("selectedTowerPanel"),
        selectedTitle: document.getElementById("selectedTowerTitle"),
        selectedStats: document.getElementById("selectedTowerStats"),
        targetingBtn: document.getElementById("targetingBtn"),
        abilityPanel: document.getElementById("abilityPanel"),
        upgradeGrid: document.getElementById("upgradeGrid"),
        sellBtn: document.getElementById("sellBtn"),
        eventFeed: document.getElementById("eventFeed"),
        towerMenuToggle: document.getElementById("towerMenuToggle"),
        towerMenuPanel: document.getElementById("towerMenuPanel"),
        placementHint: document.getElementById("placementHint"),
        waveBanner: document.getElementById("waveBanner"),
        gameOverTitle: document.getElementById("gameOverTitle"),
        gameOverText: document.getElementById("gameOverText")
      };
    }

    bind() {
      this.elements.onePlayerBtn.addEventListener("click", () => this.showScreen("mapScreen"));
      this.elements.restartBtn.addEventListener("click", () => {
        this.game.reset({ mapId: this.game.mapId, difficultyId: this.game.difficulty.id });
        this.hideOverlay();
      });
      this.elements.backToMenuBtn.addEventListener("click", () => {
        this.game.reset({ mapId: PandaTD.MAPS[0].id, difficultyId: "easy" });
        this.showScreen("homeScreen");
      });
      this.elements.startWaveBtn.addEventListener("click", () => this.game.startWave());
      this.elements.autoStartToggle.addEventListener("change", (event) => this.game.setAutoStart(event.target.checked));
      this.elements.speedButtons.forEach((button) => {
        button.addEventListener("click", () => this.game.setSpeed(Number(button.dataset.speed)));
      });
      this.elements.targetingBtn.addEventListener("click", () => {
        if (this.game.selectedTower) {
          this.game.cycleTargeting(this.game.selectedTower);
        }
      });
      this.elements.sellBtn.addEventListener("click", () => {
        if (this.game.selectedTower) {
          this.game.sellTower(this.game.selectedTower);
        }
      });
      this.elements.towerMenuToggle.addEventListener("click", () => {
        this.elements.towerMenuPanel.classList.toggle("hidden");
        this.elements.towerMenuToggle.textContent = this.elements.towerMenuPanel.classList.contains("hidden") ? "Show Towers" : "Hide Towers";
      });
    }

    populateMenus() {
      this.elements.mapOptions.innerHTML = "";
      PandaTD.MAPS.forEach((map) => {
        const button = document.createElement("button");
        button.className = "choice-btn";
        button.innerHTML = "<strong>" + map.name + "</strong><small>" + map.description + "</small>";
        button.addEventListener("click", () => {
          this.game.mapId = map.id;
          this.showScreen("difficultyScreen");
        });
        this.elements.mapOptions.appendChild(button);
      });

      this.elements.difficultyOptions.innerHTML = "";
      Object.values(PandaTD.DIFFICULTIES).forEach((difficulty) => {
        const button = document.createElement("button");
        button.className = "choice-btn";
        button.innerHTML = "<strong>" + difficulty.name + "</strong><small>" + (difficulty.totalWaves ? difficulty.totalWaves + " waves" : "Unlimited scaling") + "</small>";
        button.addEventListener("click", () => {
          this.game.reset({ mapId: this.game.mapId, difficultyId: difficulty.id });
          this.hideOverlay();
        });
        this.elements.difficultyOptions.appendChild(button);
      });

      PandaTD.TOWER_ORDER.forEach((towerId) => {
        const tower = PandaTD.TOWER_DATA[towerId];
        const button = document.createElement("button");
        button.className = "tower-btn";
        button.dataset.towerId = towerId;
        button.innerHTML = "<strong>" + tower.name + "</strong><small>" + tower.description + "</small>";
        button.addEventListener("click", () => this.game.setSelectedTowerType(towerId));
        this.elements.towerButtons.appendChild(button);
      });
    }

    showScreen(id) {
      this.elements.overlay.classList.remove("hidden");
      ["homeScreen", "mapScreen", "difficultyScreen", "gameOverScreen"].forEach((screenId) => {
        document.getElementById(screenId).classList.toggle("active", screenId === id);
      });
    }

    hideOverlay() {
      this.elements.overlay.classList.add("hidden");
    }

    showGameOver(result) {
      this.elements.gameOverTitle.textContent = result.title;
      this.elements.gameOverText.textContent = result.text;
      this.showScreen("gameOverScreen");
    }

    refresh() {
      const state = this.game.getState();
      this.elements.livesValue.textContent = state.lives;
      this.elements.moneyValue.textContent = "$" + state.money;
      this.elements.waveValue.textContent = state.waveLabel;
      this.elements.difficultyValue.textContent = state.difficulty.name;
      this.elements.autoStartToggle.checked = this.game.autoStart;
      this.elements.startWaveBtn.disabled = state.waveInProgress;
      this.elements.waveBanner.textContent = state.waveInProgress ? "Wave " + state.waveNumber + " in progress" : "Wave " + state.waveNumber + " ready";
      this.elements.waveBanner.classList.remove("hidden");
      this.elements.speedButtons.forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.speed) === state.speedMultiplier);
      });
      Array.from(this.elements.towerButtons.children).forEach((button) => {
        const towerId = button.dataset.towerId;
        button.classList.toggle("selected", towerId === state.selectedTowerType);
        button.disabled = this.game.getTowerCost(towerId) > state.money && towerId !== state.selectedTowerType;
        button.querySelector("small").textContent = PandaTD.TOWER_DATA[towerId].description + " Cost: $" + this.game.getTowerCost(towerId);
      });
      if (state.selectedTowerType) {
        const hint = this.game.hoverPoint ? this.game.canPlaceTower(this.game.hoverPoint.x, this.game.hoverPoint.y, state.selectedTowerType).reason : "Click the map to place your tower.";
        this.elements.placementHint.textContent = PandaTD.TOWER_DATA[state.selectedTowerType].name + ": " + hint;
        this.elements.placementHint.classList.remove("hidden");
      } else {
        this.elements.placementHint.classList.add("hidden");
      }
      this.renderSelectedTower();
      this.renderFeed(state.logs);
    }

    renderFeed(logs) {
      this.elements.eventFeed.innerHTML = "";
      logs.forEach((entry) => {
        const item = document.createElement("div");
        item.className = "feed-item";
        item.textContent = entry.message;
        this.elements.eventFeed.appendChild(item);
      });
    }

    renderSelectedTower() {
      const tower = this.game.selectedTower;
      if (!tower) {
        this.selectedTowerDomId = null;
        this.selectedAbilityIds = [];
        this.elements.selectedEmpty.classList.remove("hidden");
        this.elements.selectedPanel.classList.add("hidden");
        this.elements.abilityPanel.innerHTML = "";
        this.elements.upgradeGrid.innerHTML = "";
        return;
      }
      const towerData = PandaTD.TOWER_DATA[tower.type];
      const stats = this.game.getTowerStats(tower);
      const abilities = this.game.getTowerAbilities(tower);
      const towerChanged = this.selectedTowerDomId !== tower.id;
      this.elements.selectedEmpty.classList.add("hidden");
      this.elements.selectedPanel.classList.remove("hidden");
      this.elements.selectedTitle.textContent = towerData.name + " [" + tower.upgrades.join("-") + "]";
      const statRows = [
        "Range: " + Math.round(stats.range || stats.supportRange || 0),
        "Damage: " + Math.round((stats.damage || 0) * 10) / 10,
        "Rate: " + Math.round((stats.fireRate || 0) * 100) / 100 + "/s",
        "Spent: $" + tower.spent,
        "Sell: $" + Math.round(tower.spent * 0.7),
        "Near Water: " + (tower.nearWater ? "Yes" : "No")
      ];
      if (tower.type === "bambooFarm") {
        statRows[1] = "Manual: $" + Math.round(stats.income || 0);
        statRows[2] = "Auto: $" + Math.round(stats.autoIncome || 0);
      }
      this.elements.selectedStats.innerHTML = statRows.map((line) => "<div class='stat-chip'>" + line + "</div>").join("");
      this.elements.targetingBtn.textContent = tower.targetMode;

      if (towerChanged) {
        this.elements.upgradeGrid.innerHTML = "";
        towerData.paths.forEach((path, pathIndex) => {
          const button = document.createElement("button");
          button.className = "upgrade-btn";
          button.dataset.pathIndex = String(pathIndex);
          button.addEventListener("click", () => {
            if (this.game.selectedTower && this.game.selectedTower.id === tower.id) {
              this.game.upgradeTower(this.game.selectedTower, pathIndex);
            }
          });
          this.elements.upgradeGrid.appendChild(button);
        });
      }

      const abilityIds = abilities.map((ability) => ability.id);
      const abilitiesChanged =
        towerChanged ||
        abilityIds.length !== this.selectedAbilityIds.length ||
        abilityIds.some((abilityId, index) => abilityId !== this.selectedAbilityIds[index]);
      if (abilitiesChanged) {
        this.elements.abilityPanel.innerHTML = "";
        abilities.forEach((ability) => {
          const button = document.createElement("button");
          button.className = "ability-btn";
          button.dataset.abilityId = ability.id;
          button.addEventListener("click", () => {
            if (this.game.selectedTower && this.game.selectedTower.id === tower.id) {
              this.game.activateAbility(this.game.selectedTower, ability.id);
            }
          });
          this.elements.abilityPanel.appendChild(button);
        });
      }

      Array.from(this.elements.abilityPanel.children).forEach((button, index) => {
        const ability = abilities[index];
        if (!ability) {
          return;
        }
        const readyAt = tower.abilityState[ability.id] || 0;
        const remaining = Math.max(0, readyAt - this.game.gameTime);
        button.disabled = remaining > 0;
        button.innerHTML = "<strong>" + ability.label + "</strong><div class='ability-note'>" + ability.description + (remaining > 0 ? " Cooldown: " + remaining.toFixed(1) + "s" : " Ready") + "</div>";
      });

      Array.from(this.elements.upgradeGrid.children).forEach((button, pathIndex) => {
        const path = towerData.paths[pathIndex];
        const current = tower.upgrades[pathIndex];
        const nextTier = path.tiers[current];
        button.classList.remove("locked");
        if (!nextTier) {
          button.disabled = true;
          button.classList.add("locked");
          button.innerHTML = "<span class='tier-label'>" + path.name + "</span><span class='tier-meta'>Tier 5 reached</span>";
          return;
        }
        const validation = this.game.canUpgradeTower(tower, pathIndex);
        const cost = this.game.getUpgradeCost(tower, pathIndex);
        button.disabled = !validation.ok;
        if (!validation.ok) {
          button.classList.add("locked");
        }
        button.innerHTML = "<span class='tier-label'>" + path.name + " T" + (current + 1) + ": " + nextTier.name + "</span><span class='tier-meta'>$" + cost + " • " + nextTier.desc + (validation.ok ? "" : " • " + validation.reason) + "</span>";
      });

      this.selectedTowerDomId = tower.id;
      this.selectedAbilityIds = abilityIds;
    }
  }

  PandaTD.UI = UI;
})();
