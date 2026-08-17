/** @format */
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type LocalContextType = {
  local: boolean;
  url: string;
};

const LocalContext = createContext<LocalContextType | null>(null);

export function LocalProvider({ children }: { children: React.ReactNode }) {
  const [local, setLocal] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    (async () => {
      const server = (await fetch("/api/local")
        .then((res) => res.json())
        .catch(() => null)) as { message: string; ip: string };

      const local = await fetch(`http://${server?.ip}:3000/api/local`)
        .then(() => true)
        .catch(() => false);

      setLocal(local);
      local ? setUrl(`http://${server?.ip}:3000`) : setUrl("");
    })();
  }, []);

  return (
    <LocalContext.Provider
      value={{
        local,
        url,
      }}
    >
      {children}
    </LocalContext.Provider>
  );
}

export function useLocal() {
  const ctx = useContext(LocalContext);
  if (!ctx) throw new Error("Local must be used inside LocalProvider");
  return ctx;
}
