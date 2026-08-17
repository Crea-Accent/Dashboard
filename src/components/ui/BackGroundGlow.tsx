/** @format */
'use client';

import { motion } from 'framer-motion';

export default function BackgroundGlow() {
	return (
		<>
			<motion.div
				className="pointer-events-none fixed inset-0 z-0"
				animate={{
					x: [0, 20, 0],
					y: [0, -15, 0],
				}}
				transition={{
					duration: 60,
					repeat: Infinity,
					ease: 'easeInOut',
				}}
				style={{
					background: `
                radial-gradient(
                    1200px circle at 15% 10%,
                    color-mix(in srgb, var(--accent) 20%, transparent),
                    transparent 75%
					),
                    
					radial-gradient(
						900px circle at 85% 15%,
						color-mix(in srgb, var(--accent) 12%, transparent),
						transparent 80%
                        ),
                        
                        radial-gradient(
                            1400px circle at 50% -10%,
                            color-mix(in srgb, var(--accent) 10%, transparent),
                            transparent 85%
                            )
                            `,
					filter: 'blur(120px)',
				}}
			/>
			<motion.div
				className="pointer-events-none fixed inset-0 z-0"
				animate={{
					x: ['-5%', '5%', '-5%'],
				}}
				transition={{
					duration: 80,
					repeat: Infinity,
					ease: 'easeInOut',
				}}
				style={{
					background: 'linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.015) 50%, transparent 60%)',
					filter: 'blur(100px)',
				}}
			/>
		</>
	);
}
