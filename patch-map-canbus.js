const fs = require('fs');

let content = fs.readFileSync('src/app/api/projects/map/route.ts', 'utf8');

content = content.replace(
	`					let hasCanbusSetup = false;
					const canbusPath = path.join(basePath, folder.name, 'canbus.json');
					if (fs.existsSync(canbusPath)) {
						try {
							const canbusData = JSON.parse(fs.readFileSync(canbusPath, 'utf8'));
							hasCanbusSetup = Array.isArray(canbusData.setup) && canbusData.setup.length > 0;
						} catch (e) {}
					} else if (metadata.setup) {
						hasCanbusSetup = Array.isArray(metadata.setup) && metadata.setup.length > 0;
					}`,
	`					let hasCanbusSetup = false;
					let hasCanbusSim = false;
					const canbusPath = path.join(basePath, folder.name, 'canbus.json');
					if (fs.existsSync(canbusPath)) {
						try {
							const canbusData = JSON.parse(fs.readFileSync(canbusPath, 'utf8'));
							hasCanbusSetup = Array.isArray(canbusData.setup) && canbusData.setup.length > 0;
							hasCanbusSim = Array.isArray(canbusData.sim) && canbusData.sim.length > 0;
						} catch (e) {}
					} else if (metadata.setup || metadata.sim) {
						hasCanbusSetup = Array.isArray(metadata.setup) && metadata.setup.length > 0;
						hasCanbusSim = Array.isArray(metadata.sim) && metadata.sim.length > 0;
					}`
);

content = content.replace(
	`						hasFusionSolar,
						hasCanbusSetup,
						hasOpenTickets,`,
	`						hasFusionSolar,
						hasCanbusSetup,
						hasCanbusSim,
						hasOpenTickets,`
);

fs.writeFileSync('src/app/api/projects/map/route.ts', content);
console.log('Patched map/route.ts');
