const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Metadata.tsx', 'utf8');

content = content.replace(/className="pt-4 overflow-hidden"/g, 'className="pt-4"');

fs.writeFileSync('src/components/projects/Metadata.tsx', content, 'utf8');
