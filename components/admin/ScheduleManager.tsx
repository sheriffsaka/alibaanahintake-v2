
import React, { useEffect, useState } from 'react';
import { getSchedules, updateSchedule } from '../../services/mockApiService';
import { AppointmentSlot } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';

const ScheduleManager: React.FC = () => {
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<AppointmentSlot | null>(null);

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
  
  const handleEdit = (slot: AppointmentSlot) => {
    setEditingSlot({...slot});
  };

  const handleSave = async () => {
    if (!editingSlot) return;
    await updateSchedule(editingSlot);
    setEditingSlot(null);
    fetchSlots(); // Refresh data
  };

  if (loading) return <Spinner />;

  return (
    <Card title="Schedule Management">
        {editingSlot && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                    <h3 className="text-lg font-bold mb-4">Edit Slot</h3>
                    <div className="space-y-4">
                        <p><strong>Date:</strong> {editingSlot.date}</p>
                        <p><strong>Time:</strong> {editingSlot.startTime} - {editingSlot.endTime}</p>
                        <p><strong>Level:</strong> {editingSlot.level}</p>
                        <Input 
                            label="Capacity" 
                            type="number" 
                            value={editingSlot.capacity} 
                            onChange={(e) => setEditingSlot({...editingSlot, capacity: parseInt(e.target.value)})}
                        />
                    </div>
                    <div className="mt-6 flex justify-end space-x-2">
                        <Button variant="secondary" onClick={() => setEditingSlot(null)}>Cancel</Button>
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
            {slots.slice(0, 20).map(slot => ( // Paginate in a real app
              <tr key={slot.id} className="border-b">
                <td className="py-2 px-4">{slot.date}</td>
                <td className="py-2 px-4">{slot.startTime} - {slot.endTime}</td>
                <td className="py-2 px-4">{slot.level}</td>
                <td className="py-2 px-4">{slot.booked}</td>
                <td className="py-2 px-4">{slot.capacity}</td>
                <td className="py-2 px-4">
                  <Button onClick={() => handleEdit(slot)}>Edit</Button>
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
