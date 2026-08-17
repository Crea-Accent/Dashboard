"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSession } from "next-auth/react";

type DebugContextType = {
  debugMode: boolean;
};

const DebugContext = createContext<DebugContextType>({ debugMode: false });

export function DebugProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [debugMode, setDebugMode] = useState<boolean>(false);

  useEffect(() => {
    setDebugMode((session?.user as any)?.preferences?.debugMode ?? false);
  }, [session]);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <DebugContext.Provider value={{ debugMode }}>
      {isDev && debugMode && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
							:root {
								--accent: #ec4899 !important;
								--hover-accent: #db2777 !important;
								--active-accent: #be185d !important;
							}
						`,
          }}
        />
      )}
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const ctx = useContext(DebugContext);
  return ctx;
}

export function DebugInfo({
  title = "DEBUG INFO",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const { debugMode } = useDebug();

  if (!debugMode) return null;

  return (
    <div
      className={`bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-mono w-full max-w-full overflow-x-auto shadow-inner`}
    >
      <div className="font-bold mb-2 uppercase tracking-widest opacity-80">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
