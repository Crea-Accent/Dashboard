/** @format */

import ModbusRTU from 'modbus-serial';

declare global {
	var latestModbusData: unknown;
	var modbusStarted: boolean | undefined;
}

const inverterStates: Record<number, string> = {
	256: 'Starting',
	512: 'Running',
	513: 'Power Limited',
	514: 'Derating',
	768: 'Fault',
	769: 'Shutdown',
};

const cache = new Map<string, number>();

let lastSuccess = Date.now();

async function readRegister(client: ModbusRTU, address: number, length = 1, index = 0) {
	const key = `${address}:${length}:${index}`;

	try {
		const result = await client.readHoldingRegisters(address, length);

		const value = result.data[index];

		cache.set(key, value);

		lastSuccess = Date.now();

		return value;
	} catch (err) {
		console.warn(`[Modbus] Read failed (${address})`);

		return cache.get(key) ?? 0;
	}
}

if (!global.modbusStarted) {
	global.modbusStarted = true;

	const client = new ModbusRTU();

	(async () => {
		try {
			await client.connectTCP('172.16.10.167', {
				port: 502,
			});

			client.setID(1);

			client.setTimeout(5000);

			console.info('[Modbus] Connected');

			const poll = async () => {
				try {
					const batteryStatus = await readRegister(client, 37000);

					const inverterStatus = await readRegister(client, 32089);

					const meterStatus = await readRegister(client, 37100);

					const importLifetime = (await readRegister(client, 37119, 2, 1)) / 100;

					const exportLifetime = (await readRegister(client, 37121, 2, 1)) / 100;

					const inverterPower = (await readRegister(client, 32080, 2, 1)) / 10;

					const meterPower = (await readRegister(client, 37113, 2, 1)) / 10;

					const batteryPower = (await readRegister(client, 37001, 2, 1)) / 10;

					const batterySoc = (await readRegister(client, 37004)) / 10;

					const batteryCharge = (await readRegister(client, 37066, 2, 1)) / 100;

					const batteryDischarge = (await readRegister(client, 37068, 2, 1)) / 100;

					const powerFactor = (await readRegister(client, 32084)) / 1000;

					const frequency = (await readRegister(client, 32085)) / 100;

					const efficiency = (await readRegister(client, 32086)) / 10000;

					const internalTemp = (await readRegister(client, 32087)) / 10;

					const insulationResist = await readRegister(client, 32088);

					global.latestModbusData = {
						lastUpdate: new Date(lastSuccess).toISOString(),

						state: {
							inverter: inverterStatus ? (inverterStates[inverterStatus] ?? 'Standby') : 'Offline',

							meter: meterStatus ? 'Online' : 'Offline',

							battery: batteryStatus === 1 ? 'Standby' : batteryStatus === 2 ? 'Running' : batteryStatus ? 'Fault' : 'Offline',
						},

						lifetime: {
							import: importLifetime,
							export: exportLifetime,
						},

						inverterPower,

						meterPower,

						batteryPower,

						production: inverterPower + batteryPower,

						consumption: inverterPower + meterPower,

						battery: {
							state: batterySoc,

							load: batteryPower,

							charge: batteryCharge,

							discharge: batteryDischarge,
						},

						powerFactor,

						frequency,

						efficiency,

						internalTemp,

						insulationResist,

						l1: {
							grid: {
								voltage: (await readRegister(client, 37101, 2, 1)) / 10,

								current: (await readRegister(client, 37107, 2, 1)) / 10000,
							},

							solar: {
								voltage: (await readRegister(client, 32066)) / 10,

								current: (await readRegister(client, 32072, 2, 1)) / 1000,
							},
						},

						l2: {
							grid: {
								voltage: (await readRegister(client, 37103, 2, 1)) / 10,

								current: (await readRegister(client, 37109, 2, 1)) / 10000,
							},

							solar: {
								voltage: (await readRegister(client, 32067)) / 10,

								current: (await readRegister(client, 32074, 2, 1)) / 1000,
							},
						},

						l3: {
							grid: {
								voltage: (await readRegister(client, 37105, 2, 1)) / 10,

								current: (await readRegister(client, 37111, 2, 1)) / 10000,
							},

							solar: {
								voltage: (await readRegister(client, 32068)) / 10,

								current: (await readRegister(client, 32076, 2, 1)) / 1000,
							},
						},

						pv1: {
							voltage: (await readRegister(client, 32016)) / 10,

							current: (await readRegister(client, 32017, 2, 1)) / 100,
						},

						pv2: {
							voltage: (await readRegister(client, 32018)) / 10,

							current: (await readRegister(client, 32019, 2, 1)) / 100,
						},
					};
				} catch (err) {
					console.error('[Modbus Poll Fatal]', err);
				}
			};

			await poll();

			setInterval(() => {
				void poll();
			}, 1000);
		} catch (err) {
			console.error('[Modbus] Connection failed', err);
		}
	})();
}
