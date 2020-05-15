const { ipcRenderer } = require('electron');
const $ = require('jQuery');

const $str = (str) => $(document.createTextNode(str));

let fileMap = {};
let lastId = 0;

let theme = 'dark';
const imgMap = {
	file: '/img/file-%theme%.png',
	folder: '/img/folder-%theme%.png',
};

const fileToDOM = (file) => {

	const id = 'file_' + (++lastId);
	fileMap[id] = { ...file };

	const dom = $(document.createElement('div'));
	if (file.isDir) dom.html('&#128193;');
	dom.attr({ id });
	dom.addClass('file-item');
	if (file.isDir) dom.addClass('directory');
	dom.append($str(file.name+(file.isDir?'/':'')));
	return dom;

};

const updateCtx = (ctx) => {
	const body = $('body').html('');
	lastId = 0;
	fileMap = {};
	ctx.files.forEach((file) => body.append(fileToDOM(file)));
};

const bindKeys = () => {
	$(window).bind('keydown', e => {
		const key = e.key.trim().toLowerCase().replace('arrow', '');
		if (key === 'up' && e.altKey && !e.ctrlKey && !e.shiftKey) {
			ipcRenderer.send('up');
		}
		if (key === 'left' && e.altKey && !e.ctrlKey && !e.shiftKey) {
			ipcRenderer.send('back');
		}
	});
};

$(document).ready(() => {
	ipcRenderer.on('ctx-update', (e, ctx) => updateCtx(ctx));
	ipcRenderer.send('ctx-req');
	$('body').on('dblclick', '.file-item.directory', function(){
		const id = $(this).attr('id');
		const file = fileMap[id];
		ipcRenderer.send('enter', file);
	});
	bindKeys();
});