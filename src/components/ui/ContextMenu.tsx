/** @format */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ReactNode, useEffect } from "react";

export type ContextMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
};

type Props = {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
};

export default function ContextMenu({ open, x, y, items, onClose }: Props) {
  useEffect(() => {
    function close() {
      onClose();
    }

    window.addEventListener("click", close);

    return () => window.removeEventListener("click", close);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.95,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            scale: 0.95,
          }}
          style={{
            left: x,
            top: y,
          }}
          className="
						fixed
						z-9999
						min-w-55

						bg-white
						dark:bg-zinc-900

						border
						border-zinc-200
						dark:border-zinc-800

						rounded-xl
						shadow-xl

						overflow-hidden
					"
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={`
								w-full
								px-4
								py-3

								flex
								items-center
								gap-3

								text-sm
								text-left

								hover:bg-zinc-100
								dark:hover:bg-zinc-800

								transition

								${item.danger ? "text-red-500" : ""}
							`}
            >
              {item.icon}

              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
