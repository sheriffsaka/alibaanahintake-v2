import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Role } from '../../types';
import { LayoutDashboard, CalendarCog, CheckSquare, Users, BookUser, Bell, Settings, ClipboardList, Layers, PenSquare } from 'lucide-react';

const Sidebar: React.FC<{ isOpen: boolean }> = ({ isOpen }) => {
    const { user } = useAuth();

    const coAdminRoles = [Role.CoAdmin, Role.MaleCoAdmin, Role.FemaleCoAdmin];
    const navLinks = [
        { to: 'dashboard', text: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.MaleFrontDesk, Role.FemaleFrontDesk, ...coAdminRoles] },
        { to: 'schedule', text: 'Schedule Mgmt', icon: <CalendarCog size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, ...coAdminRoles] },
        { to: 'levels', text: 'Levels', icon: <Layers size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, ...coAdminRoles] },
        { to: 'content', text: 'Site Content', icon: <PenSquare size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, ...coAdminRoles] },
        { to: 'check-in', text: 'Check-In', icon: <CheckSquare size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, Role.MaleFrontDesk, Role.FemaleFrontDesk, ...coAdminRoles] },
        { to: 'students', text: 'Student Records', icon: <ClipboardList size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, ...coAdminRoles] },
        { to: 'users', text: 'User Mgmt', icon: <Users size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, ...coAdminRoles] },
        { to: 'notifications', text: 'Notifications', icon: <Bell size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, ...coAdminRoles] },
        { to: 'settings', text: 'Settings', icon: <Settings size={20} />, roles: [Role.SuperAdmin, Role.MaleAdmin, Role.FemaleAdmin, ...coAdminRoles] },
    ];

    const hasAccess = (allowedRoles: Role[]) => {
        if (!user?.role) return false;
        const userRoleStr = user.role.toString().trim().toLowerCase();
        return allowedRoles.some(r => {
            const roleStr = r.toString().trim().toLowerCase();
            if (roleStr === userRoleStr) return true;
            if (
                (roleStr === 'co_admin' || roleStr === 'male_co_admin' || roleStr === 'female_co_admin') &&
                (userRoleStr === 'co_admin' || userRoleStr === 'male_co_admin' || userRoleStr === 'female_co_admin')
            ) {
                return true;
            }
            return false;
        });
    };

    const activeLinkClass = "bg-blue-700 text-white";
    const inactiveLinkClass = "text-gray-300 hover:bg-blue-600 hover:text-white";

    return (
        <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-blue-800 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex md:flex-col`}>
            <Link to="/" className="flex items-center justify-center h-20 shadow-md hover:bg-blue-700 transition-colors">
                <BookUser className="h-8 w-8 text-white mr-2"/>
                <h1 className="text-xl text-white font-bold">IntakeFlow</h1>
            </Link>
            <nav className="flex-1 px-2 py-4 space-y-2">
                {navLinks.map(link => (
                    user && hasAccess(link.roles) && (
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
