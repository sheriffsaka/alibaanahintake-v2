
import React from 'react';
import Hero from '../components/landing/Hero';
import CountdownTimer from '../components/common/CountdownTimer';
import Benefits from '../components/landing/Benefits';
import Faq from '../components/landing/Faq';
import VisitCampus from '../components/landing/VisitCampus';
import Footer from '../components/landing/Footer';


const LandingPage: React.FC = () => {
  return (
    <div className="bg-white text-gray-800">
      <main>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <CountdownTimer />
        </div>
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
