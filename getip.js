const dgram = require('dgram');

function getPrimaryIp() {
	return new Promise((resolve, reject) => {
		const socket = dgram.createSocket('udp4');
		socket.connect(53, '8.8.8.8', () => {
			const ip = socket.address().address;
			socket.close();
			resolve(ip);
		});
		socket.on('error', (err) => {
			socket.close();
			reject(err);
		});
	});
}
getPrimaryIp().then(console.log).catch(console.error);
