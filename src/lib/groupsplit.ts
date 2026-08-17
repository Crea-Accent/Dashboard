/** @format */

const locations = ['Buzzi', 'Blauwe Steen', 'Demo Appartement', 'Bar', 'Vergaderzaal'];
const requiredLocations = ['Buzzi', 'Blauwe Steen', 'Demo Appartement'];

export const leaders = ['Vincent Vermeeren', 'Jeroen Thielen', 'Jeroen Schellekens'];

type Group = {
	location: string;
	leader: string | null;
	people: string[];
};

type Round = {
	round: number;
	groups: Group[];
};

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i]!, a[j]!] = [a[j]!, a[i]!];
	}
	return a;
}

function scorePairs(group: string[], seenPairs: Set<string>): number {
	let score = 0;

	for (let i = 0; i < group.length; i++) {
		for (let j = i + 1; j < group.length; j++) {
			const key = [group[i], group[j]].sort().join('-');
			if (seenPairs.has(key)) score++;
		}
	}

	return score;
}

function getGroupSizes(total: number, groupCount: number): number[] {
	const base = Math.floor(total / groupCount);
	const remainder = total % groupCount;

	const sizes = Array(groupCount).fill(base);
	for (let i = 0; i < remainder; i++) sizes[i]++;

	return sizes;
}

/**
 * Build groups with HARD requirement enforcement
 */
function buildGroups(people: string[], seenPairs: Set<string>, seenLocations: Map<string, Set<string>>): string[][] {
	let best: string[][] = [];
	let bestScore = Infinity;

	const groupCount = locations.length;
	const sizes = getGroupSizes(people.length, groupCount);

	for (let attempt = 0; attempt < 200; attempt++) {
		const remaining = shuffle(people);
		const groups: string[][] = Array.from({ length: groupCount }, () => []);

		// --- STEP 1: FORCE required locations ---
		for (let i = 0; i < requiredLocations.length; i++) {
			const loc = requiredLocations[i];
			const size = sizes[i];

			// people who still need this location
			const candidates = remaining.filter((p) => !seenLocations.get(p)!.has(loc!));

			const picked = shuffle(candidates).slice(0, size);

			for (const p of picked) {
				groups[i]!.push(p);
				remaining.splice(remaining.indexOf(p), 1);
			}
		}

		// --- STEP 2: fill remaining spots ---
		for (let i = 0; i < groupCount; i++) {
			while (groups[i]!.length < sizes[i]!) {
				const p = remaining.pop();
				if (!p) break;
				groups[i]!.push(p);
			}
		}

		// --- STEP 3: score only pair quality ---
		let totalScore = 0;
		for (const g of groups) {
			totalScore += scorePairs(g, seenPairs);
		}

		if (totalScore < bestScore) {
			bestScore = totalScore;
			best = groups;
		}

		if (bestScore === 0) break;
	}

	// record results
	for (let i = 0; i < best.length; i++) {
		const group = best[i]!;
		const loc = locations[i]!;

		for (let a = 0; a < group.length; a++) {
			const p = group[a]!;

			seenLocations.get(p)!.add(loc);

			for (let b = a + 1; b < group.length; b++) {
				const key = [p, group[b]].sort().join('-');
				seenPairs.add(key);
			}
		}
	}

	return best;
}

function generateSchedule(people: string[]): Round[] {
	const rounds: Round[] = [];
	const seenPairs = new Set<string>();

	const seenLocations = new Map<string, Set<string>>();
	for (const p of people) {
		seenLocations.set(p, new Set());
	}

	const totalRounds = locations.length;

	for (let r = 0; r < totalRounds; r++) {
		const groups = buildGroups(people, seenPairs, seenLocations);

		const roundGroups: Group[] = groups.map((group, i) => ({
			location: locations[i]!,
			leader: leaders[i] ?? null,
			people: group,
		}));

		rounds.push({
			round: r + 1,
			groups: roundGroups,
		});
	}

	return rounds;
}

function buildScheduleOutput(schedule: Round[]) {
	return schedule.map((round) => ({
		round: round.round,
		groups: round.groups.map((group) => ({
			location: group.location,
			leader: group.leader ?? null,
			people: [...group.people],
		})),
	}));
}

/**
 * Fix missing required locations by swapping people
 */
