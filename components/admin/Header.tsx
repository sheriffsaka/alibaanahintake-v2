
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, UserCircle } from 'lucide-react';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 md:ml-0 ml-16">
      <div className="flex items-center">
        {/* Can add breadcrumbs or page title here */}
      </div>
      <div className="flex items-center">
        {user && (
          <div className="flex items-center mr-4">
            <UserCircle className="h-8 w-8 text-gray-500 mr-2" />
            <div>
                <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
