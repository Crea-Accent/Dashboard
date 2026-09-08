const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/projects/[id]/page.tsx', 'utf8');

const tabsRegex = /\t\tconst tabs = \[\s*\{ key: 'info'.*?\] as const;/s;

const newTabs = `		const allTabs = [
		{ key: 'info', label: 'Info', icon: <Folder /> },
		{ key: 'tickets', label: 'Tickets', icon: <Ticket /> },
		{ key: 'schemas', label: 'Schemas', icon: <FileText /> },
		{ key: 'documents', label: 'Documents', icon: <File /> },
		{ key: 'pictures', label: 'Media', icon: <ImageIcon /> },
		{ key: 'solar', label: 'Solar', icon: <Sun /> },
		{ key: 'programmation', label: 'Programmation', icon: <Code /> },
		{ key: 'canbus', label: 'Canbus', icon: <Cable /> },
		{ key: 'controls', label: 'Controls', icon: <Pointer /> },
		{ key: 'feed', label: 'Feed', icon: <Terminal /> },
	] as const;

	const tabs = allTabs.filter(t => t.key !== 'tickets' || has('tickets.read'));`;

content = content.replace(tabsRegex, newTabs);

fs.writeFileSync('src/app/dashboard/projects/[id]/page.tsx', content, 'utf8');
