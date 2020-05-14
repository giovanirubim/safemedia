const { ipcRenderer } = require('electron');

ipcRenderer.on('ctxres', (e, ctx) => {
	console.log(ctx);
});

ipcRenderer.send('ctxreq');