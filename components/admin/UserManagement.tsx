
import React, { useEffect, useState } from 'react';
import { getAdminUsers, updateAdminUser } from '../../services/mockApiService';
import { AdminUser, Role } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import { ROLES } from '../../constants';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const data = await getAdminUsers();
        setUsers(data);
      } catch (error) {
        console.error("Failed to fetch users", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);
  
  const handleToggleActive = async (user: AdminUser) => {
      const updatedUser = { ...user, isActive: !user.isActive };
      await updateAdminUser(updatedUser);
      setUsers(users.map(u => u.id === user.id ? updatedUser : u));
  };
  
  const handleRoleChange = async (userId: string, newRole: Role) => {
      const user = users.find(u => u.id === userId);
      if(!user) return;
      const updatedUser = { ...user, role: newRole };
      await updateAdminUser(updatedUser);
      setUsers(users.map(u => u.id === user.id ? updatedUser : u));
  };

  if (loading) return <Spinner />;

  return (
    <Card title="Admin User Management">
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Email</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Role</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b">
                <td className="py-2 px-4">{user.name}</td>
                <td className="py-2 px-4">{user.email}</td>
                <td className="py-2 px-4">
                    <select 
                        value={user.role} 
                        onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                        className="p-1 border rounded"
                        disabled={user.role === Role.SuperAdmin}
                    >
                        {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                </td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2 px-4">
                  <Button
                    onClick={() => handleToggleActive(user)}
                    variant={user.isActive ? 'danger' : 'primary'}
                    className="text-xs py-1 px-2"
                    disabled={user.role === Role.SuperAdmin}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default UserManagement;
