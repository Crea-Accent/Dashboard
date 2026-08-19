const fs = require('fs');

let content = fs.readFileSync('src/app/dashboard/projects/page.tsx', 'utf8');

// Update Project type definition
content = content.replace(
	`	hasFusionSolar?: boolean;
	hasCanbusSetup?: boolean;
	hasOpenTickets?: boolean;`,
	`	hasFusionSolar?: boolean;
	hasCanbusSetup?: boolean;
	hasCanbusSim?: boolean;
	hasOpenTickets?: boolean;`
);

// Update status filter logic
content = content.replace(`					if (status === 'Canbus') return p.hasCanbusSetup;`, `					if (status === 'Canbus') return p.hasCanbusSetup || p.hasCanbusSim;`);

// We need to replace the grid rendering AND the list rendering logic
// 1. Grid item:
content = content.replace(
	`										{p.hasCanbusSetup && (
											<div title="Canbus laid out">
												<Cable size={16} className="text-blue-500" />
											</div>
										)}`,
	`										{p.hasCanbusSetup ? (
											<div title="Canbus laid out (Real)">
												<Cable size={16} className="text-orange-500" />
											</div>
										) : p.hasCanbusSim ? (
											<div title="Canbus laid out (Simulated)">
												<Cable size={16} className="text-blue-500" />
											</div>
										) : null}`
);

// 2. List item:
content = content.replace(
	`													{p.hasCanbusSetup && (
														<div title="Canbus laid out">
															<Cable size={16} className="text-blue-500" />
														</div>
													)}`,
	`													{p.hasCanbusSetup ? (
														<div title="Canbus laid out (Real)">
															<Cable size={16} className="text-orange-500" />
														</div>
													) : p.hasCanbusSim ? (
														<div title="Canbus laid out (Simulated)">
															<Cable size={16} className="text-blue-500" />
														</div>
													) : null}`
);

fs.writeFileSync('src/app/dashboard/projects/page.tsx', content);
console.log('Patched dashboard projects page');
