import React, { createContext, useContext, useMemo } from 'react';

interface EmbeddedAppContextValue {
  isEmbeddedApp: boolean;
}

const EmbeddedAppContext = createContext<EmbeddedAppContextValue>({
  isEmbeddedApp: false,
});

interface EmbeddedAppProviderProps {
  isEmbeddedApp: boolean;
  children: React.ReactNode;
}

export function EmbeddedAppProvider({ isEmbeddedApp, children }: EmbeddedAppProviderProps) {
  const value = useMemo(() => ({ isEmbeddedApp }), [isEmbeddedApp]);
  return <EmbeddedAppContext.Provider value={value}>{children}</EmbeddedAppContext.Provider>;
}

export function useEmbeddedAppContext(): EmbeddedAppContextValue {
  return useContext(EmbeddedAppContext);
}
