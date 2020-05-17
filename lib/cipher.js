// Keys:    16 bytes
// Salt:     8 bytes
// Hash:    32 bytes
// Header:  41 bytes (salt + hash + mod)

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
    return { key, header: Buffer.concat([salt, hash, Buffer.alloc(1, 0)]) };
};

const loadHeader = (path) => new Promise((done, fail) => {
	const input = fs.createReadStream(path, { start: 0, end: 40 });
	const chunks = [];
	input.on('data', (chunk) => chunks.push(chunk));
	input.on('end', () => {
		if (!chunks.length) {
			fail('Empty file');
			return;
		}
		const buffer = chunks.length === 1? chunks[0]: Buffer.concat(chunks);
		if (buffer.length < 41) {
			fail('File too small');
			return;
		}
		const salt = buffer.slice(0, 8);
		const hash = buffer.slice(8, 40);
		const mod = buffer.readUInt8(40);
		done({ salt, hash, mod });
	});
});

const getHeaderKey = (password, header) => {
	const key = crypto.scryptSync(password, header.salt, 16);
	const hash = crypto.createHash('sha256').update(key).digest();
	return hash.compare(header.hash)? null: key;
};

class EncryptionStream {
	constructor(cipher, input, dataHandler, size) {
		this.size = size;
		this.bytes = 0;
		this.promise = new Promise((done, fail) => {
			cipher.on('readable', () => {
				for (;;) {
					const chunk = cipher.read();
					if (chunk === null) return;
					this.bytes += chunk.length;
					dataHandler(chunk);
				}
			});
			cipher.on('end', done);
			input.on('data', (chunk) => cipher.write(chunk));
			input.on('end', () => cipher.end());
		});
	}
	async ready() {
		return await this.promise;
	}
}

class Cipher {
	constructor(password) {
		this.password = password;
	}
	async check(path) {
		try {
			const header = await loadHeader(path);
			const key = getHeaderKey(this.password, header);
			if (!key) return false;
			const size = fs.lstatSync(path).size - 41 - (16 - header.mod);
			return { key, size };
		} catch(error) {
			return false;
		}
	}
	async read(path, dataHandler) {
		const { key, size } = (await this.check(path)) || {};
		if (!key) throw 'Invalid password';
		const input = fs.createReadStream(path, { start: 41 });
		const cipher = crypto.createDecipheriv(algorithm, key, Buffer.alloc(0));
		return new EncryptionStream(cipher, input, dataHandler, size);
	}
	async encrypt(src, dst) {
		let { size } = fs.lstatSync(src);
		const mod = size%16;
		size += (16 - mod);
		const { key, header } = createKey(this.password);
		header.writeUInt8(mod, 40);
		const input = fs.createReadStream(src);
		const output = fs.createWriteStream(dst);
		output.write(header);
		const cipher = crypto.createCipheriv(algorithm, key, Buffer.alloc(0));
		return new EncryptionStream(cipher, input, (chunk) => output.write(chunk), size);
	}
	async decrypt(src, dst) {
		const output = fs.createWriteStream(dst);
		return await this.read(src, (chunk) => output.write(chunk));
	}
}

module.exports = (password) => new Cipher(password);