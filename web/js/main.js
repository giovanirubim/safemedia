const { ipcRenderer } = require('electron');
const $ = require('jQuery');

const $str = (str) => $(document.createTextNode(str));
const $tag = (str) => $(document.createElement(str));

let fileMap = {};
let lastId = 0;
let context = null;

let srcRoot;
let theme = 'white';
const imgMap = {
	file: 'img/file-%theme%.png',
	folder: 'img/folder-%theme%.png',
};
const dumpSize = (size) => {
	if (size < 1024) return size + ' B';
	size /= 1024;
	if (size < 1024) return Math.round(size*100)/100 + ' KB';
	size /= 1024;
	if (size < 1024) return Math.round(size*100)/100 + ' MB';
	size /= 1024;
	if (size < 1024) return Math.round(size*100)/100 + ' GB';
	return Math.round(size/1024*100)/100 + ' TB';
};
const getImgSrc = (name) => imgMap[name].replace(/%theme%/g, theme);
const getExt = (path) => path.substr(path.lastIndexOf('.')+1).toLowerCase();
const fileToDOM = (file) => {

	const id = 'file_' + (++lastId);
	fileMap[id] = { ...file };

	const dom = $tag('div').html(`
		<div class="thumb-container"></div>
		<div class="file-info">
			<div class="info-line file-name text"></div>
		</div>
	`);
	if (getExt(file.name) === 'png') {
		const img = $tag('img');
		const filepath = context.pwd + file.name;
		img.attr({
			src: `http://127.0.0.1:9449/src?path=${encodeURIComponent(filepath)}`
		});
		dom.find('.thumb-container').append(img);
	} else {
		dom.find('.thumb-container').html(`
			<img src="${ getImgSrc(file.isDir? 'folder': 'file') }">
		`);
	}
	dom.attr({ id, title: file.name, tabindex: '0' });
	dom.addClass('file-item');
	if (file.isDir) {
		dom.addClass('directory');
	} else {
		dom.find('.file-info').append(`<div class="info-line file-size">
			<span class="text file-size">${dumpSize(file.size)}</span>
		</div>`);
	}
	dom.find('.file-name').append($str(file.name));
	return dom;

};

let files_container;
const updateCtx = (ctx) => {
	context = ctx;
	$('#path').val(ctx.pwd);
	files_container.html('');
	lastId = 0;
	fileMap = {};
	ctx.files.forEach((file) => files_container.append(fileToDOM(file)));
};

const move = {
	up: () => ipcRenderer.send('up'),
	back: () => ipcRenderer.send('back')
};

const bindKeys = () => {
	$(window).bind('keydown', e => {
		const key = e.key.trim().toLowerCase().replace('arrow', '');
		if (key === 'up' && e.altKey && !e.ctrlKey && !e.shiftKey) {
			move.up();
		}
		if (key === 'left' && e.altKey && !e.ctrlKey && !e.shiftKey) {
			move.back();
		}
	});
};

$(document).ready(() => {
	let index = ipcRenderer.sendSync('add-key', 'abC123');
	files_container = $('#files_container');
	ipcRenderer.on('ctx-update', (e, ctx) => updateCtx(ctx));
	ipcRenderer.send('ctx-req');
	files_container.on('dblclick', '.file-item.directory', function(){
		const id = $(this).attr('id');
		const file = fileMap[id];
		ipcRenderer.send('enter', file);
	});
	$('#path').bind('keydown', function(e) {
		const key = e.key.trim().toLowerCase().replace('arrow', '');
		if (key === 'enter') {
			e.preventDefault();
			ipcRenderer.send('set-ctx', this.value);
		}
	});
	$('#top_bar button').eq(0).bind('click', move.back);
	$('#top_bar button').eq(1).bind('click', move.up);
	bindKeys();
});