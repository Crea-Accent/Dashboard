const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Metadata.tsx', 'utf8');

content = content.replace(
	/<div className="relative">\s*<Input\s*label="Project Group Name"/g,
	`<div className="relative z-30">\n\t\t\t\t\t\t\t\t\t<Input\n\t\t\t\t\t\t\t\t\t\tlabel="Project Group Name"`
);

fs.writeFileSync('src/components/projects/Metadata.tsx', content, 'utf8');
