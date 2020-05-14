const fs = require('fs');
const { app, BrowserWindow, ipcMain } = require('electron');

const context = {
	pwd: __dirname.replace(/\\/g, '/').replace(/\/$/, '') + '/',
	files: []
};

const updateContext = () => {
	const { pwd, files } = context;
	files.length = 0;
	const names = fs.readdirSync(context.pwd);
	names.forEach(name => {
		const path = pwd + name;
		const stat = fs.lstatSync(path);
		const isDir = stat.isDirectory();
		const size = stat.size;
		files.push({ name, isDir, size });
	});
};

const createMainWindow = () => {
	let win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: { nodeIntegration: true }
	});
	win.removeMenu();
	win.loadFile('./web/index.html');
	win.webContents.openDevTools();
};

ipcMain.on('ctxreq', e => {
	updateContext();
	e.reply('ctxres', context);
});

app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createMainWindow();
	}
});