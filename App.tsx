
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LandingPage from './pages/LandingPage';
import EnrollmentPage from './pages/EnrollmentPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/admin/ProtectedRoute';
import Dashboard from './components/admin/Dashboard';
import ScheduleManager from './components/admin/ScheduleManager';
import CheckIn from './components/admin/CheckIn';
import UserManagement from './components/admin/UserManagement';
import NotificationSettings from './components/admin/NotificationSettings';
import Settings from './components/admin/Settings';
import { Role } from './types';
import { LanguageProvider } from './i18n/LanguageContext';
import StudentRecords from './components/admin/StudentRecords';
import LevelManager from './components/admin/LevelManager';
import ProgramManager from './components/admin/ProgramManager';
import { SiteContentProvider } from './contexts/SiteContentContext';
import SiteContentManager from './components/admin/SiteContentManager';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route element={
              <SiteContentProvider>
                <MainLayout />
              </SiteContentProvider>
            }>
              <Route path="/" element={<LandingPage />} />
              <Route path="/enroll" element={<EnrollmentPage />} />
              <Route path="/login" element={<LoginPage />} />
            </Route>
            
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.MaleFrontDesk, Role.FemaleFrontDesk]}>
                  <AdminPage />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="schedule" element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                  <ScheduleManager />
                </ProtectedRoute>
              } />
               <Route path="levels" element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                  <LevelManager />
                </ProtectedRoute>
              } />
              <Route path="programs" element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                  <ProgramManager />
                </ProtectedRoute>
              } />
               <Route path="content" element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                  <SiteContentManager />
                </ProtectedRoute>
              } />
              <Route path="check-in" element={
                <ProtectedRoute allowedRoles={[Role.MaleFrontDesk, Role.FemaleFrontDesk, Role.SuperAdmin]}>
                  <CheckIn />
                </ProtectedRoute>
              } />
              <Route path="students" element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                  <StudentRecords />
                </ProtectedRoute>
              } />
              <Route path="users" element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                  <UserManagement />
                </ProtectedRoute>
              } />
              <Route path="notifications" element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                  <NotificationSettings />
                </ProtectedRoute>
              } />
              <Route path="settings" element={
                <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                  <Settings />
                </ProtectedRoute>
              } />
            </Route>
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
