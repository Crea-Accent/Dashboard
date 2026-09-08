const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Controls.tsx', 'utf8');

// Insert printing state
content = content.replace(/const \[loading, setLoading\] = useState\(true\);/, 'const [loading, setLoading] = useState(true);\n\tconst [printing, setPrinting] = useState(false);');

const printFunc = `	const handlePrint = () => {
		const grid = document.getElementById('controls-grid');
		if (!grid) return;

		setPrinting(true);

		try {
			const tiler = document.createElement('div');
			tiler.id = 'print-tiler';
			tiler.style.cssText = 'position: absolute; top: 0; left: 0; z-index: -100; opacity: 0; pointer-events: none; width: 100%;';

			const clone = grid.cloneNode(true) as HTMLElement;
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

// Insert handlePrint before useEffect
content = content.replace(/useEffect\(\(\) => \{/, `${printFunc}\n\n\tuseEffect(() => {`);

fs.writeFileSync('src/components/projects/Controls.tsx', content, 'utf8');
