
import React, { createContext, useState, ReactNode } from 'react';
import { AdminUser, Role } from '../types';

interface AuthContextType {
  user: AdminUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_USERS: AdminUser[] = [
    { id: 'user-1', name: 'Super Admin', email: 'super@al-ibaanah.com', role: Role.SuperAdmin, isActive: true },
    { id: 'user-2', name: 'Ahmed Ali', email: 'male.admin@al-ibaanah.com', role: Role.MaleAdmin, isActive: true },
    { id: 'user-3', name: 'Fatima Zahra', email: 'female.admin@al-ibaanah.com', role: Role.FemaleAdmin, isActive: true },
    { id: 'user-4', name: 'Yusuf Ibrahim', email: 'male.desk@al-ibaanah.com', role: Role.MaleFrontDesk, isActive: true },
    { id: 'user-5', name: 'Aisha Omar', email: 'female.desk@al-ibaanah.com', role: Role.FemaleFrontDesk, isActive: true },
];


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);

  const login = async (email: string, password: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => { // Simulate API delay
        const foundUser = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        // In a real app, this would be a bcrypt.compare call.
        if (foundUser && password === 'password123' && foundUser.isActive) {
          setUser(foundUser);
          resolve();
        } else if (foundUser && !foundUser.isActive) {
          reject(new Error('This user account is inactive.'));
        }
        else {
          reject(new Error('Invalid credentials. Please try again.'));
        }
      }, 500);
    });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
