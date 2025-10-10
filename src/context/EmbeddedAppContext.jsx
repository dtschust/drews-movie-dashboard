import React, { createContext, useContext, useMemo } from 'react';

const EmbeddedAppContext = createContext({
  isEmbeddedApp: false,
});

export function EmbeddedAppProvider({ isEmbeddedApp, children }) {
  const value = useMemo(() => ({ isEmbeddedApp }), [isEmbeddedApp]);
  return (
    <EmbeddedAppContext.Provider value={value}>
      {children}
    </EmbeddedAppContext.Provider>
  );
}

export function useEmbeddedAppContext() {
  return useContext(EmbeddedAppContext);
}

