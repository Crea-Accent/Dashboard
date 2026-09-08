const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Feed.tsx', 'utf8');

content = content.replace(/className="flex flex-col lg:flex-row gap-6 items-start w-full"/, 'className="flex flex-col lg:flex-row gap-6 lg:items-start w-full"');

fs.writeFileSync('src/components/projects/Feed.tsx', content, 'utf8');
