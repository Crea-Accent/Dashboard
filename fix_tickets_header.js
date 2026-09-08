const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Tickets.tsx', 'utf8');

// Update Props
content = content.replace(
	/export default function Tickets\(\{ client \}: \{ client: string \}\) \{/,
	'export default function Tickets({ client, onActionsChange }: { client: string, onActionsChange?: (actions: any) => void }) {'
);

// Add useEffect
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

// Remove Header UI
const headerRegex = /<div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between bg-\(--foreground\) p-4 rounded-3xl">[\s\S]*?<\/div>\s*<\/div>/;
content = content.replace(headerRegex, '');

fs.writeFileSync('src/components/projects/Tickets.tsx', content, 'utf8');
