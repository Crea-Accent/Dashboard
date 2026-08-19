const fs = require('fs');

let content = fs.readFileSync('src/components/projects/Canbus.tsx', 'utf8');

// 1. In loadTopology, if no programmation is found, set viewMode to 'sim'
content = content.replace(
	`				setFoundModules([]);
				setAvailableModules([]);
				setMetadata(metadata);
				setNoProgrammation(true);
				return;`,
	`				setFoundModules([]);
				setAvailableModules([]);
				setMetadata(metadata);
				setNoProgrammation(true);
				setViewMode('sim');
				return;`
);

// 2. Disable the Simulation/Setup toggle button if noProgrammation is true
content = content.replace(
	`<Button variant="secondary" onClick={() => setViewMode((v) => (v === 'setup' ? 'sim' : 'setup'))}>
								{viewMode === 'setup' ? 'Setup' : 'Simulation'}
							</Button>`,
	`<Button disabled={noProgrammation} variant="secondary" onClick={() => setViewMode((v) => (v === 'setup' ? 'sim' : 'setup'))}>
								{viewMode === 'setup' ? 'Setup' : 'Simulation'}
							</Button>`
);

// 3. Remove the EmptyState block that was blocking viewMode === 'setup', just in case it ever hits
// Actually, it's safer to keep the EmptyState but remove it if they want to ALWAYS be allowed in simulation mode.
// The prompt says "you should now allowed to be in simulation mode regardless of programmation file".
// I'll just remove the EmptyState completely so it never blocks rendering.
content = content.replace(
	`	if (noProgrammation && viewMode === 'setup') {
		return (
			<div className="flex flex-col flex-1 w-full items-center justify-center min-h-[400px]">
				<EmptyState
					icon={<FileWarning size={48} />}
					title="No Programmation File Found"
					description="Please upload a valid programmation file for this project before viewing the Canbus topology."
				/>
			</div>
		);
	}`,
	``
);

fs.writeFileSync('src/components/projects/Canbus.tsx', content);
console.log('Canbus.tsx updated');
