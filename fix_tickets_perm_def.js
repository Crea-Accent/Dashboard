const fs = require('fs');
let content = fs.readFileSync('src/lib/permissions.ts', 'utf8');

const ticketsPerms = `	{
		key: 'tickets.read',
		label: 'Tickets - Read',
		group: 'Tickets',
	},
	{
		key: 'tickets.write',
		label: 'Tickets - Write',
		group: 'Tickets',
	},`;

content = content.replace(/\] as const;/, `${ticketsPerms}\n] as const;`);

fs.writeFileSync('src/lib/permissions.ts', content, 'utf8');
