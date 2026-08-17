/** @format */
'use client';

import { useEffect, useRef } from 'react';

import Input from './Input';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export type Address = {
	street: string;
	number: string;
	suite?: string;
	postalCode: string;
	city: string;
	country: string;
	lat: number;
	lng: number;
};

type Props = {
	value: Address;
	onChange: (address: Address) => void;
};

function getComponent(components: google.maps.GeocoderAddressComponent[], type: string) {
	return components.find((c) => c.types.includes(type))?.long_name ?? '';
}

export default function AddressInput({ value, onChange }: Props) {
	const places = useMapsLibrary('places');

	const inputRef = useRef<HTMLInputElement>(null);
	const autocomplete = useRef<google.maps.places.Autocomplete | null>(null);

	useEffect(() => {
		console.log(places);
		if (!places || !inputRef.current) return;

		autocomplete.current = new places.Autocomplete(inputRef.current, {
			fields: ['geometry', 'address_components', 'formatted_address'],
		});

		autocomplete.current.addListener('place_changed', () => {
			const place = autocomplete.current?.getPlace();

			if (!place?.geometry?.location || !place.address_components) return;

			onChange({
				street: getComponent(place.address_components, 'route'),
				number: getComponent(place.address_components, 'street_number'),
				suite: getComponent(place.address_components, 'subpremise') || value.suite || '',
				postalCode: getComponent(place.address_components, 'postal_code'),
				city: getComponent(place.address_components, 'locality'),
				country: getComponent(place.address_components, 'country'),
				lat: place.geometry.location.lat(),
				lng: place.geometry.location.lng(),
			});
		});

		return () => {
			if (autocomplete.current) {
				google.maps.event.clearInstanceListeners(autocomplete.current);
			}
		};
	}, [places, onChange]);

	return (
		<div className="space-y-4">
			<Input
				ref={inputRef}
				label="Address"
				placeholder="Search address..."
				defaultValue={[value.suite, value.street, value.number, value.postalCode, value.city, value.country].filter(Boolean).join(', ')}
			/>

			<div className="grid md:grid-cols-2 gap-4">
				<Input label="Street" value={value.street} readOnly />

				<Input label="Number" value={value.number} readOnly />

				<Input label="Suite" value={value.suite} onChange={(e) => onChange({ ...value, suite: e.target.value })} />

				<Input label="Postal Code" value={value.postalCode} readOnly />

				<Input label="City" value={value.city} readOnly />

				<Input label="Country" value={value.country} readOnly />

				<Input label="Coordinates" value={value.lat && value.lng ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}` : ''} readOnly />
			</div>
		</div>
	);
}
