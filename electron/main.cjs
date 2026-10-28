const { app, BrowserWindow, shell, ipcMain, Tray, Menu } = require("electron");
const path = require("node:path");
const { createWhatsAppService } = require("./whatsapp-service.cjs");

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
    backgroundColor: "#f6f7f3",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  mainWindow = win;
  win.once("ready-to-show", () => win.show());
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
    tray.setToolTip("EstateFlow — WhatsApp scheduler running");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open EstateFlow", click: () => createWindow() },
      { type: "separator" },
      { label: "Exit EstateFlow", click: () => { isQuitting = true; if (whatsappService) whatsappService.stop(); app.quit(); } }
    ]));
    tray.on("double-click", () => createWindow());
  } catch (_) {}
}

app.whenReady().then(() => {
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
