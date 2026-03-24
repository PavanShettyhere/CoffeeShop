(function (global) {
  const actionMeta = {
    cup_espresso: { label: "Espresso Cup", detail: "Grab a small ceramic espresso cup." },
    cup_tulip: { label: "Tulip Cup", detail: "Grab a rounded cup for milk drinks." },
    cup_mug: { label: "House Mug", detail: "Grab the larger mug for americanos and mochas." },
    grind: { label: "Grind Beans", detail: "Prepare fresh grounds for espresso extraction." },
    espresso: { label: "Pull Espresso", detail: "Extract a standard espresso shot." },
    ristretto: { label: "Pull Ristretto", detail: "Extract a sweeter, shorter espresso shot." },
    hot_water: { label: "Add Hot Water", detail: "Lengthen the drink for an americano." },
    steam_milk: { label: "Steam Milk", detail: "Texture milk for a latte or mocha." },
    foam_cap: { label: "Top With Foam", detail: "Finish the cappuccino with a foam cap." },
    microfoam: { label: "Pour Microfoam", detail: "Pour silky microfoam for a flat white." },
    mocha_sauce: { label: "Add Mocha Sauce", detail: "Lay the chocolate base before espresso." },
    whip: { label: "Top Whipped Cream", detail: "Finish the mocha with whipped cream." },
    serve: { label: "Serve Drink", detail: "Hand the finished drink to the first customer." }
  };

  const recipes = [
    {
      key: "espresso",
      name: "Espresso",
      boardLabel: "ESPRESSO",
      cupName: "Espresso cup",
      basePrice: 2.5,
      patience: 88,
      tools: "Cup wall, grinder, espresso machine",
      note: "A focused shot with crema in a small cup.",
      trainerTip: "This is the base drink. Fast, compact, and intense.",
      sequence: ["cup_espresso", "grind", "espresso"],
      steps: ["Grab espresso cup", "Grind beans", "Pull espresso shot"]
    },
    {
      key: "americano",
      name: "Caffe Americano",
      boardLabel: "AMERICANO",
      cupName: "House mug",
      basePrice: 3.5,
      patience: 95,
      tools: "Cup wall, water tap, grinder, espresso machine",
      note: "Hot water first, then two espresso shots.",
      trainerTip: "Add the water before the espresso shots to preserve the top layer feel.",
      sequence: ["cup_mug", "hot_water", "grind", "espresso", "espresso"],
      steps: ["Grab house mug", "Add hot water", "Grind beans", "Pull espresso shot", "Pull second espresso shot"]
    },
    {
      key: "cappuccino",
      name: "Classic Cappuccino",
      boardLabel: "CAPPUCCINO",
      cupName: "Tulip cup",
      basePrice: 3.75,
      patience: 102,
      tools: "Cup wall, grinder, espresso machine, steam wand",
      note: "Espresso with milk and a generous foam cap.",
      trainerTip: "The foam finish should feel taller and airier than a latte.",
      sequence: ["cup_tulip", "grind", "espresso", "steam_milk", "foam_cap"],
      steps: ["Grab tulip cup", "Grind beans", "Pull espresso shot", "Steam milk", "Top with foam cap"]
    },
    {
      key: "latte",
      name: "Caffe Latte",
      boardLabel: "LATTE",
      cupName: "Tulip cup",
      basePrice: 4.5,
      patience: 106,
      tools: "Cup wall, grinder, espresso machine, steam wand",
      note: "Espresso finished with steamed milk and a light foam layer.",
      trainerTip: "A latte should finish smoother and silkier than a cappuccino.",
      sequence: ["cup_tulip", "grind", "espresso", "steam_milk"],
      steps: ["Grab tulip cup", "Grind beans", "Pull espresso shot", "Steam milk"]
    },
    {
      key: "flat_white",
      name: "Flat White",
      boardLabel: "FLAT WHITE",
      cupName: "Tulip cup",
      basePrice: 4.2,
      patience: 110,
      tools: "Cup wall, grinder, espresso machine, steam wand",
      note: "Two ristretto shots and velvety microfoam.",
      trainerTip: "Use shorter shots and polished milk texture.",
      sequence: ["cup_tulip", "grind", "ristretto", "ristretto", "microfoam"],
      steps: ["Grab tulip cup", "Grind beans", "Pull ristretto shot", "Pull second ristretto shot", "Pour microfoam"]
    },
    {
      key: "mocha",
      name: "Caffe Mocha",
      boardLabel: "MOCHA",
      cupName: "House mug",
      basePrice: 4.9,
      patience: 112,
      tools: "Cup wall, syrup rail, grinder, espresso machine, steam wand, topping bar",
      note: "Mocha sauce, espresso, milk, then whipped cream.",
      trainerTip: "Chocolate base first so the espresso integrates cleanly.",
      sequence: ["cup_mug", "mocha_sauce", "grind", "espresso", "steam_milk", "whip"],
      steps: ["Grab house mug", "Add mocha sauce", "Grind beans", "Pull espresso shot", "Steam milk", "Top whipped cream"]
    }
  ];

  const stations = [
    { id: "cups", name: "Cup Wall", label: "CUP WALL", type: "cups", tile: { x: 1, y: 1 }, useTile: { x: 2, y: 1 }, height: 74, color: "#b98e61", accent: "#ffcf87", actions: ["cup_espresso", "cup_tulip", "cup_mug"], description: "Pick the correct cup before you start." },
    { id: "grinder", name: "Precision Grinder", label: "GRINDER", type: "grinder", tile: { x: 1, y: 3 }, useTile: { x: 2, y: 3 }, height: 90, color: "#5d6974", accent: "#67d9df", actions: ["grind"], description: "Fresh grounds first for espresso drinks." },
    { id: "espresso", name: "Aurora Espresso", label: "ESPRESSO", type: "espresso", tile: { x: 3, y: 1 }, useTile: { x: 3, y: 2 }, height: 88, color: "#875c48", accent: "#ff8a3d", actions: ["espresso", "ristretto"], description: "Pull full shots or shorter ristretto shots." },
    { id: "steam", name: "Steam Wand", label: "STEAM WAND", type: "steam", tile: { x: 5, y: 1 }, useTile: { x: 5, y: 2 }, height: 92, color: "#728390", accent: "#c8f6ff", actions: ["steam_milk", "foam_cap", "microfoam"], description: "Steam milk, build foam, or polish microfoam." },
    { id: "water", name: "Hot Water Tap", label: "HOT WATER", type: "water", tile: { x: 7, y: 1 }, useTile: { x: 7, y: 2 }, height: 78, color: "#4c6f88", accent: "#90e7ff", actions: ["hot_water"], description: "Add hot water for americanos." },
    { id: "syrup", name: "Syrup Rail", label: "SYRUP RAIL", type: "syrup", tile: { x: 8, y: 3 }, useTile: { x: 7, y: 3 }, height: 74, color: "#83535d", accent: "#ffc777", actions: ["mocha_sauce"], description: "Mocha sauce and sweet flavor base." },
    { id: "topping", name: "Topping Bar", label: "TOPPING BAR", type: "topping", tile: { x: 8, y: 5 }, useTile: { x: 7, y: 5 }, height: 72, color: "#65715e", accent: "#f7f8ff", actions: ["whip"], description: "Finish drinks with whipped cream." },
    { id: "counter", name: "Front Counter", label: "SERVICE COUNTER", type: "counter", tile: { x: 4, y: 7 }, useTile: { x: 4, y: 6 }, height: 98, color: "#6e5648", accent: "#ffbc57", actions: ["serve"], description: "Serve the front customer here." }
  ];

  const queueTiles = [
    { x: 4, y: 8 },
    { x: 3, y: 8 },
    { x: 2, y: 8 },
    { x: 1, y: 8 }
  ];

  const customerNames = ["Mia", "Noah", "Theo", "Avery", "Lina", "Kai", "Nova", "Ezra", "Jules", "Ivy", "Zara"];

  const customerLooks = [
    { skin: "#f1c7a7", shirt: "#ff8b64", pants: "#355f74", hair: "#362117", accent: "#ffd4c3", apron: "#f7f0ea", cap: "none", gender: "woman", lowerWear: "pleated", eyeColor: "#4f3421", hairStyle: "wave", accessory: "flower" },
    { skin: "#cc9377", shirt: "#67d9df", pants: "#264356", hair: "#1a2430", accent: "#d4fbff", apron: "#eff3f8", cap: "beanie", gender: "man", lowerWear: "straight", eyeColor: "#355273", hairStyle: "fade", accessory: "none" },
    { skin: "#a86f56", shirt: "#f3d36c", pants: "#5c3853", hair: "#2a180f", accent: "#fff4c4", apron: "#fff8e8", cap: "none", gender: "man", lowerWear: "joggers", eyeColor: "#4f3421", hairStyle: "short", accessory: "none" },
    { skin: "#efd0bf", shirt: "#91e0a0", pants: "#524d77", hair: "#6f5038", accent: "#efffe8", apron: "#f2fbf2", cap: "visor", gender: "woman", lowerWear: "skirt", eyeColor: "#2f7b73", hairStyle: "ponytail", accessory: "clip" },
    { skin: "#8c5f4d", shirt: "#ee6c8d", pants: "#335149", hair: "#20120c", accent: "#ffd6df", apron: "#fff0f3", cap: "none", gender: "woman", lowerWear: "culottes", eyeColor: "#7a2a48", hairStyle: "bun", accessory: "flower" }
  ];

  const avatarOptions = {
    defaultProfile: {
      gender: "woman",
      skin: "#d5a07e",
      shirt: "#f0a24d",
      pants: "#24384b",
      hair: "#3b2418",
      apron: "#f1f4fb",
      cap: "barista",
      lowerWear: "tapered",
      eyeColor: "#4f3421",
      hairStyle: "wave",
      accessory: "none"
    },
    genders: [
      { value: "woman", label: "Woman" },
      { value: "man", label: "Man" },
      { value: "neutral", label: "Neutral" }
    ],
    skinTones: ["#f6dccb", "#efc6a8", "#e4b693", "#d5a07e", "#b57c61", "#9a6b57", "#7d513f"],
    shirts: ["#f0a24d", "#67d9df", "#91e0a0", "#ef7d57", "#c38fff", "#ffcc66", "#6ea8ff", "#f28fb1"],
    pants: ["#24384b", "#355f74", "#5c3853", "#1f2a37", "#3f4d2b", "#6b4f3d", "#334e68", "#5a5d7d"],
    hair: ["#120b08", "#2a180f", "#3b2418", "#5d4431", "#7a5a3e", "#1b2531", "#6a2b1d", "#a16a2a"],
    eyeColors: ["#4f3421", "#355273", "#2f7b73", "#7a2a48", "#6a4d9c", "#6b8f2a"],
    aprons: ["#f1f4fb", "#fff0db", "#e8f7ff", "#eef7e8", "#ffe9ef", "#fff8d8", "#ece7ff"],
    caps: [
      { value: "barista", label: "Barista Cap" },
      { value: "visor", label: "Visor" },
      { value: "beanie", label: "Beanie" },
      { value: "beret", label: "Beret" },
      { value: "snapback", label: "Snapback" },
      { value: "headwrap", label: "Headwrap" },
      { value: "none", label: "No Cap" }
    ],
    hairStylesByGender: {
      woman: [
        { value: "wave", label: "Soft Waves" },
        { value: "bob", label: "Bob Cut" },
        { value: "ponytail", label: "Ponytail" },
        { value: "bun", label: "Bun" },
        { value: "braid", label: "Braid" },
        { value: "long", label: "Long Hair" }
      ],
      man: [
        { value: "short", label: "Short Cut" },
        { value: "fade", label: "Fade" },
        { value: "quiff", label: "Quiff" },
        { value: "curly", label: "Curly Top" },
        { value: "slick", label: "Slick Back" }
      ],
      neutral: [
        { value: "short", label: "Short Cut" },
        { value: "wave", label: "Soft Waves" },
        { value: "curly", label: "Curly Top" },
        { value: "bob", label: "Bob Cut" },
        { value: "slick", label: "Slick Back" }
      ]
    },
    accessoriesByGender: {
      woman: [
        { value: "none", label: "None" },
        { value: "flower", label: "Flower" },
        { value: "clip", label: "Hair Clip" },
        { value: "ribbon", label: "Ribbon" }
      ],
      man: [
        { value: "none", label: "None" },
        { value: "band", label: "Head Band" },
        { value: "stud", label: "Stud" }
      ],
      neutral: [
        { value: "none", label: "None" },
        { value: "band", label: "Head Band" },
        { value: "clip", label: "Hair Clip" }
      ]
    },
    lowerWearByGender: {
      woman: [
        { value: "tapered", label: "Tapered Pants" },
        { value: "wide", label: "Wide Pants" },
        { value: "skirt", label: "Cafe Skirt" },
        { value: "pleated", label: "Pleated Skirt" },
        { value: "culottes", label: "Culottes" }
      ],
      man: [
        { value: "tapered", label: "Tapered Pants" },
        { value: "straight", label: "Straight Pants" },
        { value: "joggers", label: "Joggers" },
        { value: "apron_pants", label: "Apron Pants" }
      ],
      neutral: [
        { value: "tapered", label: "Tapered Pants" },
        { value: "straight", label: "Straight Pants" },
        { value: "wide", label: "Wide Pants" },
        { value: "culottes", label: "Culottes" },
        { value: "apron_pants", label: "Apron Pants" }
      ]
    }
  };

  const sources = [
    { label: "Coffee Association of Canada: Styles of Coffee", href: "https://coffeeassoc.com/coffee-101/styles-of-coffee/" },
    { label: "Starbucks At Home: Classic Cappuccino", href: "https://athome.starbucks.com/recipe/classic-cappuccino" },
    { label: "Starbucks At Home: Caffe Latte", href: "https://athome.starbucks.com/recipe/caffe-latte" },
    { label: "Starbucks At Home: Caffe Mocha", href: "https://athome.starbucks.com/recipe/caffe-mocha" },
    { label: "Starbucks At Home: Flat White", href: "https://athome.starbucks.com/recipe/flat-white" },
    { label: "Starbucks At Home: Caffe Americano", href: "https://athome.starbucks.com/recipe/caffe-americano" }
  ];

  global.VelvetPourData = {
    actionMeta,
    recipes,
    stations,
    queueTiles,
    customerNames,
    customerLooks,
    sources,
    avatarOptions
  };
}(window));
