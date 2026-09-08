const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Feed.tsx', 'utf8');

content = content.replace(/<div className="flex-1 flex flex-col gap-4 min-w-0">/, '<div className="flex-1 flex flex-col gap-4 min-w-0 w-full">');

fs.writeFileSync('src/components/projects/Feed.tsx', content, 'utf8');
