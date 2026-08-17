/** @format */

import mqtt from 'mqtt';

declare global {
	// eslint-disable-next-line no-var
	var mqttClient: mqtt.MqttClient | undefined;
	var latestEnergyData: any;
}

const client = global.mqttClient || mqtt.connect('mqtt://172.16.10.237');

if (!global.mqttClient) {
	global.mqttClient = client;

	client.on('connect', () => {
		console.info('[MQTT] Connected');

		client.subscribe('servicelocation/f70b70fc-f12b-4ddc-acc0-25e14eeb2ab5/realtime', (err) => {
			if (err) {
				console.error('[MQTT] Subscribe error', err);
				return;
			}

			console.info('[MQTT] Subscribed');
		});
	});

	client.on('message', (topic, payload) => {
		try {
			const parsed = JSON.parse(payload.toString());

			global.latestEnergyData = parsed;
		} catch {
			global.latestEnergyData = payload.toString();
		}
	});
}

export default client;
