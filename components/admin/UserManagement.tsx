
import React, { useEffect, useState } from 'react';
import { getAdminUsers, updateAdminUser, createAdminUser, deleteAdminUser } from '../../services/apiService';
import { AdminUser, Role } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { ROLES } from '../../constants';
import { PlusCircle, Trash2 } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<AdminUser> | null>(null);
  const [password, setPassword] = useState('');

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

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (user?: AdminUser) => {
    setEditingUser(user || { name: '', email: '', role: Role.MaleFrontDesk, isActive: true });
    setPassword('');
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setEditingUser(null);
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!editingUser?.email || !editingUser?.name || !editingUser?.role) return;

    try {
        if (editingUser.id) { // Update
            await updateAdminUser(editingUser as AdminUser);
        } else { // Create
            if (!password) {
                alert("Password is required for new users.");
                return;
            }
            await createAdminUser(editingUser as Omit<AdminUser, 'id'>, password);
        }
        handleCloseModal();
        fetchUsers();
    } catch (error) {
        alert(`Failed to save user: ${error.message}`);
    }
  };

  const handleDelete = async (userId: string) => {
      if (window.confirm('Are you sure you want to delete this user profile? This will not delete their login account.')) {
          try {
            await deleteAdminUser(userId);
            fetchUsers();
          } catch(e) {
              alert(e.message);
          }
      }
  };

  const handleToggleActive = async (user: AdminUser) => {
      const updatedUser = { ...user, isActive: !user.isActive };
      await updateAdminUser(updatedUser);
      fetchUsers();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editingUser) return;
    setEditingUser({ ...editingUser, [e.target.name]: e.target.value });
  };
  
  if (loading) return <Spinner />;

  return (
    <Card title="Admin User Management">
      <div className="flex justify-end mb-4">
        <Button onClick={() => handleOpenModal()} className="flex items-center">
            <PlusCircle className="h-4 w-4 mr-2" /> Create New User
        </Button>
      </div>

      {isModalOpen && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">{editingUser.id ? 'Edit User' : 'Create New User'}</h3>
                <div className="space-y-4">
                    <Input label="Full Name" name="name" value={editingUser.name} onChange={handleInputChange} />
                    <Input label="Email" name="email" type="email" value={editingUser.email} onChange={handleInputChange} />
                    <Select label="Role" name="role" value={editingUser.role} onChange={handleInputChange} options={ROLES.map(r => ({value: r, label: r}))} />
                    {!editingUser.id && (
                        <Input label="Password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    )}
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                    <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                    <Button onClick={handleSave}>Save User</Button>
                </div>
            </div>
        </div>
      )}

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
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{user.name}</td>
                <td className="py-2 px-4">{user.email}</td>
                <td className="py-2 px-4">{user.role}</td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-2 px-4 flex items-center space-x-2">
                  <Button onClick={() => handleOpenModal(user)} variant="secondary" className="text-xs py-1 px-2">Edit</Button>
                  <Button
                    onClick={() => handleToggleActive(user)}
                    variant={user.isActive ? 'secondary' : 'primary'}
                    className="text-xs py-1 px-2"
                    disabled={user.role === Role.SuperAdmin}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button onClick={() => handleDelete(user.id)} variant="danger" className="text-xs py-1 px-2" disabled={user.role === Role.SuperAdmin}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-4">*Note: Deleting a user removes their profile but does not delete their login account for security reasons. This must be done from the Supabase dashboard.</p>
      </div>
    </Card>
  );
};

export default UserManagement;