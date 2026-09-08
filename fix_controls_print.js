const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Controls.tsx', 'utf8');

if (!content.includes('Loader2')) {
	content = content.replace(
		/import \{ Info, Printer, Pointer, SunDim, Zap, Hand, Sun \} from 'lucide-react';/,
		"import { Info, Printer, Pointer, SunDim, Zap, Hand, Sun, Loader2 } from 'lucide-react';"
	);
}

if (!content.includes('const [printing, setPrinting] = useState(false);')) {
	content = content.replace(
		/export default function Controls\(\{ basePath, client \}: Props\) \{/,
		'export default function Controls({ basePath, client }: Props) {\n\tconst [printing, setPrinting] = useState(false);'
	);
}

const printFunc = `	const handlePrint = () => {
		const grid = document.getElementById('controls-grid');
		if (!grid) return;

		setPrinting(true);

		try {
			const tiler = document.createElement('div');
			tiler.id = 'print-tiler';
			tiler.style.cssText = 'position: absolute; top: 0; left: 0; z-index: -100; opacity: 0; pointer-events: none; width: 100%;';

			const clone = grid.cloneNode(true) as HTMLElement;
			// Strip the grid classes and force the flex wrap layout for the print container
			clone.className = "flex flex-wrap gap-4 w-full";
			tiler.appendChild(clone);
			document.body.appendChild(tiler);

			const style = document.createElement('style');
			style.innerHTML = \`
				@page { size: A3 landscape; margin: 10mm; }
				@media print {
					body {
						margin: 0 !important;
						padding: 0 !important;
						background: white !important;
					}
					body > *:not(#print-tiler) { display: none !important; }
					#print-tiler { 
						display: block !important; 
						position: static !important; 
						opacity: 1 !important; 
						z-index: 10000 !important; 
					}
					#print-tiler * {
						-webkit-print-color-adjust: exact !important;
						print-color-adjust: exact !important;
						color-adjust: exact !important;
					}
				}
			\`;
			document.head.appendChild(style);

			setTimeout(() => {
				window.print();
				setTimeout(() => {
					document.head.removeChild(style);
					document.body.removeChild(tiler);
					setPrinting(false);
				}, 1000);
			}, 100);
		} catch (e) {
			console.error('Print failed', e);
			setPrinting(false);
		}
	};`;

if (!content.includes('const handlePrint = () => {')) {
	content = content.replace(/const loadData = async \(\) => \{/, `${printFunc}\n\n\tconst loadData = async () => {`);
}

content = content.replace(
	/<Button onClick=\{() => window.print()\} variant="ghost" className="print:hidden" icon=\{<Printer size=\{16\} \/>\}>/g,
	`<Button onClick={handlePrint} disabled={printing} variant="ghost" className="print:hidden" icon={printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}>`
);

content = content.replace(/Print Layout\n\t\t\t\t<\/Button>/, `{printing ? 'Preparing...' : 'Print Layout'}\n\t\t\t\t</Button>`);

content = content.replace(
	/<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 print:flex print:flex-wrap print:gap-4">/,
	`<div id="controls-grid" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 print:flex print:flex-wrap print:gap-4">`
);

fs.writeFileSync('src/components/projects/Controls.tsx', content, 'utf8');
