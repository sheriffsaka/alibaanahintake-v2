
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
    heroVideoUrl: {},
    faqItems: {},
    benefitItems: {
        en: [
            { title: 'Digital Slot Booking', description: 'Select a specific time slot for your on-campus evaluation. No more waiting in long queues.' },
            { title: 'Instant Admission Slips', description: 'Receive a digital booking code and slip immediately after booking your slot.' },
            { title: 'Fast-Track Check-In', description: 'Our streamlined 60-second check-in experience ensures a smooth and efficient start from the moment you arrive.' }
        ],
        ar: [
            { title: 'حجز المواعيد الرقمي', description: 'اختر موعدًا محددًا لتقييمك داخل الحرم الجامعي. لا مزيد من الانتظار في طوابير طويلة.' },
            { title: 'قسائم قبول فورية', description: 'احصل على رمز حجز رقمي وقسيمة فورًا بعد حجز موعدك.' },
            { title: 'تسجيل وصول سريع', description: 'تضمن تجربة تسجيل الوصول المبسطة التي تستغرق 60 ثانية بداية سلسة وفعالة من لحظة وصولك.' }
        ]
    },
    campusAddress: 'Block 12, Rd 18, Nasr City, Cairo, Egypt',
    campusHours: 'Sunday - Thursday, 9:00 AM - 2:00 PM'
};

export const SiteContentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchContent = async () => {
        try {
            const siteContent = await getSiteContent();
            if (mounted) {
                setContent(siteContent);
            }
        } catch (error) {
            console.error("Failed to fetch site content, using defaults.", error);
            if (mounted) {
                setContent(defaultContent);
            }
        } finally {
            if (mounted) {
                setLoading(false);
            }
        }
    };
    fetchContent();

    return () => {
        mounted = false;
    };
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