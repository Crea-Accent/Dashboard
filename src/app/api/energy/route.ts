/** @format */

'use server';

import '@/lib/mqtt';
import '@/lib/modbus';

export async function GET() {
	return Response.json({
		mqtt: global.latestEnergyData ?? null,
		modbus: global.latestModbusData ?? null,
	});
}
