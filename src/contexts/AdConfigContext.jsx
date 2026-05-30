import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AdConfigContext = createContext(null);

export const useAdConfig = () => {
  const context = useContext(AdConfigContext);
  if (!context) {
    throw new Error('useAdConfig must be used within an AdConfigProvider');
  }
  return context;
};

export const AdConfigProvider = ({ children }) => {
  const [adConfig, setAdConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAdConfig = async () => {
      try {
        const response = await axios.get('/api/config'); // Assuming /api/config is relative to the app's base URL
        setAdConfig(response.data);
      } catch (err) {
        console.error("Failed to fetch AdSense configuration:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdConfig();
  }, []);

  return (
    <AdConfigContext.Provider value={{ adConfig, loading, error }}>
      {children}
    </AdConfigContext.Provider>
  );
};
