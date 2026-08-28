const fs = require('fs');
let content = fs.readFileSync('src/providers/LocalProvider.tsx', 'utf8');

content = content.replace(
	"const localUrl = local ? 'http://' + server?.ip + ':3000' : '';",
	"const actualIp = server?.ip === '127.0.0.1' && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : server?.ip;\n\t\t\tconst localUrl = local ? 'http://' + actualIp + ':3000' : '';"
);

content = content.replace(
	'const local = await fetch(`http://${server?.ip}:3000/api/local`, { signal: AbortSignal.timeout(1500) })',
	"const actualIpForCheck = server?.ip === '127.0.0.1' && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.hostname : server?.ip;\n\t\t\tconst local = await fetch(`http://${actualIpForCheck}:3000/api/local`, { signal: AbortSignal.timeout(1500) })"
);

fs.writeFileSync('src/providers/LocalProvider.tsx', content, 'utf8');
