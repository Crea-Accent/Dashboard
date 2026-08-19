export interface BindingEntity {
	[key: string]: string;
}

export interface Binding {
	id: string;
	inputs: BindingEntity[];
	outputs: BindingEntity[];
	[key: string]: any;
}

export function parseDuotecnoBindings(content: string): Binding[] {
	const lines = content.split('\n');

	const bindings: Binding[] = [];
	let currentBinding: Binding | null = null;
	let currentEntity: any = null;

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();

		if (!line || line.startsWith(';***')) {
			if (currentBinding) {
				if (currentEntity && currentEntity !== currentBinding) {
					if ('INPUT' in currentEntity) {
						currentBinding.inputs.push(currentEntity);
					} else if ('OUTPUT' in currentEntity) {
						currentBinding.outputs.push(currentEntity);
					}
				}
				bindings.push(currentBinding);
				currentBinding = null;
				currentEntity = null;
			}
			continue;
		}

		if (line.endsWith(';')) {
			line = line.slice(0, -1);
		}

		if (line.includes('=')) {
			const index = line.indexOf('=');
			const key = line.slice(0, index);
			const val = line.slice(index + 1);

			if (key === 'BINDING') {
				currentBinding = { id: val, inputs: [], outputs: [] };
				currentEntity = currentBinding;
			} else if (key === 'INPUT') {
				if (currentEntity && currentEntity !== currentBinding) {
					if ('INPUT' in currentEntity) {
						currentBinding?.inputs.push(currentEntity);
					} else if ('OUTPUT' in currentEntity) {
						currentBinding?.outputs.push(currentEntity);
					}
				}
				currentEntity = { INPUT: val };
			} else if (key === 'OUTPUT') {
				if (currentEntity && currentEntity !== currentBinding) {
					if ('INPUT' in currentEntity) {
						currentBinding?.inputs.push(currentEntity);
					} else if ('OUTPUT' in currentEntity) {
						currentBinding?.outputs.push(currentEntity);
					}
				}
				currentEntity = { OUTPUT: val };
			} else {
				if (currentEntity !== null) {
					currentEntity[key] = val;
				}
			}
		}
	}

	// Catch the last binding if file doesn't end with ***
	if (currentBinding) {
		if (currentEntity && currentEntity !== currentBinding) {
			if ('INPUT' in currentEntity) {
				currentBinding.inputs.push(currentEntity);
			} else if ('OUTPUT' in currentEntity) {
				currentBinding.outputs.push(currentEntity);
			}
		}
		if (!bindings.includes(currentBinding)) {
			bindings.push(currentBinding);
		}
	}

	return bindings;
}

export function linkNodeUnitsWithBindings(nodedbContent: string, bindingContent: string) {
	const nodedb = JSON.parse(nodedbContent);
	const unitLookup: Record<string, string> = {};

	if (nodedb.nodes) {
		for (const node of nodedb.nodes) {
			if (node.units) {
				for (const unit of node.units) {
					const addrKey = `${unit.nodeAddress};${unit.unitAddress}`;
					unitLookup[addrKey] = `Node: ${node.name} -> Unit: ${unit.name}`;
				}
			}
		}
	}

	const bindings = parseDuotecnoBindings(bindingContent);

	const results = bindings.map((b) => {
		const mappedInputs = b.inputs.map((i) => {
			const addr = i.Address || '';
			return { ...i, unitInfo: unitLookup[addr] || 'Unknown Unit' };
		});

		const mappedOutputs = b.outputs.map((o) => {
			const addr = o.Address || '';
			return { ...o, unitInfo: unitLookup[addr] || 'Unknown Unit' };
		});

		return {
			...b,
			inputs: mappedInputs,
			outputs: mappedOutputs,
		};
	});

	return results;
}
