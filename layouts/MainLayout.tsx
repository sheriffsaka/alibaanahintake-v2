
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/landing/Header';

const MainLayout: React.FC = () => {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
    </>
  );
};

export default MainLayout;
