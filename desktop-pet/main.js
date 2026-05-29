const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { uiohook } = require('uiohook-napi');

let mainWindow;

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 200,
        height: 200,
        x: width - 250,
        y: height - 250,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        skipTaskbar: true,
        hasShadow: false,
    });

    mainWindow.loadFile('index.html');
    
    // Set to ignore mouse events so it's click-through by default
    // We will toggle this if we need the pet to be interactive
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    uiohook.on('mousemove', (event) => {
        if (mainWindow) {
            mainWindow.webContents.send('mouse-move', event);
        }
    });

    uiohook.on('mousedown', (event) => {
        if (mainWindow) {
            mainWindow.webContents.send('mouse-down', event);
        }
    });

    uiohook.on('keydown', (event) => {
        if (mainWindow) {
            mainWindow.webContents.send('key-down', event);
        }
    });

    uiohook.on('wheel', (event) => {
        if (mainWindow) {
            mainWindow.webContents.send('scroll', event);
        }
    });

    uiohook.start();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win.setIgnoreMouseEvents(ignore, options);
});
