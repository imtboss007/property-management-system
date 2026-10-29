const { app, BrowserWindow, shell, ipcMain, Tray, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { createWhatsAppService } = require("./whatsapp-service.cjs");

// Preserve the existing Windows browser profile, linked WhatsApp session, message queue and caches
// after the visible product is renamed AXIVESTRA. productName otherwise changes Electron userData.
const previousProductDataPath = path.join(app.getPath("appData"), "EstateFlow");
fs.mkdirSync(previousProductDataPath, { recursive: true });
app.setPath("userData", previousProductDataPath);

let mainWindow = null;
let tray = null;
let whatsappService = null;
let isQuitting = false;

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 980, minHeight: 700,
    show: false, autoHideMenuBar: true, title: "AXIVESTRA — Asset Intelligence",
    backgroundColor: "#071525",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow = win;
  // A Windows logon launch starts the sender hidden so schedules can keep running
  // without opening a visible window; the tray menu can always restore the window.
  const launchHidden = process.argv.includes("--hidden");
  win.once("ready-to-show", () => { if (!launchHidden) win.show(); });
  win.on("closed", () => { if (mainWindow === win) mainWindow = null; });
  win.on("close", event => {
    if (!isQuitting && process.platform === "win32") {
      event.preventDefault();
      win.hide();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

async function createTray() {
  try {
    const icon = await app.getFileIcon(process.execPath, { size: "small" });
    tray = new Tray(icon);
    tray.setToolTip("AXIVESTRA — Asset Intelligence running");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open AXIVESTRA", click: () => createWindow() },
      { type: "separator" },
      { label: "Exit AXIVESTRA", click: () => { isQuitting = true; if (whatsappService) whatsappService.stop(); app.quit(); } }
    ]));
    tray.on("double-click", () => createWindow());
  } catch (_) {}
}

app.whenReady().then(() => {
  // Opt into run-at-login for the packaged Windows app. The background process starts
  // hidden and is controlled through its tray icon; Exit AXIVESTRA stops scheduling.
  if (process.platform === "win32" && app.isPackaged) {
    try {
      app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: ["--hidden"] });
    } catch (_) {}
  }
  whatsappService = createWhatsAppService({
    app, ipcMain,
    notify: payload => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send("estateflow:wa:update", payload);
      }
    }
  });
  createWindow();
  void createTray();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) createWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  if (whatsappService) whatsappService.stop();
});
app.on("window-all-closed", () => {});
