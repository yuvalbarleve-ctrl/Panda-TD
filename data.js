(function () {
  const PandaTD = (window.PandaTD = window.PandaTD || {});

  PandaTD.DIFFICULTIES = {
    easy: { id: "easy", name: "Easy", totalWaves: 40, enemyHealth: 0.1, enemySpeed: 0.28, reward: 1.4, towerCost: 0.85 },
    medium: { id: "medium", name: "Medium", totalWaves: 60, enemyHealth: 0.12, enemySpeed: 0.32, reward: 1.25, towerCost: 0.9 },
    hard: { id: "hard", name: "Hard", totalWaves: 80, enemyHealth: 0.16, enemySpeed: 0.38, reward: 1.1, towerCost: 0.96 },
    impossible: { id: "impossible", name: "Impossible", totalWaves: 100, enemyHealth: 0.22, enemySpeed: 0.46, reward: 1, towerCost: 1.02 },
    endless: { id: "endless", name: "Endless", totalWaves: null, enemyHealth: 0.14, enemySpeed: 0.36, reward: 1.15, towerCost: 0.94 }
  };

  PandaTD.ENEMY_TYPES = {
    wolf: { name: "Wolf", color: "#7a7e85", hp: 22, speed: 58, reward: 8, size: 13, damage: 1 },
    tiger: { name: "Tiger", color: "#d08a3f", hp: 48, speed: 52, reward: 14, size: 16, damage: 2 },
    boar: { name: "Boar", color: "#6a4c3d", hp: 92, speed: 46, reward: 22, size: 18, damage: 3 },
    alphaWolf: { name: "Alpha Wolf", color: "#535961", hp: 165, speed: 60, reward: 32, size: 20, damage: 5 },
    saberTiger: { name: "Saber Tiger", color: "#b6602d", hp: 270, speed: 66, reward: 45, size: 21, damage: 7 }
  };

  function path(name, tiers) {
    return { name, tiers };
  }

  function tier(name, cost, desc, effects) {
    return { name, cost, desc, effects: effects || {} };
  }

  PandaTD.TOWER_DATA = {
    classicPanda: {
      id: "classicPanda",
      name: "Classic Panda",
      color: "#ffffff",
      accent: "#1f2922",
      baseCost: 185,
      description: "Balanced starter panda with flexible paths.",
      baseStats: { range: 120, damage: 1, fireRate: 1.05, projectileSpeed: 290, pierce: 1, shots: 1 },
      paths: [
        path("Kung Fu path", [
          tier("Quick Paws", 120, "Faster melee-style throws.", { fireRateMul: 1.18, rangeAdd: 8 }),
          tier("Palm Strike", 170, "Adds knockback force.", { damageAdd: 1, knockback: 10 }),
          tier("Spinning Monk", 340, "Main path: faster, stronger blows.", { fireRateMul: 1.28, damageAdd: 1, pierceAdd: 1 }),
          tier("Bamboo Tempest", 680, "Shreds grouped enemies.", { fireRateMul: 1.25, shotsAdd: 1, splashAdd: 18 }),
          tier("Grandmaster Panda", 1650, "Elite martial flurry.", { fireRateMul: 1.35, damageAdd: 4, pierceAdd: 3, shotsAdd: 1 })
        ]),
        path("Dart path", [
          tier("Sharper Darts", 110, "Extra piercing bamboo darts.", { pierceAdd: 1, projectileSpeedAdd: 40 }),
          tier("Twin Darts", 150, "Throws an extra dart.", { shotsAdd: 1 }),
          tier("Guided Volley", 290, "Main path: improved range and speed.", { rangeAdd: 28, fireRateMul: 1.18, pierceAdd: 1 }),
          tier("Storm Fan", 620, "Wide dart spread.", { shotsAdd: 2, projectileArc: 0.18 }),
          tier("Sky Splitter", 1450, "Huge spread of heavy darts.", { shotsAdd: 3, damageAdd: 2, pierceAdd: 3 })
        ]),
        path("Bamboo path", [
          tier("Thick Bamboo", 95, "Deals extra damage.", { damageAdd: 1 }),
          tier("Hardened Shafts", 145, "Longer range and stronger hits.", { damageAdd: 1, rangeAdd: 12 }),
          tier("Bamboo Launcher", 320, "Main path: heavy bamboo bolts.", { damageAdd: 2, projectileSpeedAdd: 100 }),
          tier("Splinter Burst", 720, "Bolts explode on impact.", { splashAdd: 24, damageAdd: 2 }),
          tier("Sacred Grove", 1550, "Massive bamboo cannon bolts.", { damageAdd: 5, pierceAdd: 4, splashAdd: 30 })
        ])
      ]
    },
    bomberPanda: {
      id: "bomberPanda",
      name: "Bomber Panda",
      color: "#f4d56e",
      accent: "#5f4632",
      baseCost: 325,
      description: "Explosive panda with grouped damage and artillery upgrades.",
      baseStats: { range: 132, damage: 2, fireRate: 0.72, projectileSpeed: 220, pierce: 8, splash: 34, shots: 1 },
      paths: [
        path("Huge bomb launcher path", [
          tier("Heavy Powder", 180, "Larger bomb blast radius.", { splashAdd: 10, damageAdd: 1 }),
          tier("Dense Shells", 260, "Bombs hit harder.", { damageAdd: 2 }),
          tier("Siege Bombs", 480, "Main path: giant blast damage.", { splashAdd: 18, damageAdd: 3 }),
          tier("Crater Maker", 920, "Explosions stagger enemies.", { stunDuration: 0.35, damageAdd: 2 }),
          tier("Valley Breaker", 2200, "Huge screen-shaking detonations.", { splashAdd: 26, damageAdd: 7, pierceAdd: 8 })
        ]),
        path("Many bomb launchers path", [
          tier("Quick Fuse", 160, "Attacks faster.", { fireRateMul: 1.18 }),
          tier("Side Rack", 225, "Launches an extra bomb.", { shotsAdd: 1 }),
          tier("Cluster Rack", 440, "Main path: fast multibomb shots.", { fireRateMul: 1.28, shotsAdd: 1 }),
          tier("Shrapnel Rain", 830, "Rapid-fire explosives.", { fireRateMul: 1.28, pierceAdd: 4 }),
          tier("Carpet Bomber", 2100, "Floods the track with bombs.", { fireRateMul: 1.35, shotsAdd: 2, splashAdd: 10 })
        ]),
        path("Mortar path", [
          tier("Long Arc", 150, "Can lob farther.", { rangeAdd: 300, attackMode: "mortar" }),
          tier("Signal Shells", 240, "Mortar shots land more precisely.", { damageAdd: 1, splashAdd: 8, attackMode: "mortar" }),
          tier("Mortar Panda", 490, "Main path: fires anywhere on the map.", { rangeAdd: 9999, attackMode: "mortar", damageAdd: 2 }),
          tier("Explosive Barrage", 940, "Unlocks barrage ability.", { attackMode: "mortar", ability: "bombardment" }),
          tier("Thunder Mortar", 2250, "Massive mortar shells.", { damageAdd: 6, splashAdd: 30, pierceAdd: 8, attackMode: "mortar" })
        ])
      ]
    },
    gunnerPanda: {
      id: "gunnerPanda",
      name: "Gunner Panda",
      color: "#dae3eb",
      accent: "#293447",
      baseCost: 290,
      description: "Reliable ranged panda with fast or long-range paths.",
      baseStats: { range: 150, damage: 1, fireRate: 3.2, projectileSpeed: 400, pierce: 1, shots: 1 },
      paths: [
        path("Machine gun path", [
          tier("Lighter Trigger", 140, "Attacks faster.", { fireRateMul: 1.2 }),
          tier("Cooling Belt", 210, "Even higher fire rate.", { fireRateMul: 1.22 }),
          tier("Machine Panda", 420, "Main path: torrent of fire.", { fireRateMul: 1.28, pierceAdd: 1 }),
          tier("Suppressing Stream", 790, "Stuns targets briefly.", { fireRateMul: 1.25, stunDuration: 0.12 }),
          tier("Leadstorm", 2050, "Ferocious bullet storm.", { fireRateMul: 1.42, damageAdd: 2, shotsAdd: 1 })
        ]),
        path("Sniper path", [
          tier("Scope", 165, "More range.", { rangeAdd: 55 }),
          tier("High Caliber", 240, "Hits harder.", { damageAdd: 2 }),
          tier("Watchtower", 460, "Main path: near-map range.", { rangeAdd: 300, damageAdd: 2, fireRateMul: 0.92 }),
          tier("Eagle Eye", 880, "Targets strong enemies better.", { strongBias: 22, critChance: 0.16 }),
          tier("Zenith Shot", 2300, "Extreme single-target damage.", { damageAdd: 10, fireRateMul: 0.88, critChance: 0.28 })
        ]),
        path("Double pistol path", [
          tier("Sidearm", 95, "Twin pistols.", { shotsAdd: 1 }),
          tier("Quick Draw", 130, "Faster twin shots.", { shotsAdd: 1, fireRateMul: 1.12 }),
          tier("Dual Pistols", 280, "Main path: cheap spread fire.", { shotsAdd: 2, projectileArc: 0.14 }),
          tier("Street Flurry", 560, "Close-range burst.", { fireRateMul: 1.2, pierceAdd: 1 }),
          tier("Rapid Duo", 1400, "Many cheap bullets.", { shotsAdd: 3, fireRateMul: 1.25, damageAdd: 1 })
        ])
      ]
    },
    pandaVillage: {
      id: "pandaVillage",
      name: "Panda Village",
      color: "#d9b46f",
      accent: "#6b4c25",
      baseCost: 420,
      description: "Support hub that buffs nearby pandas and can unlock team-wide boosts.",
      baseStats: { range: 0, supportRange: 138, supportRateBonus: 0.08, supportDamageBonus: 0.05, spawnRate: 0.35 },
      paths: [
        path("Buff nearby pandas path", [
          tier("Tea Break", 180, "Wider support radius.", { supportRangeAdd: 18 }),
          tier("Training Grounds", 260, "Stronger village buffs.", { supportRateBonusAdd: 0.05, supportDamageBonusAdd: 0.03 }),
          tier("Festival Drums", 520, "Main path: major support boosts.", { supportRangeAdd: 24, supportRateBonusAdd: 0.08, supportDamageBonusAdd: 0.05 }),
          tier("Command Banners", 980, "Nearby towers gain more range.", { supportRangeTowerAdd: 20 }),
          tier("Panda Capital", 2400, "Dominant late-game support.", { supportRateBonusAdd: 0.12, supportDamageBonusAdd: 0.08, supportRangeAdd: 32 })
        ]),
        path("Spawn pandas path", [
          tier("Scout Hut", 160, "Village can spawn helpers.", { helperSpawn: true }),
          tier("Bamboo Barracks", 240, "Helpers appear faster.", { helperSpawn: true, spawnRateMul: 1.25 }),
          tier("Panda Patrol", 460, "Main path: stronger helpers.", { helperSpawn: true, helperDamageAdd: 1, spawnRateMul: 1.28 }),
          tier("Patrol Squad", 860, "More active helper pandas.", { helperSpawn: true, helperCountAdd: 1, helperDamageAdd: 1 }),
          tier("Grand Parade", 2100, "Strong village patrol force.", { helperSpawn: true, helperCountAdd: 2, helperDamageAdd: 3, spawnRateMul: 1.3 })
        ]),
        path("Maniac buff path", [
          tier("Lively Music", 160, "Adds attack speed boost.", { supportRateBonusAdd: 0.04 }),
          tier("Wild Festival", 240, "Buffed towers gain damage.", { supportDamageBonusAdd: 0.05 }),
          tier("Panda Mania", 480, "Main path: unlocks rage ability.", { ability: "pandaRage", supportRateBonusAdd: 0.08 }),
          tier("Battle Chants", 920, "Rage lasts longer.", { rageDurationAdd: 3 }),
          tier("War Drums", 2250, "Huge offensive aura.", { supportRateBonusAdd: 0.1, supportDamageBonusAdd: 0.1, rageDurationAdd: 4 })
        ])
      ]
    },
    pandaScientist: {
      id: "pandaScientist",
      name: "Panda Scientist",
      color: "#cfe8df",
      accent: "#2d5d4d",
      baseCost: 360,
      description: "Potion support tower with scaling splash and precision ability path.",
      baseStats: { range: 145, damage: 2, fireRate: 0.8, projectileSpeed: 260, pierce: 4, splash: 26, supportRange: 118, supportDamageBonus: 0.04 },
      paths: [
        path("Support science path", [
          tier("Sharper Serum", 170, "Nearby towers gain more damage.", { supportDamageBonusAdd: 0.04, supportRangeAdd: 12 }),
          tier("Faster Formula", 260, "Boosts nearby attack speed.", { supportRateBonusAdd: 0.05 }),
          tier("Laboratory Tent", 510, "Main path: good support aura.", { supportDamageBonusAdd: 0.06, supportRateBonusAdd: 0.07, supportRangeAdd: 20 }),
          tier("Catalyst Cloud", 960, "Potions slow enemies.", { slowAmount: 0.18 }),
          tier("Arcane Research", 2300, "Top-tier support scientist.", { supportDamageBonusAdd: 0.1, supportRateBonusAdd: 0.1, supportRangeAdd: 24 })
        ]),
        path("Giant potion path", [
          tier("Stronger Flask", 150, "More damage.", { damageAdd: 1 }),
          tier("Volatile Mix", 230, "Bigger splashes.", { splashAdd: 10 }),
          tier("Mega Potion", 470, "Main path: giant potion projectiles.", { damageAdd: 3, splashAdd: 18, pierceAdd: 3 }),
          tier("Chain Reagent", 880, "Leaves lingering damage pools.", { acidPool: true, damageAdd: 1 }),
          tier("Cataclysm Brew", 2200, "Massive potion bursts.", { damageAdd: 6, splashAdd: 28, pierceAdd: 6 })
        ]),
        path("Ability science path", [
          tier("Emergency Vials", 165, "Faster attack speed.", { fireRateMul: 1.15 }),
          tier("Stabilized Mix", 240, "Better range.", { rangeAdd: 25 }),
          tier("Potion Blast", 520, "Main path: unlocks instant-kill burst.", { ability: "potionBlast" }),
          tier("Quick Recharge", 980, "Shorter potion blast cooldown.", { abilityCooldownMul: 0.82 }),
          tier("Omega Formula", 2350, "Stronger potion blast and tower damage.", { damageAdd: 3, abilityMaxKillsAdd: 2, abilityRadiusAdd: 18 })
        ])
      ]
    },
    pandaTamer: {
      id: "pandaTamer",
      name: "Panda Tamer",
      color: "#f8e5be",
      accent: "#7b5b2a",
      baseCost: 390,
      description: "Commands animal companions. Shark upgrades need nearby water.",
      baseStats: { range: 155, damage: 2, fireRate: 1.1, projectileSpeed: 300, pierce: 2, companion: "tiger" },
      paths: [
        path("Tiger path", [
          tier("Claw Drills", 180, "Tiger companion attacks faster.", { fireRateMul: 1.18, companion: "tiger" }),
          tier("Prowl Hunt", 260, "Tiger deals more damage.", { damageAdd: 2, companion: "tiger" }),
          tier("Alpha Tiger", 520, "Main path: tiger mauls tougher enemies.", { damageAdd: 3, pierceAdd: 2, companion: "tiger" }),
          tier("Rending Swipe", 980, "Tiger causes bleed.", { bleedDamage: 5 }),
          tier("Jungle Sovereign", 2350, "Massive tiger strikes.", { damageAdd: 7, fireRateMul: 1.18, pierceAdd: 2 })
        ]),
        path("Eagle path", [
          tier("Sky Signals", 150, "Eagle companion gains range.", { rangeAdd: 40, companion: "eagle" }),
          tier("Dive Marks", 220, "Faster strikes from above.", { fireRateMul: 1.15, companion: "eagle" }),
          tier("Storm Eagle", 470, "Main path: ranged multi-hit companion.", { shotsAdd: 1, pierceAdd: 2, companion: "eagle" }),
          tier("Cyclone Feathers", 890, "Splashy aerial attacks.", { splashAdd: 16 }),
          tier("Sky Tyrant", 2150, "Very fast map control.", { fireRateMul: 1.32, shotsAdd: 1, damageAdd: 3 })
        ]),
        path("Shark path", [
          tier("Water Bond", 170, "Requires water nearby. Shark lunges from ponds.", { companion: "shark", requiresWater: true }),
          tier("Razor Fin", 250, "Stronger water strikes.", { damageAdd: 2, requiresWater: true }),
          tier("River Hunter", 500, "Main path: shark attacks from water.", { damageAdd: 3, splashAdd: 20, requiresWater: true, companion: "shark" }),
          tier("Tidal Rush", 920, "Shark dashes through groups.", { fireRateMul: 1.2, pierceAdd: 4, requiresWater: true }),
          tier("Deep Terror", 2250, "Powerful shark surges.", { damageAdd: 6, splashAdd: 28, requiresWater: true })
        ])
      ]
    },
    pandaEngineer: {
      id: "pandaEngineer",
      name: "Panda Engineer",
      color: "#d1d5db",
      accent: "#48515b",
      baseCost: 410,
      description: "Utility tower that builds devices, sentries, and track robots.",
      baseStats: { range: 132, damage: 1, fireRate: 1.05, projectileSpeed: 260, pierce: 2, buildRate: 0.2 },
      paths: [
        path("Bomber devices path", [
          tier("Charge Packs", 180, "Drops stronger bombs on the track.", { mineLayer: true }),
          tier("Quick Builders", 260, "Places mines more often.", { mineLayer: true, buildRateMul: 1.28 }),
          tier("Bomb Workshop", 510, "Main path: strong bomber devices.", { mineLayer: true, mineDamageAdd: 4, buildRateMul: 1.3 }),
          tier("Chain Charges", 980, "Mines splash harder.", { mineSplashAdd: 18 }),
          tier("Demolition Yard", 2250, "Heavy demolitions across the lane.", { mineDamageAdd: 8, buildRateMul: 1.35, mineSplashAdd: 22 })
        ]),
        path("Mini guns path", [
          tier("Auto Sentry", 160, "Deploys a sentry gun.", { sentry: true }),
          tier("Twin Sentry", 230, "Better sentry damage.", { sentry: true, sentryDamageAdd: 1 }),
          tier("Mini Gun Nest", 460, "Main path: stronger sentry support.", { sentry: true, sentryDamageAdd: 2, sentryRateMul: 1.2 }),
          tier("Rapid Nest", 860, "Sentries fire quickly.", { sentryRateMul: 1.25, sentryCountAdd: 1 }),
          tier("Fortified Nest", 2150, "Dominant mini-gun coverage.", { sentryDamageAdd: 3, sentryRateMul: 1.3, sentryCountAdd: 1 })
        ]),
        path("Robot path", [
          tier("Servo Core", 180, "Engineer attacks faster.", { fireRateMul: 1.12 }),
          tier("Track Scanner", 260, "Wider range.", { rangeAdd: 24 }),
          tier("Charge Bot", 520, "Main path: unlocks robot charge cycle.", { robotCharge: true }),
          tier("Quick Capacitor", 960, "Charge refreshes faster.", { robotCooldownMul: 0.8 }),
          tier("Arc Runner", 2350, "Stronger charging robot.", { robotDamageAdd: 10, robotCooldownMul: 0.78 })
        ])
      ]
    },
    bambooFarm: {
      id: "bambooFarm",
      name: "Bamboo Farm",
      color: "#83b64c",
      accent: "#355d23",
      baseCost: 300,
      description: "Economic tower that creates bamboo income in different ways.",
      baseStats: { range: 0, income: 50, autoIncome: 0, farmRange: 120 },
      paths: [
        path("Large bamboo batches path", [
          tier("Dense Grove", 140, "Bigger manual bundles.", { incomeAdd: 25 }),
          tier("Packed Baskets", 210, "Even larger crate value.", { incomeAdd: 35 }),
          tier("Harvest Depot", 420, "Main path: valuable manual crates.", { incomeAdd: 60 }),
          tier("Golden Bamboo", 820, "Very high crate payout.", { incomeAdd: 90 }),
          tier("Imperial Harvest", 2100, "Huge collectible payouts.", { incomeAdd: 160 })
        ]),
        path("Small fast automatic income path", [
          tier("Small Shoots", 150, "Adds passive auto income.", { autoIncomeAdd: 16 }),
          tier("Fast Bundles", 220, "More auto income.", { autoIncomeAdd: 22 }),
          tier("Processing Mill", 450, "Main path: strong passive income.", { autoIncomeAdd: 36 }),
          tier("Rail Crates", 860, "Bigger automatic payouts.", { autoIncomeAdd: 54 }),
          tier("Bamboo Exchange", 2200, "Late-game automatic income engine.", { autoIncomeAdd: 90 })
        ]),
        path("Farm buff path", [
          tier("Fertilizer", 130, "Nearby farms make more money.", { farmBuff: 0.08 }),
          tier("Irrigation", 210, "Better nearby farm bonus.", { farmBuff: 0.12 }),
          tier("Co-op Market", 430, "Main path: strong nearby farm boost.", { farmBuff: 0.18 }),
          tier("Trade Office", 840, "Bigger farm radius.", { farmBuff: 0.22, farmRangeAdd: 30 }),
          tier("Bamboo Syndicate", 2100, "Top-tier eco support.", { farmBuff: 0.32, farmRangeAdd: 50 })
        ])
      ]
    }
  };

  PandaTD.TOWER_ORDER = [
    "classicPanda",
    "bomberPanda",
    "gunnerPanda",
    "pandaVillage",
    "pandaScientist",
    "pandaTamer",
    "pandaEngineer",
    "bambooFarm"
  ];
})();
