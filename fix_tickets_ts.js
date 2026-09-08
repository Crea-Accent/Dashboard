const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Tickets.tsx', 'utf8');

content = content.replace(/has\('tasks\.write'\)/g, "has('tickets.write')");
content = content.replace(/has\('tasks\.read'\)/g, "has('tickets.read')");

fs.writeFileSync('src/components/projects/Tickets.tsx', content, 'utf8');
