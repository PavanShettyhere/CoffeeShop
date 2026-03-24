import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = process.cwd();
const screenshotPath = path.join(workspace, "assets", "velvet-pour-ui.png");
const port = 9333;

function detectChrome() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  const found = candidates.find((entry) => existsSync(entry));
  if (!found) throw new Error("No Chrome or Edge browser binary found");
  return found;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      void error;
    }
    await wait(250);
  }
  throw new Error(`Unable to fetch ${url}`);
}

function createClient(wsUrl) {
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  const socket = new WebSocket(wsUrl);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const record = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) record.reject(new Error(message.error.message));
      else record.resolve(message.result);
      return;
    }
    const queue = listeners.get(message.method);
    if (queue && queue.length) {
      const next = queue.shift();
      next(message.params);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  function waitFor(method) {
    return new Promise((resolve) => {
      const queue = listeners.get(method) || [];
      queue.push(resolve);
      listeners.set(method, queue);
    });
  }

  return {
    socket,
    send,
    waitFor
  };
}

async function main() {
  const chromePath = detectChrome();
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    "about:blank"
  ], { stdio: "ignore" });

  try {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find((entry) => entry.type === "page");
    if (!target) throw new Error("No debuggable page target found");

    const client = createClient(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      client.socket.addEventListener("open", resolve, { once: true });
      client.socket.addEventListener("error", reject, { once: true });
    });

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1720,
      height: 980,
      deviceScaleFactor: 1,
      mobile: false
    });

    const pageUrl = `${pathToFileURL(path.join(workspace, "index.html")).href}?debug=1`;
    const loaded = client.waitFor("Page.loadEventFired");
    await client.send("Page.navigate", { url: pageUrl });
    await loaded;

    await wait(1500);

    await client.send("Runtime.evaluate", {
      expression: `
        (async () => {
          const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const app = window.__VelvetPourApp;
          if (!app) return { error: "app-missing" };
          const game = app.game;
          app.setView("game");
          game.startShift();
          await delay(150);
          game.debugClearCustomers();
          game.debugInjectCustomer("espresso");
          await delay(100);
          game.debugSetPlayer(2, 1);
          game.doAction("cup_espresso");
          await delay(750);
          game.debugSetPlayer(2, 3);
          game.doAction("grind");
          await delay(1450);
          game.debugSetPlayer(3, 2);
          game.doAction("espresso");
          await delay(1700);
          game.debugSetPlayer(4, 6);
          game.doAction("serve");
          await delay(800);
          return {
            snapshot: game.getSnapshot(),
            layout: {
              viewport: { width: window.innerWidth, height: window.innerHeight },
              scrollHeight: document.documentElement.scrollHeight,
              gameLayout: document.querySelector(".game-layout")?.getBoundingClientRect(),
              board: document.getElementById("menuBoard")?.getBoundingClientRect(),
              stage: document.querySelector(".stage-shell")?.getBoundingClientRect(),
              leftRail: document.querySelector(".left-rail")?.getBoundingClientRect(),
              rightRail: document.querySelector(".right-rail")?.getBoundingClientRect()
            }
          };
        })();
      `,
      awaitPromise: true,
      returnByValue: true
    });

    await wait(1200);

    const shot = await client.send("Page.captureScreenshot", { format: "png" });
    mkdirSync(path.dirname(screenshotPath), { recursive: true });
    writeFileSync(screenshotPath, Buffer.from(shot.data, "base64"));

    const results = await client.send("Runtime.evaluate", {
      expression: `
        (() => {
          const app = window.__VelvetPourApp;
          return app ? app.game.getSnapshot() : null;
        })();
      `,
      returnByValue: true
    });

    console.log(JSON.stringify({
      screenshotPath,
      snapshot: results.result.value
    }, null, 2));

    client.socket.close();
  } finally {
    chrome.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