function fixMissingLocations(schedule: Round[], people: string[]) {
	const MAX_ITER = 1000;

	for (let iter = 0; iter < MAX_ITER; iter++) {
		let changed = false;

		// rebuild seenLocations
		const seenLocations = new Map<string, Set<string>>();
		for (const p of people) seenLocations.set(p, new Set());

		for (const round of schedule) {
			for (const group of round.groups) {
				for (const p of group.people) {
					seenLocations.get(p)!.add(group.location);
				}
			}
		}

		// count missing requirements
		const missing = new Map<string, number>();
		for (const p of people) {
			const seen = seenLocations.get(p)!;
			let count = 0;
			for (const loc of requiredLocations) {
				if (!seen.has(loc)) count++;
			}
			missing.set(p, count);
		}

		let totalMissing = [...missing.values()].reduce((a, b) => a + b, 0);
		if (totalMissing === 0) return; // done

		for (const person of people) {
			if (missing.get(person)! === 0) continue;

			for (const loc of requiredLocations) {
				if (seenLocations.get(person)!.has(loc)) continue;

				for (const round of schedule) {
					const targetGroup = round.groups.find((g) => g.location === loc)!;
					const currentGroup = round.groups.find((g) => g.people.includes(person));

					if (!currentGroup || currentGroup === targetGroup) continue;

					for (let i = 0; i < targetGroup.people.length; i++) {
						const candidate = targetGroup.people[i]!;

						// simulate swap
						const candidateMissing = missing.get(candidate)!;
						const personMissing = missing.get(person)!;

						// only accept if it improves total situation
						if (candidateMissing <= personMissing) {
							targetGroup.people[i] = person;
							currentGroup.people[currentGroup.people.indexOf(person)] = candidate;

							changed = true;
							break;
						}
					}

					if (changed) break;
				}

				if (changed) break;
			}

			if (changed) break;
		}

		if (!changed) break; // no improvement possible
	}
}

function forceRequiredCoverage(schedule: Round[], people: string[]) {
	for (const person of people) {
		const seen = new Set<string>();

		// compute seen locations
		for (const round of schedule) {
			for (const group of round.groups) {
				if (group.people.includes(person)) {
					seen.add(group.location);
				}
			}
		}

		for (const loc of requiredLocations) {
			if (seen.has(loc)) continue;

			// find a round where this location exists
			for (const round of schedule) {
				const targetGroup = round.groups.find((g) => g.location === loc)!;
				const currentGroup = round.groups.find((g) => g.people.includes(person))!;

				if (targetGroup === currentGroup) continue;

				// just swap with first person (no overthinking)
				const swapIndex = 0;
				const other = targetGroup.people[swapIndex]!;

				targetGroup.people[swapIndex] = person;
				currentGroup.people[currentGroup.people.indexOf(person)] = other;

				break;
			}
		}
	}
}

function forcePerPersonCompletion(schedule: Round[], people: string[]) {
	const MAX_PERSON_ITER = 20;

	for (const person of people) {
		let attempts = 0;

		while (attempts < MAX_PERSON_ITER) {
			attempts++;

			// recompute seen
			const seen = new Set<string>();

			for (const round of schedule) {
				for (const group of round.groups) {
					if (group.people.includes(person)) {
						seen.add(group.location);
					}
				}
			}

			const missing = requiredLocations.find((l) => !seen.has(l));
			if (!missing) break;

			let fixed = false;

			// shuffle rounds so we don’t always try same one
			const shuffledRounds = shuffle(schedule);

			for (const round of shuffledRounds) {
				const targetGroup = round.groups.find((g) => g.location === missing)!;
				const currentGroup = round.groups.find((g) => g.people.includes(person))!;

				if (targetGroup === currentGroup) continue;

				// shuffle candidates too
				const candidates = shuffle([...targetGroup.people]);

				for (const other of candidates) {
					// perform swap
					targetGroup.people[targetGroup.people.indexOf(other)] = person;
					currentGroup.people[currentGroup.people.indexOf(person)] = other;

					fixed = true;
					break;
				}

				if (fixed) break;
			}

			if (!fixed) break;
		}
	}
}

export default function groupsplit(people: string[]) {
	const schedule = generateSchedule(people);

	forceRequiredCoverage(schedule, people); // your earlier brute force
	fixMissingLocations(schedule, people); // your iterative repair
	forcePerPersonCompletion(schedule, people); // ← THIS is the missing piece

	return buildScheduleOutput(schedule);
}
