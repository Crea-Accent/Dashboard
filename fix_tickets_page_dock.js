const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/projects/[id]/page.tsx', 'utf8');

// Ensure Plus is imported
if (!content.includes('Plus,')) {
	content = content.replace(/import \{ Cable, Pointer/, 'import { Cable, Pointer, Plus,');
}

// Add type
const typeString = `type TicketsActions = {
	tickets: any[];
	generatingPdf: string | null;
	isAllowed: boolean;
	generateProjectPDF: () => void;
	openNewTicket: () => void;
};`;

if (!content.includes('type TicketsActions')) {
	content = content.replace(/type FeedActions = \{/, `${typeString}\n\ntype FeedActions = {`);
}

// Add state
if (!content.includes('const [ticketsActions, setTicketsActions]')) {
	content = content.replace(
		/const \[feedActions, setFeedActions\] = useState<FeedActions \| null>\(null\);/,
		'const [feedActions, setFeedActions] = useState<FeedActions | null>(null);\n\tconst [ticketsActions, setTicketsActions] = useState<TicketsActions | null>(null);'
	);
}

// Add dock buttons
const dockButtons = `						{tab === 'tickets' && ticketsActions && (
							<>
								{ticketsActions.tickets.length > 0 && (
									<Button
										variant="secondary"
										onClick={() => ticketsActions.generateProjectPDF()}
										disabled={ticketsActions.generatingPdf !== null}
										icon={ticketsActions.generatingPdf === 'project' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
									>
										<span className="hidden sm:inline">{ticketsActions.generatingPdf === 'project' ? 'Generating...' : 'Project Summary'}</span>
									</Button>
								)}
								{ticketsActions.isAllowed && (
									<Button
										onClick={() => ticketsActions.openNewTicket()}
										icon={<Plus size={16} />}
									>
										<span className="hidden sm:inline">New Ticket</span>
									</Button>
								)}
							</>
						)}`;

content = content.replace(/\{tab === 'controls' && controlsActions && \(/, `${dockButtons}\n\t\t\t\t\t\t{tab === 'controls' && controlsActions && (`);

// Pass onActionsChange to Tickets
content = content.replace(/\{tab === 'tickets' && <Tickets client=\{client\} \/>\}/, `{tab === 'tickets' && <Tickets client={client} onActionsChange={setTicketsActions} />}`);

fs.writeFileSync('src/app/dashboard/projects/[id]/page.tsx', content, 'utf8');
