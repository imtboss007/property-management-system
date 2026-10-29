const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("estateflowWhatsApp", {
  getStatus: () => ipcRenderer.invoke("estateflow:wa:get-status"),
  getQueue: () => ipcRenderer.invoke("estateflow:wa:get-queue"),
  getAddressBook: () => ipcRenderer.invoke("estateflow:wa:get-address-book"),
  syncAddressBook: () => ipcRenderer.invoke("estateflow:wa:sync-address-book"),
  getBridgeInfo: () => ipcRenderer.invoke("estateflow:wa:get-bridge-info"),
  getDataSync: () => ipcRenderer.invoke("estateflow:wa:get-data-sync"),
  saveDataSync: (expectedRevision, snapshot) => ipcRenderer.invoke("estateflow:wa:save-data-sync", { expectedRevision, snapshot }),
  connect: () => ipcRenderer.invoke("estateflow:wa:connect"),
  requestPairingCode: phone => ipcRenderer.invoke("estateflow:wa:pairing-code", phone),
  disconnect: () => ipcRenderer.invoke("estateflow:wa:disconnect"),
  schedule: payload => ipcRenderer.invoke("estateflow:wa:schedule", payload),
  sendNow: payload => ipcRenderer.invoke("estateflow:wa:send-now", payload),
  cancel: id => ipcRenderer.invoke("estateflow:wa:cancel", id),
  retry: id => ipcRenderer.invoke("estateflow:wa:retry", id),
  onUpdate: callback => {
    if (typeof callback !== "function") return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("estateflow:wa:update", handler);
    return () => ipcRenderer.removeListener("estateflow:wa:update", handler);
  }
});
