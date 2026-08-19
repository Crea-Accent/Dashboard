const fs = require('fs');

let content = fs.readFileSync('src/app/api/projects/fusionsolar/route.ts', 'utf8');

const oldFetch = `
			const listRes = await fetch(\`\${baseUrl}/thirdData/getStationList\`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'xsrf-token': xsrfToken,
				},
				body: JSON.stringify({
					pageNo: 1,
					pageSize: 100,
				}),
			});

			if (!listRes.ok) {
				return NextResponse.json({ error: 'Failed to fetch station list' }, { status: 502 });
			}

			const listData = await listRes.json();

			if (!listData.success) {
				console.error('FusionSolar Station List Failed:', listData);
				// If token is somehow invalid, clear it (but NOT on 407 which is just a rate limit)
				if (listData.failCode === 301 || listData.failCode === 401) {
					cachedToken = null;
				}
				return NextResponse.json(
					{
						error: listData.failCode || 'API returned failure status',
						rawAPIResponse: listData,
					},
					{ status: 502 }
				);
			}

			const list = listData.data?.list || [];
			listCache.data = list;
			listCache.timestamp = Date.now();

			return NextResponse.json({
				success: true,
				data: list,
			});
`;

const newFetch = `
			let allPlants: any[] = [];
			let pageNo = 1;
			let pageCount = 1;
			let isFailed = false;

			do {
				const listRes = await fetch(\`\${baseUrl}/thirdData/getStationList\`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'xsrf-token': xsrfToken,
					},
					body: JSON.stringify({
						pageNo: pageNo,
					}),
				});

				if (!listRes.ok) {
					if (pageNo === 1) return NextResponse.json({ error: 'Failed to fetch station list' }, { status: 502 });
					break;
				}

				const listData = await listRes.json();

				if (!listData.success) {
					console.error('FusionSolar Station List Failed on page', pageNo, listData);
					if (listData.failCode === 301 || listData.failCode === 401) {
						cachedToken = null;
					}
					if (pageNo === 1) {
						return NextResponse.json(
							{
								error: listData.failCode || 'API returned failure status',
								rawAPIResponse: listData,
							},
							{ status: 502 }
						);
					}
					isFailed = true;
					break;
				}

				// The list might be in data.list or just data if it's an array.
				const list = Array.isArray(listData.data) ? listData.data : (listData.data?.list || []);
				allPlants = allPlants.concat(list);
				
				// Handle page counts if available
				pageCount = listData.data?.pageCount || 1;
				pageNo++;
			} while (!isFailed && pageNo <= pageCount && pageNo < 20); // safe limit

			listCache.data = allPlants;
			listCache.timestamp = Date.now();

			return NextResponse.json({
				success: true,
				data: allPlants,
			});
`;

content = content.replace(oldFetch, newFetch);

fs.writeFileSync('src/app/api/projects/fusionsolar/route.ts', content);
console.log('Patched getStationList pagination');
