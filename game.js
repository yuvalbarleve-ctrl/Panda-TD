(function () {
  const PandaTD = (window.PandaTD = window.PandaTD || {});
  const TARGET_MODES = ["First", "Last", "Strong", "Close"];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.map = PandaTD.MAPS[0];
      this.pathCache = PandaTD.MapUtils.buildPathCache(this.map);
      this.lastFrame = 0;
      this.onStateChange = null;
      this.onGameOver = null;
      this.hoverPoint = null;
      this.initInput();
      this.reset();
    }

    reset(config) {
      config = config || {};
      this.mapId = config.mapId || this.mapId || PandaTD.MAPS[0].id;
      this.difficulty = PandaTD.DIFFICULTIES[config.difficultyId || "easy"];
      this.map = PandaTD.MAPS.find((entry) => entry.id === this.mapId) || PandaTD.MAPS[0];
      this.pathCache = PandaTD.MapUtils.buildPathCache(this.map);
      this.money = 500;
      this.lives = 100;
      this.waveNumber = 1;
      this.waveInProgress = false;
      this.wavePending = true;
      this.waveDelay = 0;
      this.autoStart = false;
      this.speedMultiplier = 1;
      this.gameTime = 0;
      this.result = null;
      this.selectedTowerType = null;
      this.selectedTower = null;
      this.spawnQueue = [];
      this.spawnAccumulator = 0;
      this.logs = [];
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.effects = [];
      this.pickups = [];
      this.helpers = [];
      this.devices = [];
      this.log("Valley ready. Choose a panda and prepare the defense.");
      this.emitChange();
    }

    initInput() {
      this.canvas.addEventListener("mousemove", (event) => {
        this.hoverPoint = this.getCanvasPoint(event);
        this.emitChange();
      });
      this.canvas.addEventListener("mouseleave", () => {
        this.hoverPoint = null;
        this.emitChange();
      });
      this.canvas.addEventListener("click", (event) => {
        if (this.result) {
          return;
        }
        const point = this.getCanvasPoint(event);
        if (this.tryCollectPickup(point.x, point.y)) {
          return;
        }
        if (this.selectedTowerType) {
          this.placeTower(point.x, point.y, this.selectedTowerType);
          return;
        }
        this.selectTowerAt(point.x, point.y);
      });
    }

    getCanvasPoint(event) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (this.canvas.width / rect.width),
        y: (event.clientY - rect.top) * (this.canvas.height / rect.height)
      };
    }

    emitChange() {
      if (this.onStateChange) {
        this.onStateChange();
      }
    }

    start() {
      const frame = (timestamp) => {
        if (!this.lastFrame) {
          this.lastFrame = timestamp;
        }
        const dt = clamp((timestamp - this.lastFrame) / 1000, 0, 0.05);
        this.lastFrame = timestamp;
        this.update(dt * this.speedMultiplier);
        this.render();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    log(message) {
      this.logs.unshift({ id: Math.random().toString(36).slice(2), message });
      if (this.logs.length > 18) {
        this.logs.length = 18;
      }
    }

    setSelectedTowerType(towerId) {
      this.selectedTowerType = this.selectedTowerType === towerId ? null : towerId;
      this.selectedTower = null;
      this.emitChange();
    }

    setAutoStart(value) {
      this.autoStart = value;
    }

    setSpeed(value) {
      this.speedMultiplier = value;
      this.emitChange();
    }

    getTowerCost(towerId) {
      return Math.round(PandaTD.TOWER_DATA[towerId].baseCost * this.difficulty.towerCost);
    }

    tryCollectPickup(x, y) {
      for (let i = 0; i < this.pickups.length; i += 1) {
        const pickup = this.pickups[i];
        if (dist(x, y, pickup.x, pickup.y) <= pickup.radius + 8) {
          this.money += pickup.value;
          this.effects.push({ type: "text", x: pickup.x, y: pickup.y, text: "+" + pickup.value, color: "#355d23", ttl: 0.8 });
          this.pickups.splice(i, 1);
          this.log("Collected bamboo income for $" + pickup.value + ".");
          this.emitChange();
          return true;
        }
      }
      return false;
    }

    canPlaceTower(x, y, towerId) {
      const radius = towerId === "bambooFarm" ? 24 : 20;
      if (x < 28 || x > this.map.width - 28 || y < 28 || y > this.map.height - 28) {
        return { valid: false, reason: "Outside map bounds." };
      }
      if (PandaTD.MapUtils.isPointOnPath(this.map, x, y, radius + 6)) {
        return { valid: false, reason: "Cannot place on the path." };
      }
      if (PandaTD.MapUtils.isPointInWater(this.map, x, y, radius + 6)) {
        return { valid: false, reason: "Cannot place on water." };
      }
      if (this.towers.some((tower) => dist(x, y, tower.x, tower.y) <= tower.radius + radius + 8)) {
        return { valid: false, reason: "Too close to another tower." };
      }
      return { valid: true, reason: "Valid placement." };
    }

    placeTower(x, y, towerId) {
      const cost = this.getTowerCost(towerId);
      if (this.money < cost) {
        this.log("Not enough money.");
        this.emitChange();
        return false;
      }
      const placement = this.canPlaceTower(x, y, towerId);
      if (!placement.valid) {
        this.log(placement.reason);
        this.emitChange();
        return false;
      }
      const tower = {
        id: Math.random().toString(36).slice(2),
        type: towerId,
        x,
        y,
        radius: towerId === "bambooFarm" ? 24 : 20,
        upgrades: [0, 0, 0],
        mainPath: null,
        cooldown: 0,
        helperCooldown: 0,
        deviceCooldown: 0,
        targetMode: "First",
        spent: cost,
        nearWater: PandaTD.MapUtils.isNearWater(this.map, x, y, 80),
        rageUntil: 0,
        abilityState: {},
        farmManualTimer: 2,
        farmAutoTimer: 2
      };
      this.money -= cost;
      this.towers.push(tower);
      this.selectedTowerType = null;
      this.selectedTower = tower;
      this.log(PandaTD.TOWER_DATA[towerId].name + " placed.");
      this.emitChange();
      return true;
    }

    selectTowerAt(x, y) {
      this.selectedTower = null;
      for (let i = this.towers.length - 1; i >= 0; i -= 1) {
        if (dist(x, y, this.towers[i].x, this.towers[i].y) <= this.towers[i].radius + 8) {
          this.selectedTower = this.towers[i];
          break;
        }
      }
      this.selectedTowerType = null;
      this.emitChange();
    }

    update(dt) {
      if (this.result) {
        this.updateEffects(dt);
        return;
      }
      this.gameTime += dt;
      this.updateWave(dt);
      this.updateTowers(dt);
      this.updateHelpers(dt);
      this.updateDevices(dt);
      this.updateProjectiles(dt);
      this.updateEnemies(dt);
      this.updatePickups(dt);
      this.updateEffects(dt);
      if (this.lives <= 0 && !this.result) {
        this.finishGame("Game Over", "The valley fell on wave " + this.waveNumber + ".");
      }
      this.emitChange();
    }

    finishGame(title, text) {
      this.result = { title, text };
      if (this.onGameOver) {
        this.onGameOver(this.result);
      }
    }

    updateWave(dt) {
      if (!this.waveInProgress) {
        if (this.autoStart && this.wavePending) {
          this.waveDelay -= dt;
          if (this.waveDelay <= 0) {
            this.startWave();
          }
        }
        return;
      }
      if (this.spawnQueue.length) {
        this.spawnAccumulator += dt;
        while (this.spawnQueue.length && this.spawnAccumulator >= this.spawnQueue[0].delay) {
          const spawn = this.spawnQueue.shift();
          this.spawnAccumulator -= spawn.delay;
          this.spawnEnemy(spawn.type, spawn.scale);
        }
      }
      if (!this.spawnQueue.length && !this.enemies.length) {
        this.waveInProgress = false;
        this.wavePending = true;
        this.money += Math.round((70 + this.waveNumber * 3) * this.difficulty.reward);
        this.log("Wave " + this.waveNumber + " cleared.");
        if (this.difficulty.totalWaves && this.waveNumber >= this.difficulty.totalWaves) {
          this.finishGame("Victory", "You defended all " + this.difficulty.totalWaves + " waves.");
        } else {
          this.waveNumber += 1;
          this.waveDelay = 2.2;
        }
      }
    }

    startWave() {
      if (this.waveInProgress || this.result) {
        return;
      }
      this.spawnQueue = this.generateWave(this.waveNumber);
      this.spawnAccumulator = 0;
      this.waveInProgress = true;
      this.wavePending = false;
      this.log("Wave " + this.waveNumber + " started.");
      this.emitChange();
    }

    generateWave(waveNumber) {
      const queue = [];
      const loopWave = this.difficulty.id === "endless" ? waveNumber : Math.min(waveNumber, this.difficulty.totalWaves || waveNumber);
      const pushGroup = (type, count, spacing, scale) => {
        for (let i = 0; i < count; i += 1) {
          queue.push({ type, delay: spacing, scale });
        }
      };
      pushGroup("wolf", 6 + Math.floor(loopWave * 1.2), 0.66, 1 + loopWave * 0.03);
      if (waveNumber >= 4) pushGroup("tiger", 2 + Math.floor(loopWave * 0.45), 1, 1 + loopWave * 0.04);
      if (waveNumber >= 9) pushGroup("boar", 1 + Math.floor(loopWave * 0.18), 1.2, 1 + loopWave * 0.05);
      if (waveNumber >= 16) pushGroup("alphaWolf", Math.floor(loopWave * 0.12), 1.15, 1 + loopWave * 0.055);
      if (waveNumber >= 28) pushGroup("saberTiger", Math.floor(loopWave * 0.1), 1.3, 1 + loopWave * 0.06);
      if (this.difficulty.id === "endless") {
        pushGroup("wolf", 2 + Math.floor(loopWave * 0.3), 0.5, 1 + loopWave * 0.08);
      }
      return queue;
    }

    spawnEnemy(typeId, extraScale) {
      const base = PandaTD.ENEMY_TYPES[typeId];
      const waveScale = 1 + (this.waveNumber - 1) * 0.085;
      const endlessScale = this.difficulty.id === "endless" ? 1 + this.waveNumber * 0.018 : 1;
      const enemy = {
        id: Math.random().toString(36).slice(2),
        type: typeId,
        progress: 0,
        x: this.map.pathPoints[0].x,
        y: this.map.pathPoints[0].y,
        speed: base.speed * this.difficulty.enemySpeed * waveScale * endlessScale * (extraScale || 1),
        maxHealth: Math.round(base.hp * this.difficulty.enemyHealth * waveScale * endlessScale * (extraScale || 1)),
        health: 0,
        reward: Math.round(base.reward * this.difficulty.reward * (1 + this.waveNumber * 0.02)),
        size: base.size,
        color: base.color,
        damage: base.damage,
        stun: 0,
        slow: 0,
        slowUntil: 0,
        bleedDamage: 0,
        bleedUntil: 0
      };
      enemy.health = enemy.maxHealth;
      this.enemies.push(enemy);
    }

    updateEnemies(dt) {
      for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = this.enemies[i];
        if (enemy.stun > 0) {
          enemy.stun -= dt;
        } else {
          const slowFactor = enemy.slowUntil > this.gameTime ? 1 - enemy.slow : 1;
          enemy.progress += enemy.speed * slowFactor * dt;
        }
        if (enemy.bleedUntil > this.gameTime) {
          enemy.health -= enemy.bleedDamage * dt;
        }
        const point = PandaTD.MapUtils.samplePoint(this.pathCache, enemy.progress);
        enemy.x = point.x;
        enemy.y = point.y;
        if (enemy.health <= 0) {
          this.killEnemy(enemy);
          continue;
        }
        if (enemy.progress >= this.pathCache.totalLength) {
          this.lives -= enemy.damage;
          this.effects.push({ type: "text", x: this.map.width - 74, y: this.map.height - 36, text: "-" + enemy.damage + " lives", color: "#b43e38", ttl: 0.9 });
          this.enemies.splice(i, 1);
        }
      }
    }

    killEnemy(enemy, source, noReward) {
      const index = this.enemies.findIndex((entry) => entry.id === enemy.id);
      if (index >= 0) {
        this.enemies.splice(index, 1);
      }
      if (!noReward) {
        this.money += enemy.reward;
      }
      this.effects.push({ type: "blast", x: enemy.x, y: enemy.y, radius: 24, color: "#fff2bf", ttl: 0.35 });
      this.effects.push({ type: "text", x: enemy.x, y: enemy.y - 16, text: "+" + enemy.reward, color: "#416229", ttl: 0.75 });
      if (source && this.getTowerStats(source).acidPool) {
        this.effects.push({ type: "acid", x: enemy.x, y: enemy.y, radius: 32, source, ttl: 2.5 });
      }
    }

    getTowerSupportOnly(tower) {
      if (tower.type !== "pandaVillage" && tower.type !== "pandaScientist" && tower.type !== "bambooFarm") {
        return null;
      }
      const data = PandaTD.TOWER_DATA[tower.type];
      const stats = Object.assign({}, data.baseStats);
      stats.supportRange = stats.supportRange || 0;
      stats.supportRateBonus = stats.supportRateBonus || 0;
      stats.supportDamageBonus = stats.supportDamageBonus || 0;
      stats.supportRangeTowerAdd = 0;
      stats.farmBuff = 0;
      stats.farmRange = stats.farmRange || 120;
      for (let pathIndex = 0; pathIndex < 3; pathIndex += 1) {
        for (let tierIndex = 0; tierIndex < tower.upgrades[pathIndex]; tierIndex += 1) {
          const effects = data.paths[pathIndex].tiers[tierIndex].effects;
          if (effects.supportRangeAdd) stats.supportRange += effects.supportRangeAdd;
          if (effects.supportRateBonusAdd) stats.supportRateBonus += effects.supportRateBonusAdd;
          if (effects.supportDamageBonusAdd) stats.supportDamageBonus += effects.supportDamageBonusAdd;
          if (effects.supportRangeTowerAdd) stats.supportRangeTowerAdd += effects.supportRangeTowerAdd;
          if (effects.farmBuff) stats.farmBuff = Math.max(stats.farmBuff, effects.farmBuff);
          if (effects.farmRangeAdd) stats.farmRange += effects.farmRangeAdd;
        }
      }
      return stats;
    }

    getSupportBuffs(tower) {
      const buffs = { rangeAdd: 0, damageMul: 1, rateMul: 1 };
      for (const other of this.towers) {
        if (other.id === tower.id) {
          continue;
        }
        const stats = this.getTowerSupportOnly(other);
        if (!stats || !stats.supportRange) {
          continue;
        }
        if (dist(tower.x, tower.y, other.x, other.y) <= stats.supportRange) {
          buffs.rangeAdd += stats.supportRangeTowerAdd || 0;
          buffs.damageMul *= 1 + (stats.supportDamageBonus || 0);
          buffs.rateMul *= 1 + (stats.supportRateBonus || 0);
        }
      }
      return buffs;
    }

    getTowerStats(tower) {
      const data = PandaTD.TOWER_DATA[tower.type];
      const stats = Object.assign({}, data.baseStats);
      stats.range = stats.range || 0;
      stats.damage = stats.damage || 0;
      stats.fireRate = stats.fireRate || 0;
      stats.projectileSpeed = stats.projectileSpeed || 280;
      stats.pierce = stats.pierce || 1;
      stats.shots = stats.shots || 1;
      stats.splash = stats.splash || 0;
      stats.supportRange = stats.supportRange || 0;
      stats.supportRateBonus = stats.supportRateBonus || 0;
      stats.supportDamageBonus = stats.supportDamageBonus || 0;
      stats.supportRangeTowerAdd = 0;
      stats.spawnRate = stats.spawnRate || 0.35;
      stats.buildRate = stats.buildRate || 0.2;
      stats.robotCooldown = stats.robotCooldown || 8;
      stats.income = stats.income || 0;
      stats.autoIncome = stats.autoIncome || 0;
      stats.farmBuff = stats.farmBuff || 0;
      stats.farmRange = stats.farmRange || 120;
      stats.projectileArc = 0;
      stats.abilityCooldownMul = 1;
      for (let pathIndex = 0; pathIndex < 3; pathIndex += 1) {
        for (let tierIndex = 0; tierIndex < tower.upgrades[pathIndex]; tierIndex += 1) {
          const effects = data.paths[pathIndex].tiers[tierIndex].effects;
          if (effects.damageAdd) stats.damage += effects.damageAdd;
          if (effects.rangeAdd) stats.range += effects.rangeAdd;
          if (effects.fireRateMul) stats.fireRate *= effects.fireRateMul;
          if (effects.projectileSpeedAdd) stats.projectileSpeed += effects.projectileSpeedAdd;
          if (effects.pierceAdd) stats.pierce += effects.pierceAdd;
          if (effects.shotsAdd) stats.shots += effects.shotsAdd;
          if (effects.splashAdd) stats.splash += effects.splashAdd;
          if (effects.attackMode) stats.attackMode = effects.attackMode;
          if (effects.ability) stats.ability = effects.ability;
          if (effects.knockback) stats.knockback = effects.knockback;
          if (effects.stunDuration) stats.stunDuration = Math.max(stats.stunDuration || 0, effects.stunDuration);
          if (effects.critChance) stats.critChance = Math.max(stats.critChance || 0, effects.critChance);
          if (effects.strongBias) stats.strongBias = Math.max(stats.strongBias || 0, effects.strongBias);
          if (effects.slowAmount) stats.slowAmount = Math.max(stats.slowAmount || 0, effects.slowAmount);
          if (effects.acidPool) stats.acidPool = true;
          if (effects.abilityCooldownMul) stats.abilityCooldownMul *= effects.abilityCooldownMul;
          if (effects.abilityMaxKillsAdd) stats.abilityMaxKillsAdd = (stats.abilityMaxKillsAdd || 0) + effects.abilityMaxKillsAdd;
          if (effects.abilityRadiusAdd) stats.abilityRadiusAdd = (stats.abilityRadiusAdd || 0) + effects.abilityRadiusAdd;
          if (effects.helperSpawn) stats.helperSpawn = true;
          if (effects.helperDamageAdd) stats.helperDamage = (stats.helperDamage || 1) + effects.helperDamageAdd;
          if (effects.helperCountAdd) stats.helperCount = (stats.helperCount || 1) + effects.helperCountAdd;
          if (effects.spawnRateMul) stats.spawnRate *= effects.spawnRateMul;
          if (effects.supportRangeAdd) stats.supportRange += effects.supportRangeAdd;
          if (effects.supportRateBonusAdd) stats.supportRateBonus += effects.supportRateBonusAdd;
          if (effects.supportDamageBonusAdd) stats.supportDamageBonus += effects.supportDamageBonusAdd;
          if (effects.supportRangeTowerAdd) stats.supportRangeTowerAdd += effects.supportRangeTowerAdd;
          if (effects.rageDurationAdd) stats.rageDurationAdd = (stats.rageDurationAdd || 0) + effects.rageDurationAdd;
          if (effects.companion) stats.companion = effects.companion;
          if (effects.bleedDamage) stats.bleedDamage = (stats.bleedDamage || 0) + effects.bleedDamage;
          if (effects.requiresWater) stats.requiresWater = true;
          if (effects.mineLayer) stats.mineLayer = true;
          if (effects.buildRateMul) stats.buildRate *= effects.buildRateMul;
          if (effects.mineDamageAdd) stats.mineDamage = (stats.mineDamage || 8) + effects.mineDamageAdd;
          if (effects.mineSplashAdd) stats.mineSplash = (stats.mineSplash || 32) + effects.mineSplashAdd;
          if (effects.sentry) stats.sentry = true;
          if (effects.sentryDamageAdd) stats.sentryDamage = (stats.sentryDamage || 1) + effects.sentryDamageAdd;
          if (effects.sentryRateMul) stats.sentryRate = (stats.sentryRate || 1.2) * effects.sentryRateMul;
          if (effects.sentryCountAdd) stats.sentryCount = (stats.sentryCount || 1) + effects.sentryCountAdd;
          if (effects.robotCharge) stats.robotCharge = true;
          if (effects.robotCooldownMul) stats.robotCooldown *= effects.robotCooldownMul;
          if (effects.robotDamageAdd) stats.robotDamage = (stats.robotDamage || 18) + effects.robotDamageAdd;
          if (effects.incomeAdd) stats.income += effects.incomeAdd;
          if (effects.autoIncomeAdd) stats.autoIncome += effects.autoIncomeAdd;
          if (effects.farmBuff) stats.farmBuff = Math.max(stats.farmBuff, effects.farmBuff);
          if (effects.farmRangeAdd) stats.farmRange += effects.farmRangeAdd;
          if (effects.projectileArc) stats.projectileArc = Math.max(stats.projectileArc, effects.projectileArc);
        }
      }
      const support = this.getSupportBuffs(tower);
      stats.range += support.rangeAdd;
      stats.damage *= support.damageMul;
      stats.fireRate *= support.rateMul;
      if (tower.rageUntil > this.gameTime) {
        stats.fireRate *= 1.45;
      }
      return stats;
    }

    getTowerAbilities(tower) {
      const stats = this.getTowerStats(tower);
      const abilities = [];
      if (stats.ability === "bombardment") {
        abilities.push({ id: "bombardment", label: "Explosive Barrage", cooldown: 18, description: "Drops shells on clustered enemies." });
      }
      if (stats.ability === "pandaRage") {
        abilities.push({ id: "pandaRage", label: "Panda Rage", cooldown: 22, description: "Nearby towers attack much faster." });
      }
      if (stats.ability === "potionBlast") {
        abilities.push({ id: "potionBlast", label: "Potion Blast", cooldown: 10 * stats.abilityCooldownMul, description: "Instantly defeats several enemies in one area." });
      }
      return abilities;
    }

    activateAbility(tower, abilityId) {
      const ability = this.getTowerAbilities(tower).find((entry) => entry.id === abilityId);
      if (!ability) {
        return;
      }
      const readyAt = tower.abilityState[abilityId] || 0;
      if (readyAt > this.gameTime) {
        return;
      }
      const stats = this.getTowerStats(tower);
      if (abilityId === "bombardment") {
        const targets = this.enemies.slice().sort((a, b) => b.progress - a.progress).slice(0, 4);
        targets.forEach((enemy, index) => {
          this.effects.push({ type: "blast", x: enemy.x, y: enemy.y, radius: 50 + index * 6, color: "#f5c053", ttl: 0.6 });
          this.damageEnemiesInRadius(enemy.x, enemy.y, 56 + index * 4, 12 + stats.damage * 2, tower);
        });
        this.log("Explosive Barrage fired.");
      }
      if (abilityId === "pandaRage") {
        const duration = 8 + (stats.rageDurationAdd || 0);
        for (const other of this.towers) {
          if (other.id !== tower.id && dist(other.x, other.y, tower.x, tower.y) <= stats.supportRange) {
            other.rageUntil = this.gameTime + duration;
          }
        }
        this.effects.push({ type: "ring", x: tower.x, y: tower.y, radius: stats.supportRange, color: "#ef7f3c", ttl: 0.8 });
        this.log("Panda Rage activated.");
      }
      if (abilityId === "potionBlast") {
        const focus = this.enemies.slice().sort((a, b) => b.health - a.health)[0];
        if (!focus) {
          return;
        }
        let kills = 0;
        const maxKills = 6 + (stats.abilityMaxKillsAdd || 0);
        const radius = 72 + (stats.abilityRadiusAdd || 0);
        for (const enemy of this.enemies.slice()) {
          if (kills >= maxKills) {
            break;
          }
          if (dist(enemy.x, enemy.y, focus.x, focus.y) <= radius) {
            this.killEnemy(enemy, tower, true);
            kills += 1;
          }
        }
        this.effects.push({ type: "blast", x: focus.x, y: focus.y, radius, color: "#7ee0db", ttl: 0.85 });
        this.log("Potion Blast eliminated " + kills + " enemies.");
      }
      tower.abilityState[abilityId] = this.gameTime + ability.cooldown;
      this.emitChange();
    }

    updateTowers(dt) {
      for (const tower of this.towers) {
        const stats = this.getTowerStats(tower);
        tower.cooldown -= dt;
        tower.helperCooldown -= dt;
        tower.deviceCooldown -= dt;
        if (tower.type === "pandaVillage" && stats.helperSpawn) {
          const existing = this.helpers.filter((helper) => helper.source.id === tower.id).length;
          const desired = stats.helperCount || 1;
          if (existing < desired && tower.helperCooldown <= 0) {
            this.helpers.push({
              source: tower,
              x: tower.x,
              y: tower.y,
              range: 90,
              distance: 34 + existing * 10,
              orbit: Math.random() * Math.PI * 2,
              spin: 1.5,
              damage: stats.helperDamage || 1,
              fireRate: 1.1,
              projectileSpeed: 320,
              cooldown: 0.1,
              life: 8
            });
            tower.helperCooldown = 1 / Math.max(0.15, stats.spawnRate);
          }
        }
        if (tower.type === "pandaEngineer") {
          this.updateEngineerDevices(tower, stats);
        }
        if (tower.type === "bambooFarm" || tower.type === "pandaVillage") {
          continue;
        }
        if (tower.cooldown > 0) {
          continue;
        }
        const target = this.chooseTarget(tower, stats);
        if (!target) {
          continue;
        }
        this.fireTower(tower, stats, target);
        tower.cooldown = 1 / Math.max(0.1, stats.fireRate || 1);
      }
    }

    updateEngineerDevices(tower, stats) {
      if (stats.mineLayer && tower.deviceCooldown <= 0) {
        const progress = this.findNearestProgress(tower.x, tower.y) + 40;
        const point = PandaTD.MapUtils.samplePoint(this.pathCache, progress);
        this.devices.push({
          kind: "mine",
          source: tower,
          x: point.x,
          y: point.y,
          splash: stats.mineSplash || 32,
          damage: stats.mineDamage || 8,
          triggerRadius: 24,
          life: 10,
          cooldown: 0
        });
        tower.deviceCooldown = 1 / Math.max(0.15, stats.buildRate);
      }
      if (stats.sentry) {
        const active = this.devices.filter((device) => device.kind === "sentry" && device.source.id === tower.id);
        const desired = stats.sentryCount || 1;
        while (active.length < desired) {
          const index = active.length;
          const angle = (Math.PI * 2 * index) / desired;
          const sentry = {
            kind: "sentry",
            source: tower,
            x: tower.x + Math.cos(angle) * 38,
            y: tower.y + Math.sin(angle) * 38,
            range: 108,
            damage: stats.sentryDamage || 1,
            fireRate: stats.sentryRate || 1.2,
            cooldown: 0.2,
            life: 9999
          };
          this.devices.push(sentry);
          active.push(sentry);
        }
      }
      if (stats.robotCharge) {
        let charge = this.devices.find((device) => device.kind === "robot" && device.source.id === tower.id);
        if (!charge) {
          charge = {
            kind: "robot",
            source: tower,
            y: tower.y,
            damage: stats.robotDamage || 18,
            refresh: stats.robotCooldown || 8,
            cooldown: stats.robotCooldown || 8,
            life: 9999
          };
          this.devices.push(charge);
        }
        charge.y = tower.y;
        charge.damage = stats.robotDamage || 18;
        charge.refresh = stats.robotCooldown || 8;
      }
    }

    updateHelpers(dt) {
      for (let i = this.helpers.length - 1; i >= 0; i -= 1) {
        const helper = this.helpers[i];
        helper.life -= dt;
        helper.orbit += dt * helper.spin;
        helper.x = helper.source.x + Math.cos(helper.orbit) * helper.distance;
        helper.y = helper.source.y + Math.sin(helper.orbit) * helper.distance;
        helper.cooldown -= dt;
        if (helper.cooldown <= 0) {
          const target = this.enemies.find((enemy) => dist(enemy.x, enemy.y, helper.x, helper.y) <= helper.range);
          if (target) {
            this.projectiles.push(this.makeProjectile(helper.x, helper.y, target, helper.projectileSpeed, helper.damage, 4, 0, helper.source, "#fafafa"));
            helper.cooldown = 1 / helper.fireRate;
          }
        }
        if (helper.life <= 0 || !this.towers.find((tower) => tower.id === helper.source.id)) {
          this.helpers.splice(i, 1);
        }
      }
    }

    updateDevices(dt) {
      for (let i = this.devices.length - 1; i >= 0; i -= 1) {
        const device = this.devices[i];
        device.life -= dt;
        device.cooldown -= dt;
        if (!this.towers.find((tower) => tower.id === device.source.id)) {
          this.devices.splice(i, 1);
          continue;
        }
        if (device.kind === "mine") {
          const enemy = this.enemies.find((entry) => dist(entry.x, entry.y, device.x, device.y) <= device.triggerRadius);
          if (enemy) {
            this.effects.push({ type: "blast", x: device.x, y: device.y, radius: device.splash, color: "#f39d41", ttl: 0.45 });
            this.damageEnemiesInRadius(device.x, device.y, device.splash, device.damage, device.source);
            this.devices.splice(i, 1);
            continue;
          }
        }
        if (device.kind === "sentry" && device.cooldown <= 0) {
          const target = this.enemies.find((enemy) => dist(enemy.x, enemy.y, device.x, device.y) <= device.range);
          if (target) {
            this.projectiles.push(this.makeProjectile(device.x, device.y, target, 360, device.damage, 4, 0, device.source, "#d7edf9"));
            device.cooldown = 1 / device.fireRate;
          }
        }
        if (device.kind === "robot" && device.cooldown <= 0) {
          this.effects.push({ type: "charge", y: device.y, ttl: 0.7 });
          for (const enemy of this.enemies.slice()) {
            if (Math.abs(enemy.y - device.y) <= 42) {
              this.damageEnemy(enemy, device.damage, device.source);
            }
          }
          device.cooldown = device.refresh;
        }
        if (device.life <= 0) {
          this.devices.splice(i, 1);
        }
      }
    }

    updateProjectiles(dt) {
      for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
        const projectile = this.projectiles[i];
        projectile.life += dt;
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        let hit = null;
        for (const enemy of this.enemies) {
          if (dist(enemy.x, enemy.y, projectile.x, projectile.y) <= enemy.size + projectile.radius) {
            hit = enemy;
            break;
          }
        }
        if (hit || projectile.life > projectile.maxLife) {
          const impactX = hit ? hit.x : projectile.x;
          const impactY = hit ? hit.y : projectile.y;
          if (projectile.splash > 0) {
            this.effects.push({ type: "blast", x: impactX, y: impactY, radius: projectile.splash, color: projectile.color, ttl: 0.4 });
            this.damageEnemiesInRadius(impactX, impactY, projectile.splash, projectile.damage, projectile.source);
          } else if (hit) {
            this.damageEnemy(hit, projectile.damage, projectile.source);
          }
          this.projectiles.splice(i, 1);
        }
      }
    }

    updatePickups(dt) {
      for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
        this.pickups[i].life -= dt;
        this.pickups[i].bob += dt * 2.5;
        if (this.pickups[i].life <= 0) {
          this.pickups.splice(i, 1);
        }
      }
      for (const tower of this.towers) {
        if (tower.type !== "bambooFarm") {
          continue;
        }
        const stats = this.getTowerStats(tower);
        const multiplier = this.getFarmMultiplier(tower);
        tower.farmManualTimer -= dt;
        tower.farmAutoTimer -= dt;
        if (stats.income > 0 && tower.farmManualTimer <= 0) {
          this.pickups.push({
            x: tower.x + 12 - Math.random() * 24,
            y: tower.y - 24,
            radius: 14,
            value: Math.round(stats.income * multiplier),
            life: 12,
            bob: Math.random() * Math.PI * 2
          });
          tower.farmManualTimer = 7.5;
        }
        if (stats.autoIncome > 0 && tower.farmAutoTimer <= 0) {
          const value = Math.round(stats.autoIncome * multiplier);
          this.money += value;
          this.effects.push({ type: "text", x: tower.x, y: tower.y - 18, text: "+" + value, color: "#355d23", ttl: 0.75 });
          tower.farmAutoTimer = 3.2;
        }
      }
    }

    updateEffects(dt) {
      for (let i = this.effects.length - 1; i >= 0; i -= 1) {
        const effect = this.effects[i];
        effect.ttl -= dt;
        if (effect.type === "text") {
          effect.y -= dt * 18;
        }
        if (effect.type === "acid") {
          for (const enemy of this.enemies.slice()) {
            if (dist(enemy.x, enemy.y, effect.x, effect.y) <= effect.radius) {
              this.damageEnemy(enemy, 5 * dt, effect.source);
            }
          }
        }
        if (effect.ttl <= 0) {
          this.effects.splice(i, 1);
        }
      }
    }

    getFarmMultiplier(farm) {
      let value = 1;
      for (const tower of this.towers) {
        if (tower.id === farm.id || tower.type !== "bambooFarm") {
          continue;
        }
        const stats = this.getTowerSupportOnly(tower);
        if (stats && stats.farmBuff > 0 && dist(tower.x, tower.y, farm.x, farm.y) <= stats.farmRange) {
          value *= 1 + stats.farmBuff;
        }
      }
      return value;
    }

    chooseTarget(tower, stats) {
      const range = stats.attackMode === "mortar" ? 99999 : stats.range;
      const enemies = this.enemies.filter((enemy) => dist(enemy.x, enemy.y, tower.x, tower.y) <= range);
      if (!enemies.length) {
        return null;
      }
      if (tower.targetMode === "Last") {
        return enemies.sort((a, b) => a.progress - b.progress)[0];
      }
      if (tower.targetMode === "Strong") {
        return enemies.sort((a, b) => b.health - a.health)[0];
      }
      if (tower.targetMode === "Close") {
        return enemies.sort((a, b) => dist(a.x, a.y, tower.x, tower.y) - dist(b.x, b.y, tower.x, tower.y))[0];
      }
      return enemies.sort((a, b) => b.progress - a.progress)[0];
    }

    fireTower(tower, stats, target) {
      const shots = stats.shots || 1;
      const baseAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
      for (let i = 0; i < shots; i += 1) {
        const spread = shots === 1 ? 0 : ((i / (shots - 1)) - 0.5) * (stats.projectileArc || 0.22);
        const angle = baseAngle + spread;
        const speed = stats.projectileSpeed || 280;
        let color = "#f5f5f5";
        let splash = stats.splash || 0;
        if (tower.type === "bomberPanda") {
          color = "#f0ac46";
        } else if (tower.type === "pandaScientist") {
          color = "#86d5cb";
        } else if (tower.type === "pandaTamer") {
          if (stats.companion === "eagle") {
            color = "#f3e4b4";
          } else if (stats.companion === "shark" && tower.nearWater) {
            color = "#82d5f1";
            splash = Math.max(splash, 18);
          } else {
            color = "#f5d59c";
          }
        }
        const projectile = {
          x: tower.x,
          y: tower.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          damage: stats.damage || 1,
          radius: tower.type === "bomberPanda" ? 7 : 4,
          splash,
          source: tower,
          color,
          maxLife: stats.attackMode === "mortar" ? 1.5 : 1.1,
          life: 0
        };
        if (stats.attackMode === "mortar") {
          projectile.vx = (target.x - tower.x) / projectile.maxLife;
          projectile.vy = (target.y - tower.y) / projectile.maxLife;
        }
        this.projectiles.push(projectile);
      }
    }

    makeProjectile(x, y, target, speed, damage, radius, splash, source, color) {
      const angle = Math.atan2(target.y - y, target.x - x);
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        damage,
        radius,
        splash,
        source,
        color,
        maxLife: 1.2,
        life: 0
      };
    }

    damageEnemiesInRadius(x, y, radius, damage, source) {
      for (const enemy of this.enemies.slice()) {
        if (dist(enemy.x, enemy.y, x, y) <= radius) {
          this.damageEnemy(enemy, damage, source);
        }
      }
    }

    damageEnemy(enemy, damage, source) {
      const stats = source ? this.getTowerStats(source) : null;
      let total = damage;
      if (stats && stats.critChance && Math.random() < stats.critChance) {
        total *= 2;
        this.effects.push({ type: "text", x: enemy.x, y: enemy.y - 14, text: "CRIT", color: "#f4b844", ttl: 0.55 });
      }
      enemy.health -= total;
      if (stats && stats.knockback) {
        enemy.progress = Math.max(0, enemy.progress - stats.knockback);
      }
      if (stats && stats.stunDuration) {
        enemy.stun = Math.max(enemy.stun, stats.stunDuration);
      }
      if (stats && stats.slowAmount) {
        enemy.slow = stats.slowAmount;
        enemy.slowUntil = this.gameTime + 1.5;
      }
      if (stats && stats.bleedDamage) {
        enemy.bleedDamage = stats.bleedDamage;
        enemy.bleedUntil = this.gameTime + 2.2;
      }
      if (enemy.health <= 0) {
        this.killEnemy(enemy, source);
      }
    }

    findNearestProgress(x, y) {
      let bestProgress = 0;
      let bestDistance = Infinity;
      for (const segment of this.pathCache.segments) {
        const samples = Math.max(2, Math.ceil(segment.length / 24));
        for (let i = 0; i <= samples; i += 1) {
          const t = i / samples;
          const sx = segment.start.x + (segment.end.x - segment.start.x) * t;
          const sy = segment.start.y + (segment.end.y - segment.start.y) * t;
          const currentDistance = dist(x, y, sx, sy);
          if (currentDistance < bestDistance) {
            bestDistance = currentDistance;
            bestProgress = segment.totalLength + segment.length * t;
          }
        }
      }
      return bestProgress;
    }

    cycleTargeting(tower) {
      const current = TARGET_MODES.indexOf(tower.targetMode);
      tower.targetMode = TARGET_MODES[(current + 1) % TARGET_MODES.length];
      this.emitChange();
    }

    getUpgradeCost(tower, pathIndex) {
      const nextTier = PandaTD.TOWER_DATA[tower.type].paths[pathIndex].tiers[tower.upgrades[pathIndex]];
      return Math.round(nextTier.cost * this.difficulty.towerCost);
    }

    canUpgradeTower(tower, pathIndex) {
      const current = tower.upgrades[pathIndex];
      const path = PandaTD.TOWER_DATA[tower.type].paths[pathIndex];
      if (!path.tiers[current]) {
        return { ok: false, reason: "Max tier reached." };
      }
      const mainPath = tower.upgrades.findIndex((value) => value >= 3);
      const activeOtherPaths = [0, 1, 2].filter((index) => index !== pathIndex && tower.upgrades[index] > 0);
      if (mainPath >= 0 && pathIndex !== mainPath && tower.upgrades[pathIndex] >= 2) {
        return { ok: false, reason: "Crosspath maxed." };
      }
      if (mainPath >= 0 && pathIndex !== mainPath && activeOtherPaths.length >= 1 && tower.upgrades[pathIndex] === 0) {
        const activeNonMain = activeOtherPaths.filter((index) => index !== mainPath);
        if (activeNonMain.length >= 1) {
          return { ok: false, reason: "Third path locked." };
        }
      }
      if (mainPath < 0 && activeOtherPaths.length >= 2 && tower.upgrades[pathIndex] === 0) {
        return { ok: false, reason: "Only two paths can be active." };
      }
      if (path.tiers[current].effects.requiresWater && !tower.nearWater) {
        return { ok: false, reason: "Needs nearby water." };
      }
      if (this.getUpgradeCost(tower, pathIndex) > this.money) {
        return { ok: false, reason: "Not enough money." };
      }
      return { ok: true };
    }

    upgradeTower(tower, pathIndex) {
      const validation = this.canUpgradeTower(tower, pathIndex);
      if (!validation.ok) {
        this.log(validation.reason);
        this.emitChange();
        return false;
      }
      const cost = this.getUpgradeCost(tower, pathIndex);
      tower.upgrades[pathIndex] += 1;
      if (tower.upgrades[pathIndex] >= 3) {
        tower.mainPath = pathIndex;
      }
      tower.spent += cost;
      this.money -= cost;
      const tier = PandaTD.TOWER_DATA[tower.type].paths[pathIndex].tiers[tower.upgrades[pathIndex] - 1];
      this.log(PandaTD.TOWER_DATA[tower.type].name + " upgraded to " + tier.name + ".");
      this.emitChange();
      return true;
    }

    sellTower(tower) {
      const refund = Math.round(tower.spent * 0.7);
      this.money += refund;
      this.towers = this.towers.filter((entry) => entry.id !== tower.id);
      this.helpers = this.helpers.filter((entry) => entry.source.id !== tower.id);
      this.devices = this.devices.filter((entry) => entry.source.id !== tower.id);
      this.selectedTower = null;
      this.log("Tower sold for $" + refund + ".");
      this.emitChange();
    }

    getWaveLabel() {
      return this.difficulty.totalWaves ? this.waveNumber + " / " + this.difficulty.totalWaves : String(this.waveNumber);
    }

    getState() {
      return {
        lives: this.lives,
        money: this.money,
        difficulty: this.difficulty,
        waveLabel: this.getWaveLabel(),
        waveNumber: this.waveNumber,
        speedMultiplier: this.speedMultiplier,
        selectedTowerType: this.selectedTowerType,
        selectedTower: this.selectedTower,
        logs: this.logs,
        waveInProgress: this.waveInProgress
      };
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.map.width, this.map.height);
      this.drawMap(ctx);
      this.drawDevices(ctx);
      this.drawPickups(ctx);
      this.drawTowers(ctx);
      this.drawHelpers(ctx);
      this.drawEnemies(ctx);
      this.drawProjectiles(ctx);
      this.drawEffects(ctx);
      this.drawPlacementPreview(ctx);
    }

    drawMap(ctx) {
      const bg = ctx.createLinearGradient(0, 0, 0, this.map.height);
      bg.addColorStop(0, "#b9e98d");
      bg.addColorStop(1, "#7eb957");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, this.map.width, this.map.height);
      for (let i = 0; i < 16; i += 1) {
        ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.07)" : "rgba(60,110,44,0.08)";
        ctx.beginPath();
        ctx.arc((i * 83) % this.map.width, (i * 137) % this.map.height, 44 + (i % 5) * 16, 0, Math.PI * 2);
        ctx.fill();
      }
      this.map.water.forEach((pond) => {
        const grad = ctx.createRadialGradient(pond.x, pond.y, 12, pond.x, pond.y, pond.rx);
        grad.addColorStop(0, "#97def7");
        grad.addColorStop(1, "#2f7ea8");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 4;
        ctx.stroke();
      });
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#9e7b46";
      ctx.lineWidth = this.map.pathWidth + 8;
      ctx.beginPath();
      this.map.pathPoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.stroke();
      const road = ctx.createLinearGradient(0, 0, this.map.width, this.map.height);
      road.addColorStop(0, "#d9c291");
      road.addColorStop(1, "#c6a06a");
      ctx.strokeStyle = road;
      ctx.lineWidth = this.map.pathWidth;
      ctx.beginPath();
      this.map.pathPoints.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.stroke();

      this.map.decorations.bambooClusters.forEach((bamboo) => {
        ctx.save();
        ctx.translate(bamboo.x, bamboo.y);
        ctx.scale(bamboo.s, bamboo.s);
        for (let i = -1; i <= 1; i += 1) {
          ctx.strokeStyle = "#3d7c31";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(i * 11, 20);
          ctx.lineTo(i * 10, -18);
          ctx.stroke();
          ctx.fillStyle = "#6cc057";
          ctx.beginPath();
          ctx.ellipse(i * 13 + 7, -10, 10, 5, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(i * 8 - 5, -2, 10, 5, -Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      this.map.decorations.rocks.forEach((rock) => {
        ctx.save();
        ctx.translate(rock.x, rock.y);
        ctx.scale(rock.s, rock.s);
        ctx.fillStyle = "#8d9497";
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      this.map.decorations.flowers.forEach((flower) => {
        ctx.save();
        ctx.translate(flower.x, flower.y);
        ctx.scale(flower.s, flower.s);
        ["#ffef7f", "#fba0b0", "#ffffff", "#ffd1a9"].forEach((color, index) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(Math.cos((Math.PI * 2 * index) / 4) * 6, Math.sin((Math.PI * 2 * index) / 4) * 6, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#f0b03b";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.fillStyle = "#4b7d2d";
      ctx.font = "700 18px Trebuchet MS";
      ctx.fillText("Entrance", 16, 74);
      ctx.fillText("Exit", this.map.width - 56, this.map.height - 20);
    }

    drawTowers(ctx) {
      for (const tower of this.towers) {
        const data = PandaTD.TOWER_DATA[tower.type];
        const stats = this.getTowerStats(tower);
        if (tower === this.selectedTower) {
          const radius = Math.max(24, stats.range || stats.supportRange || 30);
          ctx.strokeStyle = "rgba(239,127,60,0.45)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(tower.x, tower.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.save();
        ctx.translate(tower.x, tower.y);
        ctx.fillStyle = data.color;
        ctx.strokeStyle = data.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, tower.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = data.accent;
        ctx.beginPath();
        ctx.arc(-7, -6, 4, 0, Math.PI * 2);
        ctx.arc(7, -6, 4, 0, Math.PI * 2);
        ctx.fill();
        if (tower.type === "bambooFarm") {
          ctx.fillStyle = "#5b9a33";
          for (let i = -1; i <= 1; i += 1) {
            ctx.fillRect(i * 8 - 2, -12, 4, 24);
          }
        } else if (tower.type === "pandaVillage") {
          ctx.fillStyle = "#8f6435";
          ctx.fillRect(-12, -10, 24, 20);
          ctx.fillStyle = "#d8a55c";
          ctx.beginPath();
          ctx.moveTo(-16, -10);
          ctx.lineTo(0, -24);
          ctx.lineTo(16, -10);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = data.accent;
          ctx.fillRect(8, -3, 14, 6);
        }
        ctx.restore();
        if (tower.type === "pandaTamer" && tower.nearWater) {
          ctx.fillStyle = "rgba(99,182,219,0.95)";
          ctx.beginPath();
          ctx.arc(tower.x + 18, tower.y - 16, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawEnemies(ctx) {
      for (const enemy of this.enemies) {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, enemy.size, enemy.size * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f4efe7";
        ctx.beginPath();
        ctx.arc(-enemy.size * 0.22, -enemy.size * 0.1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.24)";
        ctx.fillRect(-enemy.size, -enemy.size - 12, enemy.size * 2, 5);
        ctx.fillStyle = "#c9473f";
        ctx.fillRect(-enemy.size, -enemy.size - 12, enemy.size * 2 * (enemy.health / enemy.maxHealth), 5);
        ctx.restore();
      }
    }

    drawProjectiles(ctx) {
      for (const projectile of this.projectiles) {
        ctx.fillStyle = projectile.color || "#fff";
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawHelpers(ctx) {
      for (const helper of this.helpers) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#1d2420";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(helper.x, helper.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    drawDevices(ctx) {
      for (const device of this.devices) {
        if (device.kind === "mine") {
          ctx.fillStyle = "#6a4b2d";
          ctx.beginPath();
          ctx.arc(device.x, device.y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        if (device.kind === "sentry") {
          ctx.fillStyle = "#a7b6c9";
          ctx.fillRect(device.x - 8, device.y - 8, 16, 16);
        }
      }
    }

    drawPickups(ctx) {
      ctx.font = "700 16px Trebuchet MS";
      for (const pickup of this.pickups) {
        const y = pickup.y + Math.sin(pickup.bob) * 5;
        ctx.fillStyle = "#f0c14e";
        ctx.beginPath();
        ctx.roundRect(pickup.x - 12, y - 10, 24, 20, 6);
        ctx.fill();
        ctx.fillStyle = "#355d23";
        ctx.fillText("$", pickup.x - 4, y + 5);
      }
    }

    drawEffects(ctx) {
      for (const effect of this.effects) {
        const alpha = Math.max(0, effect.ttl);
        if (effect.type === "blast") {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = effect.color || "#fff";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (1 - alpha * 0.35), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (effect.type === "ring") {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = effect.color || "#fff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius * (1.02 - alpha * 0.2), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (effect.type === "text") {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = effect.color || "#fff";
          ctx.font = "700 16px Trebuchet MS";
          ctx.fillText(effect.text, effect.x, effect.y);
          ctx.globalAlpha = 1;
        }
        if (effect.type === "acid") {
          ctx.globalAlpha = 0.2 + alpha * 0.15;
          ctx.fillStyle = "#66d5a1";
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (effect.type === "charge") {
          ctx.globalAlpha = alpha * 0.75;
          ctx.strokeStyle = "#7dd0ff";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(0, effect.y);
          ctx.lineTo(this.map.width, effect.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }

    drawPlacementPreview(ctx) {
      if (!this.selectedTowerType || !this.hoverPoint) {
        return;
      }
      const towerData = PandaTD.TOWER_DATA[this.selectedTowerType];
      const radius = this.selectedTowerType === "bambooFarm" ? 24 : 20;
      const check = this.canPlaceTower(this.hoverPoint.x, this.hoverPoint.y, this.selectedTowerType);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = check.valid ? "#ffffff" : "#d4584b";
      ctx.beginPath();
      ctx.arc(this.hoverPoint.x, this.hoverPoint.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = check.valid ? "#6fca55" : "#d4584b";
      ctx.beginPath();
      ctx.arc(this.hoverPoint.x, this.hoverPoint.y, towerData.baseStats.range || towerData.baseStats.supportRange || 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  PandaTD.Game = Game;
  PandaTD.TARGET_MODES = TARGET_MODES;
})();
