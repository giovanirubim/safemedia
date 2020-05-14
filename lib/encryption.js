// Keys:   16 bytes
// Salt:    8 bytes
// Hash:   32 bytes
// Header: 40 bytes (salt + hash)

const fs = require('fs');
const crypto = require('crypto');

const algorithm = 'aes-128-ecb';
const randomBuffer = (length) => {
	const buffer = Buffer.alloc(length);
	for (let i=0; i<length; ++i) {
		buffer.writeUInt8(Math.floor(Math.random()*256), i);
	}
	return buffer;
};

const createSalt = () => randomBuffer(8);
const createKey = (password) => {
	if (typeof password === 'string') {
		password = Buffer.from(password, 'utf8');
	} else if (!password instanceof Buffer) {
		throw 'Invalid password type';
	}
    const salt = createSalt();
    const key = crypto.scryptSync(password, salt, 16);
    const hash = crypto.createHash('sha256').update(key).digest();
    return { key, header: Buffer.concat([salt, hash]) };
};

const loadKey = (password, path) => new Promise((done, fail) => {
	if (typeof password === 'string') {
		password = Buffer.from(password, 'utf8');
	} else if (!password instanceof Buffer) {
		throw 'Invalid password type';
	}
	const stream = fs.createReadStream(path, { start: 0, end: 39 });
	const chunks = [];
	stream.on('data', chunk => chunks.push(chunk));
	stream.on('end', () => {
		if (!chunks.length) {
			done(null);
			return;
		}
		const header = chunks.length > 1? Buffer.concat(chunks): chunks[0];
		const salt = header.slice(0, 8);
		const hash = header.slice(8, 40);
		const key = crypto.scryptSync(password, salt, 16);
		const test = crypto.createHash('sha256').update(key).digest();
		if (hash.compare(test)) {
			done(null);
		} else {
			done(key);
		}
	});
});

const encryptFile = (password, src, dst, monitor = null) => new Promise((done, fail) => {
	const { key, header } = createKey(password);
	const { size } = fs.lstatSync(src);
	const input = fs.createReadStream(src);
	const output = fs.createWriteStream(dst);
	const cipher = crypto.createCipheriv(algorithm, key, Buffer.alloc(0, 0));
	cipher.on('readable', () => {
		for (;;) {
			const chunk = cipher.read();
			if (chunk === null) return;
			output.write(chunk);
			if (monitor !== null) monitor.bytes += chunk.length;
		}
	});
	cipher.on('end', () => {
		output.end();
		done();
	});
	output.write(header);
	if (monitor !== null) {
		const mod = size%16;
		monitor.size = 40 + (mod? size - mod + 16: size);
		monitor.bytes = 40;
	}
	input.on('data', chunk => cipher.write(chunk));
	input.on('end', () => cipher.end());
});

const decryptFile = (password, src, dst, monitor = null) => new Promise(async (done, fail) => {
	const { size } = fs.lstatSync(src);
	const key = await loadKey(password, src);
	if (!key) {
		done(false);
		return;
	}
	const input = fs.createReadStream(src, {start: 40});
	const output = fs.createWriteStream(dst);
	const cipher = crypto.createDecipheriv(algorithm, key, Buffer.alloc(0, 0));
	if (monitor !== null) {
		monitor.size = size - 40;
		monitor.bytes = 0;
	}
	cipher.on('readable', () => {
		for (;;) {
			const chunk = cipher.read();
			if (chunk === null) return;
			output.write(chunk);
			if (monitor !== null) monitor.bytes += chunk.length;
		}
	});
	cipher.on('end', () => {
		output.end();
		monitor.bytes = monitor.size;
		done();
	});
	input.on('data', chunk => cipher.write(chunk));
	input.on('end', () => cipher.end());
});

module.exports.encryptFile = encryptFile;
module.exports.decryptFile = decryptFile;