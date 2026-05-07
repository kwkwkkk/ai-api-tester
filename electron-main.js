'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

let mainWindow;
let server;
const PORT = Number(process.env.PORT || '3210');
const HOST = process.env.HOST || '127.0.0.1';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url, retries = 40) {
  let lastError = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (error) {
      lastError = error;
    }
    await wait(500);
  }
  throw new Error(`Server did not start in time${lastError ? `: ${lastError.message}` : ''}`);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  const url = `http://${HOST}:${PORT}`;
  try {
    await waitForServer(`${url}/api/health`, 50);
    await mainWindow.loadURL(url);
  } catch (error) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'AI API Tester 启动失败',
      message: '本地服务没有成功启动',
      detail: String(error?.message || error)
    });
    await mainWindow.loadURL(`data:text/html,${encodeURIComponent(`<html><body style="font-family:sans-serif;padding:24px;background:#111827;color:#fff"><h2>AI API Tester 启动失败</h2><pre style="white-space:pre-wrap">${String(error?.message || error)}</pre></body></html>`)}`);
  }
}

app.whenReady().then(async () => {
  try {
    const appCoreUrl = pathToFileURL(path.join(__dirname, 'app-core.mjs')).href;
    const appCore = await import(appCoreUrl);
    server = await appCore.startServer({
      port: PORT,
      host: HOST,
      staticRoot: path.join(__dirname, 'public')
    });
  } catch (error) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'AI API Tester 服务启动失败',
      message: '无法启动内置服务',
      detail: String(error?.message || error)
    });
  }

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});
