/** @format */
'use client';

import { InputHTMLAttributes, ReactNode, forwardRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import Button from './Button';

type Props = InputHTMLAttributes<HTMLInputElement> & {
	label?: string;
	error?: string;
	icon?: ReactNode;
	copyable?: boolean;
	viewable?: boolean;
};

const Input = forwardRef<HTMLInputElement, Props>(({ label, error, icon, copyable, viewable, className = '', ...props }, ref) => {
	const [isVisible, setIsVisible] = useState(viewable !== false);
	const [copied, setCopied] = useState(false);

	const handleCopy = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (!props.value) return;
		await navigator.clipboard.writeText(String(props.value));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};
	return (
		<div className="space-y-2">
			{label && <label className="text-sm font-medium text-(--text)">{label}</label>}

			<div className="relative">
				{icon && <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--text-muted) pointer-events-none">{icon}</div>}

				<input
					ref={ref}
					{...props}
					type={viewable === false && !isVisible ? 'password' : props.type || 'text'}
					className={`
							w-full
							h-11
							${icon ? 'pl-11' : 'px-4'}
							${icon ? 'pr-4' : ''}
							${copyable && viewable === false ? '!pr-[4.5rem]' : copyable || viewable === false ? '!pr-11' : ''}
							rounded-2xl
							bg-(--foreground)
							border
							text-sm
							text-(--text)
							placeholder:text-(--text-muted)
							outline-none
							transition-all

							${error ? `border-red-500 focus:border-red-500` : `border-(--border)/15 focus:border-(--accent)`}

							${className}
						`}
				/>

				{(copyable || viewable === false) && (
					<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
						{viewable === false && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setIsVisible(!isVisible)}
								className="!px-2 text-(--text-muted) hover:text-(--text)"
								icon={isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
							/>
						)}
						{copyable && props.value && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={handleCopy}
								className="!px-2 text-(--text-muted) hover:text-(--text)"
								icon={copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
							/>
						)}
					</div>
				)}
			</div>

			{error && <p className="text-xs text-red-500">{error}</p>}
		</div>
	);
});

Input.displayName = 'Input';

export default Input;
