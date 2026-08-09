import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../services/api';

const SchoolsContext = createContext(null);

export const SchoolsProvider = ({ children }) => {
  const [schools, setSchools] = useState([]);
  const [gharSchools, setGharSchools] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await settingsAPI.getSettings();
      const data = res.data?.data || {};
      setSchools(Array.isArray(data.schools) ? data.schools : Object.keys(data.schoolModules || {}));
      setGharSchools(data.gharSchools || {});
      setLastSynced(data.lastSchoolsSync ? new Date(data.lastSchoolsSync) : null);
    } catch (err) {
      console.error('Failed to load schools from settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refresh = async () => fetch();

  const syncFromGhar = async () => {
    await settingsAPI.syncSchools();
    await fetch();
  };

  return (
    <SchoolsContext.Provider value={{ schools, gharSchools, loading, lastSynced, refresh, syncFromGhar }}>
      {children}
    </SchoolsContext.Provider>
  );
};

export const useSchools = () => {
  const ctx = useContext(SchoolsContext);
  if (!ctx) throw new Error('useSchools must be used within SchoolsProvider');
  return ctx;
};

export default SchoolsContext;
