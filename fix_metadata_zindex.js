const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Metadata.tsx', 'utf8');

// The project name has `className="relative z-10"`.
// Wait, if I make Contractor z-20 and Architect z-10, it will fix it.
content = content.replace(
	/<div className="grid grid-cols-1 md:grid-cols-2 gap-4">\s*<div className="relative">/g,
	`<div className="grid grid-cols-1 md:grid-cols-2 gap-4">\n\t\t\t\t\t\t\t\t\t<div className="relative z-20">`
);

fs.writeFileSync('src/components/projects/Metadata.tsx', content, 'utf8');
