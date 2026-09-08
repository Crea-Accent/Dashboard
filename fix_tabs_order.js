const fs = require('fs');
let content = fs.readFileSync('src/app/dashboard/projects/[id]/page.tsx', 'utf8');

const newTabs = `	const tabs = [
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
	] as const;`;

content = content.replace(/const tabs = \[\s*\{ key: 'info'[\s\S]*?\] as const;/, newTabs);

fs.writeFileSync('src/app/dashboard/projects/[id]/page.tsx', content, 'utf8');
