import process from "node:process";

const port = Number(process.argv[2] || 9222);
const timeoutSeconds = Math.max(10, Number(process.argv[3] || 35));
const deadline = Date.now() + timeoutSeconds * 1000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function inspectTarget(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("DevTools websocket did not open.")), 4000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("DevTools websocket connection failed.")); }, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  socket.addEventListener("message", event => {
    let message;
    try { message = JSON.parse(String(event.data)); } catch { return; }
    if (message.method === "Runtime.exceptionThrown") {
      exceptions.push(message.params?.exceptionDetails?.text || "Renderer exception");
    }
    if (message.id && pending.has(message.id)) {
      const entry = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(message.error.message || "DevTools command failed."));
      else entry.resolve(message.result);
    }
  });

  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Timed out waiting for " + method));
    }, 5000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });

  try {
    await command("Runtime.enable");
    const result = await command("Runtime.evaluate", {
      returnByValue: true,
      awaitPromise: true,
      expression: `(() => {
        const root = document.querySelector("#root");
        const style = root ? getComputedStyle(root) : null;
        const rect = root ? root.getBoundingClientRect() : null;
        const rootText = (root?.innerText || "").trim();
        const bodyText = (document.body?.innerText || "").trim();
        return {
          title: document.title || "",
          readyState: document.readyState,
          rootExists: Boolean(root),
          rootVisible: Boolean(root && style && rect && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0),
          rootText: rootText.slice(0, 800),
          bodyText: bodyText.slice(0, 800)
        };
      })()`
    });
    return { ...(result.result?.value || {}), exceptions };
  } finally {
    socket.close();
  }
}

if (typeof WebSocket !== "function") {
  throw new Error("This smoke test requires Node.js 22's built-in WebSocket support.");
}

let lastError = "The app did not expose a Chromium DevTools page.";
while (Date.now() < deadline) {
  try {
    const response = await fetch("http://127.0.0.1:" + port + "/json");
    if (!response.ok) throw new Error("DevTools returned HTTP " + response.status);
    const targets = await response.json();
    const pages = Array.isArray(targets) ? targets.filter(item => item.type === "page" && item.webSocketDebuggerUrl) : [];
    for (const target of pages) {
      try {
        const state = await inspectTarget(target);
        const renderedText = String(state.rootText || state.bodyText || "");
        if (state.rootExists && state.rootVisible && renderedText.length >= 20) {
          process.stdout.write(JSON.stringify({
            ok: true,
            title: state.title,
            readyState: state.readyState,
            renderedText: renderedText.slice(0, 240),
            rendererExceptions: state.exceptions.length
          }, null, 2) + "\n");
          process.exit(0);
        }
        lastError = "Renderer root was missing, hidden, or empty: " + JSON.stringify(state);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  await sleep(600);
}
throw new Error("Packaged Windows AXIVESTRA renderer smoke test failed: " + lastError);
