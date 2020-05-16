const fs = require('fs');

const {
	app,
	BrowserWindow,
	ipcMain,
	nativeImage
} = require('electron');

const history = [];
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
		try {
			const stat = fs.lstatSync(path);
			const size = stat.size;
			const isDir = stat.isDirectory();
			const key = (isDir^1) + name.toUpperCase();
			files.push({ name, isDir, size, key });
		} catch(err) {
			return;
		}
	});
	files.sort((a, b) => a.key > b.key? 1: -1);
};

const createMainWindow = () => {
	let win = new BrowserWindow({
		width: 1024,
		height: 800,
		webPreferences: { nodeIntegration: true },
		icon: './icon.png'
	});
	win.removeMenu();
	win.loadFile('./web/index.html');
	// win.webContents.openDevTools();
};

ipcMain.on('ctx-req', e => {
	updateContext();
	e.reply('ctx-update', context);
});
ipcMain.on('enter', (e, file) => {
	history.push(context.pwd);
	context.pwd += file.name + '/';
	updateContext();
	e.reply('ctx-update', context);
});
ipcMain.on('back', (e, file) => {
	if (!history.length) return;
	context.pwd = history.splice(history.length - 1, 1)[0];
	updateContext();
	e.reply('ctx-update', context);
});
ipcMain.on('up', (e, file) => {
	let { pwd } = context;
	if (!pwd.includes('/')) return;
	history.push(pwd);
	context.pwd = pwd.replace(/\/[^\/]+\/$/, '/');
	updateContext();
	e.reply('ctx-update', context);
});
ipcMain.on('set-ctx', (e, path) => {
	path = path.replace(/\\/g, '/').replace(/\/$/, '') + '/';
	if (!fs.existsSync(path)) return;
	if (!fs.lstatSync(path).isDirectory()) return;
	history.push(context.pwd);
	context.pwd = path;
	updateContext();
	e.reply('ctx-update', context);
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