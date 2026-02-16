
import React, { useEffect, useState } from 'react';
import { getSchedules, updateSchedule, createSchedule, deleteSchedule } from '../../services/mockApiService';
import { AppointmentSlot, Level } from '../../types';
import { LEVELS } from '../../constants';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { PlusCircle, Trash2 } from 'lucide-react';

const ScheduleManager: React.FC = () => {
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<Partial<AppointmentSlot> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const data = await getSchedules();
      setSlots(data);
    } catch (error) {
      console.error("Failed to fetch schedules", error);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSlots();
  }, []);
  
  const handleOpenModal = (slot?: AppointmentSlot) => {
    setEditingSlot(slot || {
        date: new Date().toISOString().split('T')[0],
        level: Level.Beginner,
        startTime: '09:00',
        endTime: '10:00',
        capacity: 10,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingSlot(null);
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!editingSlot) return;
    
    if (editingSlot.id) { // Editing existing
      await updateSchedule(editingSlot as AppointmentSlot);
    } else { // Creating new
      const { id, booked, ...newSlotData } = editingSlot;
      await createSchedule(newSlotData as Omit<AppointmentSlot, 'id' | 'booked'>);
    }
    
    handleCloseModal();
    fetchSlots();
  };

  const handleDelete = async (slotId: string) => {
      if (window.confirm('Are you sure you want to delete this slot? This action cannot be undone.')) {
        await deleteSchedule(slotId);
        fetchSlots();
      }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (!editingSlot) return;
      const { name, value } = e.target;
      setEditingSlot({ ...editingSlot, [name]: name === 'capacity' ? parseInt(value) : value });
  };

  if (loading) return <Spinner />;

  return (
    <Card title="Schedule Management">
        <div className="flex justify-end mb-4">
            <Button onClick={() => handleOpenModal()} className="flex items-center">
                <PlusCircle className="h-4 w-4 mr-2"/>
                Create New Slot
            </Button>
        </div>

        {isModalOpen && editingSlot && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                    <h3 className="text-lg font-bold mb-4">{editingSlot.id ? 'Edit Slot' : 'Create New Slot'}</h3>
                    <div className="space-y-4">
                        <Input label="Date" name="date" type="date" value={editingSlot.date} onChange={handleInputChange} />
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Start Time" name="startTime" type="time" value={editingSlot.startTime} onChange={handleInputChange} />
                            <Input label="End Time" name="endTime" type="time" value={editingSlot.endTime} onChange={handleInputChange} />
                        </div>
                        <Select label="Level" name="level" value={editingSlot.level} onChange={handleInputChange} options={LEVELS.map(l => ({value: l, label: l}))} />
                        <Input label="Capacity" name="capacity" type="number" value={editingSlot.capacity} onChange={handleInputChange} min="0"/>
                    </div>
                    <div className="mt-6 flex justify-end space-x-2">
                        <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                        <Button onClick={handleSave}>Save Changes</Button>
                    </div>
                </div>
            </div>
        )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Date</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Time</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Level</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Booked</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Capacity</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map(slot => (
              <tr key={slot.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{slot.date}</td>
                <td className="py-2 px-4">{slot.startTime} - {slot.endTime}</td>
                <td className="py-2 px-4">{slot.level}</td>
                <td className="py-2 px-4">{slot.booked}</td>
                <td className="py-2 px-4">{slot.capacity}</td>
                <td className="py-2 px-4 flex items-center space-x-2">
                  <Button onClick={() => handleOpenModal(slot)} variant="secondary" className="text-xs py-1 px-2">Edit</Button>
                  <Button onClick={() => handleDelete(slot.id)} variant="danger" className="text-xs py-1 px-2">
                    <Trash2 className="h-4 w-4"/>
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

export default ScheduleManager;
