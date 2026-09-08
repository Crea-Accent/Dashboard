const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Controls.tsx', 'utf8');

// Update Props
content = content.replace(
	/export default function Controls\(\{ basePath, client \}: \{ basePath: string; client: string \}\) \{/,
	'export default function Controls({ basePath, client, onActionsChange }: { basePath: string; client: string, onActionsChange?: (actions: any) => void }) {'
);

// Add useEffect for actions
const effect = `\tuseEffect(() => {
		onActionsChange?.({
			print: handlePrint,
			printing
		});
	}, [printing, onActionsChange]);`;

content = content.replace(/const handlePrint = \(\) => \{/, `${effect}\n\n\tconst handlePrint = () => {`);

// Remove the inline Print button
// <Button onClick={handlePrint} disabled={printing} variant="ghost" className="print:hidden" icon={printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}>
// 	{printing ? 'Preparing...' : 'Print Layout'}
// </Button>
const buttonRegex =
	/<Button onClick=\{handlePrint\} disabled=\{printing\} variant="ghost" className="print:hidden" icon=\{printing \? <Loader2 size=\{16\} className="animate-spin" \/> : <Printer size=\{16\} \/>\}>\s*\{printing \? 'Preparing\.\.\.' : 'Print Layout'\}\s*<\/Button>/;

content = content.replace(buttonRegex, '');

fs.writeFileSync('src/components/projects/Controls.tsx', content, 'utf8');
