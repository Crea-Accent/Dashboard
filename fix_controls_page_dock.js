const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/projects/[id]/page.tsx', 'utf8');

// Ensure Loader2 and Printer are imported
if (!content.includes('Loader2,')) {
	content = content.replace(/import \{ Cable, Pointer, Radio, RefreshCw, Wrench, /, 'import { Cable, Pointer, Radio, RefreshCw, Wrench, Loader2, Printer, ');
}

// Add type
const typeString = `type ControlsActions = {
	print: () => void;
	printing: boolean;
};`;

if (!content.includes('type ControlsActions')) {
	content = content.replace(/type FeedActions = \{/, `${typeString}\n\ntype FeedActions = {`);
}

// Add state
if (!content.includes('const [controlsActions, setControlsActions]')) {
	content = content.replace(
		/const \[feedActions, setFeedActions\] = useState<FeedActions \| null>\(null\);/,
		'const [feedActions, setFeedActions] = useState<FeedActions | null>(null);\n\tconst [controlsActions, setControlsActions] = useState<ControlsActions | null>(null);'
	);
}

// Add dock button
const dockButtons = `						{tab === 'controls' && controlsActions && (
							<Button
								variant="ghost"
								icon={controlsActions.printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
								disabled={controlsActions.printing}
								onClick={() => controlsActions.print()}
							>
								<span className="hidden sm:inline">{controlsActions.printing ? 'Preparing...' : 'Print Layout'}</span>
							</Button>
						)}`;

content = content.replace(/\{tab === 'feed' && feedActions && \(/, `${dockButtons}\n\t\t\t\t\t\t{tab === 'feed' && feedActions && (`);

// Pass onActionsChange to Controls
content = content.replace(
	/\{tab === 'controls' && <Controls basePath=\{settings\.path\} client=\{client\} \/>\}/,
	`{tab === 'controls' && <Controls basePath={settings.path} client={client} onActionsChange={setControlsActions} />}`
);

fs.writeFileSync('src/app/dashboard/projects/[id]/page.tsx', content, 'utf8');
