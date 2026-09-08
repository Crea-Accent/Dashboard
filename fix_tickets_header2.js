const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Tickets.tsx', 'utf8');

// 1. Update Props
content = content.replace(
	/export default function Tickets\(\{ client \}: \{ client: string \}\) \{/,
	'export default function Tickets({ client, onActionsChange }: { client: string, onActionsChange?: (actions: any) => void }) {'
);

// 2. Add useEffect
const effectCode = `\tuseEffect(() => {
		onActionsChange?.({
			tickets,
			generatingPdf,
			isAllowed: canView && !has('projects.write') === false,
			generateProjectPDF,
			openNewTicket: () => {
				setSelectedTicket(null);
				setModalOpen(true);
			}
		});
	}, [tickets, generatingPdf, canView, onActionsChange]);`;

content = content.replace(/const getBase64Image = async/, `${effectCode}\n\n\tconst getBase64Image = async`);

// 3. Remove Header UI
// Find the index of the header start
const headerStart = content.indexOf('<div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-(--foreground) p-4 rounded-3xl">');
if (headerStart !== -1) {
	const endStr = '\t\t\t</div>'; // The closing tag for this header
	const nextStart = content.indexOf('{tickets.length === 0', headerStart); // the next block

	// We can just remove from headerStart up to nextStart
	content = content.substring(0, headerStart) + content.substring(nextStart);
}

fs.writeFileSync('src/components/projects/Tickets.tsx', content, 'utf8');
