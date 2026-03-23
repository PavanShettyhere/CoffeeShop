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

  function noop() {}

  window.__velvetPour = {
    canvas,
    ctx,
    ui,
    actionMeta,
    recipes,
    recipeMap,
    stations,
    customerNames,
    palette,
    state,
    player,
    origin,
    TILE_W,
    TILE_H,
    GRID_W,
    GRID_H,
    audio,
    lastTime,
    noop
  };
}());
