
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { SiteContent } from '../types';
import { getSiteContent } from '../services/apiService';

interface SiteContentContextType {
  content: SiteContent | null;
  loading: boolean;
}

const SiteContentContext = createContext<SiteContentContextType | undefined>(undefined);

const defaultContent: SiteContent = {
    logoUrl: '',
    officialSiteUrl: '#',
    // FIX: Changed heroVideoUrl from a string to an object to match the SiteContent type.
    heroVideoUrl: {},
    faqItems: [],
    campusAddress: '',
    campusHours: ''
};

export const SiteContentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
        try {
            const siteContent = await getSiteContent();
            setContent(siteContent);
        } catch (error) {
            console.error("Failed to fetch site content, using defaults.", error);
            setContent(defaultContent);
        } finally {
            setLoading(false);
        }
    };
    fetchContent();
  }, []);


  return (
    <SiteContentContext.Provider value={{ content, loading }}>
      {!loading && children}
    </SiteContentContext.Provider>
  );
};

export const useSiteContent = () => {
  const context = useContext(SiteContentContext);
  if (!context) {
    throw new Error('useSiteContent must be used within a SiteContentProvider');
  }
  return context;
};