const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/projects/[id]/page.tsx', 'utf8');
content = content.replace('Plus,,', 'Plus,');
fs.writeFileSync('src/app/dashboard/projects/[id]/page.tsx', content, 'utf8');
