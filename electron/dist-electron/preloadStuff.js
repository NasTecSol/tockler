"use strict";
const { contextBridge, ipcRenderer, shell } = require("electron");
const Store = require("electron-store");
const Sentry = require("@sentry/electron");
const config = new Store();
if (process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version,
    beforeSend(event) {
      if (event && typeof event === "object" && "exception" in event) {
        Sentry.showReportDialog();
      }
      return event;
    }
  });
}
const listeners = {};
contextBridge.exposeInMainWorld("electronBridge", {
  configGet: (key) => {
    return config.get(key);
  },
  configSet: (key, value) => {
    return config.set(key, value);
  },
  platform: process.platform,
  isMas: process.mas === true,
  appVersion: () => ipcRenderer.invoke("get-app-version"),
  openUrlInExternalWindow: (url) => {
    console.info("URL", url);
    if (url.startsWith("file://") || url.startsWith("http://127.0.0.1:3000")) {
      return;
    }
    shell.openExternal(url);
  },
  invokeIpc: async (actionName, payload) => {
    return await ipcRenderer.invoke(actionName, payload);
  },
  sendIpc: (key, ...args) => {
    console.debug("Send message with key: " + key, args);
    ipcRenderer.send(key, ...args);
  },
  onIpc: (key, fn) => {
    const saferFn = (_event, ...args) => fn(...args);
    console.debug("Add listener with key: " + key);
    ipcRenderer.on(key, saferFn);
    listeners[key] = saferFn;
  },
  removeListenerIpc: (key) => {
    console.debug("Remove listener with key: " + key);
    const fn = listeners[key];
    ipcRenderer.removeListener(key, fn);
    delete listeners[key];
  }
});
window.Sentry = Sentry;
