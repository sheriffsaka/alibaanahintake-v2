
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types';
import { LayoutDashboard, CalendarCog, CheckSquare, Users, BookUser, Bell, Settings } from 'lucide-react';

const Sidebar: React.FC = () => {
    const { user } = useAuth();

    const navLinks = [
        { to: 'dashboard', text: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.MaleFrontDesk, Role.FemaleFrontDesk] },
        { to: 'schedule', text: 'Schedule Mgmt', icon: <CalendarCog size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin] },
        { to: 'check-in', text: 'Check-In', icon: <CheckSquare size={20} />, roles: [Role.SuperAdmin, Role.MaleFrontDesk, Role.FemaleFrontDesk] },
        { to: 'users', text: 'User Mgmt', icon: <Users size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin] },
        { to: 'notifications', text: 'Notifications', icon: <Bell size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin] },
        { to: 'settings', text: 'Settings', icon: <Settings size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin] },
    ];

    const activeLinkClass = "bg-blue-700 text-white";
    const inactiveLinkClass = "text-gray-300 hover:bg-blue-600 hover:text-white";

    return (
        <div className="hidden md:flex flex-col w-64 bg-blue-800">
            <div className="flex items-center justify-center h-20 shadow-md">
                <BookUser className="h-8 w-8 text-white mr-2"/>
                <h1 className="text-xl text-white font-bold">IntakeFlow</h1>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-2">
                {navLinks.map(link => (
                    user && link.roles.includes(user.role) && (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) =>
                                `flex items-center px-4 py-2 rounded-lg transition-colors duration-200 ${isActive ? activeLinkClass : inactiveLinkClass}`
                            }
                        >
                            {link.icon}
                            <span className="ml-3">{link.text}</span>
                        </NavLink>
                    )
                ))}
            </nav>
        </div>
    );
};

export default Sidebar;
