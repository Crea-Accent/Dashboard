const fs = require('fs');
let content = fs.readFileSync('src/components/projects/Metadata.tsx', 'utf8');

content = content.replace(/<div className="relative">\s*<Input\s*label="Architect"/, `<div className="relative z-10">\n\t\t\t\t\t\t\t\t\t\t<Input\n\t\t\t\t\t\t\t\t\t\t\tlabel="Architect"`);

// We should also make sure the `Project Name` is z-30 because it's rendered BEFORE the `z-20` Contractor grid.
content = content.replace(/<div className="relative z-10">\s*<Input\s*label="Project Name"/, `<div className="relative z-30">\n\t\t\t\t\t\t\t\t\t<Input\n\t\t\t\t\t\t\t\t\t\tlabel="Project Name"`);

fs.writeFileSync('src/components/projects/Metadata.tsx', content, 'utf8');
