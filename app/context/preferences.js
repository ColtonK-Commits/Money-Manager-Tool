// app/context/preferences.js

'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const PreferencesContext = createContext({ currency_symbol: '$', default_date_range: 'current_month' });

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState({ currency_symbol: '$', default_date_range: 'current_month' });

  useEffect(() => {
    fetch('/api/settings?type=preferences')
      .then(r => r.json())
      .then(data => setPreferences(data))
      .catch(() => {});
  }, []);

  return (
    <PreferencesContext.Provider value={preferences}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}