
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LandingPage from './pages/LandingPage';
import EnrollmentPage from './pages/EnrollmentPage';
import ManageBookingPage from './pages/ManageBookingPage';
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
import { SiteContentProvider } from './contexts/SiteContentContext';
import SiteContentManager from './components/admin/SiteContentManager';
import ErrorBoundary from './components/common/ErrorBoundary';
import DatabaseStatus from './components/common/DatabaseStatus';
import { useAuth } from './hooks/useAuth';

const AdminIndexRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="dashboard" replace />;
};

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <HashRouter>
            <DatabaseStatus />
            <Routes>
              <Route element={
                <SiteContentProvider>
                  <MainLayout />
                </SiteContentProvider>
              }>
                <Route path="/" element={<LandingPage />} />
                <Route path="/enroll" element={<EnrollmentPage />} />
                <Route path="/manage-booking" element={<ManageBookingPage />} />
                <Route path="/login" element={<LoginPage />} />
              </Route>
              
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.MaleFrontDesk, Role.FemaleFrontDesk, Role.CoAdmin]}>
                    <SiteContentProvider>
                      <AdminPage />
                    </SiteContentProvider>
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminIndexRedirect />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="schedule" element={
                  <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.CoAdmin]}>
                    <ScheduleManager />
                  </ProtectedRoute>
                } />
                 <Route path="levels" element={
                  <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.CoAdmin]}>
                    <LevelManager />
                  </ProtectedRoute>
                } />
                <Route path="content" element={
                  <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin]}>
                    <SiteContentManager />
                  </ProtectedRoute>
                } />
                <Route path="check-in" element={
                  <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.MaleFrontDesk, Role.FemaleFrontDesk, Role.CoAdmin]}>
                    <CheckIn />
                  </ProtectedRoute>
                } />
                <Route path="students" element={
                  <ProtectedRoute allowedRoles={[Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.CoAdmin]}>
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
    </ErrorBoundary>
  );
}

export default App;