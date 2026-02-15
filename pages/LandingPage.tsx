
import React from 'react';
import Hero from '../components/landing/Hero';
import Benefits from '../components/landing/Benefits';
import Faq from '../components/landing/Faq';
import VisitCampus from '../components/landing/VisitCampus';
import Footer from '../components/landing/Footer';


const LandingPage: React.FC = () => {
  return (
    <div className="bg-white text-gray-800">
      <main>
        <Hero />
        <Benefits />
        <Faq />
        <VisitCampus />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
