import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types';

interface ProtectedRouteProps {
  // Fix: Changed from JSX.Element to React.JSX.Element to resolve the namespace error.
  children: React.JSX.Element;
  allowedRoles: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Or a dedicated "Access Denied" component
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
                <p className="text-gray-700">You do not have permission to view this page.</p>
            </div>
        </div>
    );
  }

  return children;
};

export default ProtectedRoute;