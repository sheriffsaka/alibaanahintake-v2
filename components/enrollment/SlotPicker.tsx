import React, { useContext, useEffect, useState } from 'react';
import { EnrollmentContext } from '../../contexts/EnrollmentContext';
import { getAvailableSlots, getAvailableDatesForLevel } from '../../services/apiService';
import { AppointmentSlot } from '../../types';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { Clock, Users, Calendar } from 'lucide-react';

const SlotPicker: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");

  const { state, dispatch } = context;
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (!state.formData.levelId) return;
    const fetchDates = async () => {
      setLoading(true);
      try {
        const dates = await getAvailableDatesForLevel(state.formData.levelId);
        setAvailableDates(dates);
      } catch (error) {
        console.error("Failed to fetch dates", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDates();
  }, [state.formData.levelId]);

  useEffect(() => {
    if (!selectedDate || !state.formData.levelId) return;

    const fetchSlots = async () => {
      setLoading(true);
      setSelectedSlotId(null);
      try {
        const availableSlots = await getAvailableSlots(selectedDate, state.formData.levelId);
        setSlots(availableSlots);
      } catch (error) {
        console.error("Failed to fetch slots", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, [selectedDate, state.formData.levelId]);

  const handleConfirm = () => {
      if (selectedSlotId) {
          const selectedSlot = slots.find(s => s.id === selectedSlotId);
          if (selectedSlot) {
            dispatch({ type: 'SELECT_SLOT', payload: { id: selectedSlot.id, date: selectedSlot.date } });
          }
      }
  }

  const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Step 2: Select an Appointment Slot</h2>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
        <p><strong>Level:</strong> {slots.find(s => s.id === selectedSlotId)?.level.name || '...loading'}</p>
      </div>

      {/* Date Picker */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-700 mb-2 flex items-center"><Calendar className="h-5 w-5 mr-2" />Select an available date:</h3>
        {loading && !selectedDate ? <Spinner/> : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availableDates.length > 0 ? availableDates.map(date => (
                <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`p-3 border rounded-lg text-sm transition-all duration-200 ${selectedDate === date ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-500' : 'bg-white hover:bg-gray-100'}`}
                >
                    {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                </button>
            )) : <p className="col-span-full text-center text-gray-600">No available dates for this level.</p>}
            </div>
        )}
      </div>

      {/* Slot Picker */}
      {selectedDate && (
        <div>
            <h3 className="font-semibold text-gray-700 mb-3">Available slots for: <span className="text-blue-700 font-bold">{formatDate(selectedDate)}</span></h3>
            {loading ? (
            <Spinner />
            ) : (
            <div className="space-y-3">
              {slots.length > 0 ? slots.map(slot => {
                const isFull = slot.booked >= slot.capacity;
                const isSelected = selectedSlotId === slot.id;
                const percentage = slot.capacity > 0 ? (slot.booked / slot.capacity) * 100 : 0;
                
                let progressBarColor = 'bg-green-500';
                if (percentage >= 50) progressBarColor = 'bg-yellow-500';
                if (percentage >= 80) progressBarColor = 'bg-red-500';

                return (
                  <button
                    key={slot.id}
                    onClick={() => !isFull && setSelectedSlotId(slot.id)}
                    disabled={isFull}
                    className={`w-full text-left p-4 border rounded-lg transition-all duration-200
                      ${isFull ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white hover:border-blue-500 hover:shadow-md'}
                      ${isSelected ? 'border-blue-600 ring-2 ring-blue-500' : 'border-gray-300'}
                    `}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        {/* Time */}
                        <div className="flex items-center space-x-3 self-start sm:self-center">
                            <Clock className={`h-5 w-5 ${isFull ? 'text-gray-400' : 'text-blue-600'}`}/>
                            <span className="font-semibold text-lg">{slot.startTime} - {slot.endTime}</span>
                        </div>
                        {/* Capacity and Progress Bar */}
                        <div className="w-full sm:w-48">
                            <div className="flex justify-between items-center text-sm mb-1">
                                <span className="flex items-center">
                                    <Users className={`h-4 w-4 mr-1.5 ${isFull ? 'text-red-500' : 'text-gray-600'}`} />
                                    {slot.booked} / {slot.capacity} Booked
                                </span>
                                {isFull && <span className="text-xs font-bold text-red-600 uppercase">FULL</span>}
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className={`${isFull ? 'bg-gray-400' : progressBarColor} h-2 rounded-full transition-all duration-300`}
                                    style={{ width: `${percentage}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                  </button>
                )
              }) : <p className="text-center text-gray-600">No available slots for the selected date.</p>}
            </div>
          )}
        </div>
      )}

      <div className="pt-6 flex justify-between">
          <Button variant="secondary" onClick={() => dispatch({type: 'PREV_STEP'})}>Back</Button>
          <Button onClick={handleConfirm} disabled={!selectedSlotId || loading}>Confirm and Proceed</Button>
      </div>
    </div>
  );
};

export default SlotPicker;