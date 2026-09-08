const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Controls.tsx', 'utf8');

content = content.replace(
	/<Button onClick=\{\(\) => window\.print\(\)\} variant="ghost" className="print:hidden" icon=\{<Printer size=\{16\} \/>\}>/g,
	`<Button onClick={handlePrint} disabled={printing} variant="ghost" className="print:hidden" icon={printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}>`
);

fs.writeFileSync('src/components/projects/Controls.tsx', content, 'utf8');
