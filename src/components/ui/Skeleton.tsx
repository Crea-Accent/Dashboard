/** @format */
'use client';

export default function Skeleton({ className = '' }: { className?: string }) {
	return <div className={`animate-pulse bg-(--border)/10 rounded-md ${className}`} />;
}
