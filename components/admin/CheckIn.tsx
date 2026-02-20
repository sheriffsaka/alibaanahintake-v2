
import React, { useState } from 'react';
import { findStudent, checkInStudent, getScheduleById } from '../../services/apiService';
import { Student } from '../../types';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { Search, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const CheckIn: React.FC = () => {
  const [query, setQuery] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [appointmentTime, setAppointmentTime] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setStudent(null);
    setMessage(null);
    try {
      const foundStudent = await findStudent(query);
      if (foundStudent) {
        setStudent(foundStudent);
        const fetchSlotTime = async () => {
            if (foundStudent.appointmentSlotId) {
                const studentSlot = await getScheduleById(foundStudent.appointmentSlotId);
                if (studentSlot) {
                    setAppointmentTime(`${studentSlot.date} @ ${studentSlot.startTime} - ${studentSlot.endTime}`);
                }
            }
        };
        fetchSlotTime();
        if (foundStudent.status === 'checked-in') {
            setMessage({ type: 'info', text: 'This student has already been checked in.' });
        }
      } else {
        setMessage({ type: 'error', text: 'No student found with the provided details.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred during search.' });
    } finally {
      setLoading(false);
    }
  };
  
  const handleCheckIn = async () => {
    if (!student) return;

    setLoading(true);
    try {
      const updatedStudent = await checkInStudent(student.id);
      setStudent(updatedStudent);
      setMessage({ type: 'success', text: 'Student checked in successfully!' });
    } catch (error) {
        setMessage({ type: 'error', text: error.message || 'Failed to check in.' });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Card title="Student Check-In">
      <form onSubmit={handleSearch} className="flex items-end space-x-2 mb-6">
        <Input
          label="Search by Reg. Code, Name, or Phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-grow"
          icon={<Search className="h-4 w-4 text-gray-400" />}
        />
        <Button type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</Button>
      </form>

      {loading && <Spinner />}
      
      {message && (
        <div className={`p-4 mb-4 rounded-md flex items-center
            ${message.type === 'success' && 'bg-green-100 text-green-800'}
            ${message.type === 'error' && 'bg-red-100 text-red-800'}
            ${message.type === 'info' && 'bg-yellow-100 text-yellow-800'}
        `}>
            {message.type === 'success' && <CheckCircle className="h-5 w-5 mr-3" />}
            {message.type === 'error' && <XCircle className="h-5 w-5 mr-3" />}
            {message.type === 'info' && <AlertTriangle className="h-5 w-5 mr-3" />}
            {message.text}
        </div>
      )}

      {student && (
        <Card title="Student Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p><strong>Name:</strong> {student.firstname} {student.surname}</p>
            <p><strong>Reg. Code:</strong> <span className="font-mono">{student.registrationCode}</span></p>
            <p><strong>Level:</strong> {student.level?.name || 'N/A'}</p>
            <p><strong>Status:</strong> <span className={`font-semibold ${student.status === 'checked-in' ? 'text-green-600' : 'text-blue-600'}`}>{student.status.toUpperCase()}</span></p>
            <p><strong>Appointment:</strong> {appointmentTime}</p>
          </div>
          <div className="mt-6 flex flex-col items-center">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(student.registrationCode)}&size=128x128`} alt="Registration QR Code" className="mb-4" />
          <div className="mt-6 text-center">
            <Button 
                onClick={handleCheckIn} 
                disabled={student.status === 'checked-in' || loading}
                className="w-full sm:w-auto"
            >
                {loading ? 'Processing...' : 'Mark as Checked-In'}
            </Button>
          </div>
        </div>
        </Card>
      )}
    </Card>
  );
};

export default CheckIn;
