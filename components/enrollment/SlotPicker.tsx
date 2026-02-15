
import React, { useContext, useEffect, useState } from 'react';
import { EnrollmentContext } from '../../pages/EnrollmentPage';
import { getAvailableSlots } from '../../services/mockApiService';
import { AppointmentSlot } from '../../types';
import Button from '../common/Button';
import Spinner from '../common/Spinner';
import { Clock, Users } from 'lucide-react';

const SlotPicker: React.FC = () => {
  const context = useContext(EnrollmentContext);
  if (!context) throw new Error("Context not found");

  const { state, dispatch } = context;
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlots = async () => {
      setLoading(true);
      try {
        const availableSlots = await getAvailableSlots(state.formData.intakeDate, state.formData.level);
        setSlots(availableSlots);
      } catch (error) {
        console.error("Failed to fetch slots", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSlots();
  }, [state.formData.intakeDate, state.formData.level]);

  const handleSelectSlot = (slotId: string) => {
    setSelected(slotId);
  };
  
  const handleConfirm = () => {
      if(selected){
          dispatch({ type: 'SELECT_SLOT', payload: selected });
      }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">Step 2: Select an Appointment Slot</h2>
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <p><strong>Level:</strong> {state.formData.level}</p>
        <p><strong>Date:</strong> {new Date(state.formData.intakeDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {slots.length > 0 ? slots.map(slot => {
            const isFull = slot.booked >= slot.capacity;
            const isSelected = selected === slot.id;
            return (
              <button
                key={slot.id}
                onClick={() => !isFull && handleSelectSlot(slot.id)}
                disabled={isFull}
                className={`w-full text-left p-4 border rounded-lg transition-all duration-200
                  ${isFull ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white hover:border-blue-500 hover:shadow-md'}
                  ${isSelected ? 'border-blue-600 ring-2 ring-blue-500' : 'border-gray-300'}
                `}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-blue-600"/>
                    <span className="font-semibold text-lg">{slot.startTime} - {slot.endTime}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                     <Users className={`h-5 w-5 ${isFull ? 'text-red-500' : 'text-green-600'}`} />
                     <span className="text-sm">
                       {slot.booked} / {slot.capacity} booked
                     </span>
                     {isFull && <span className="text-xs font-bold text-red-600 uppercase">FULL</span>}
                  </div>
                </div>
              </button>
            )
          }) : <p className="text-center text-gray-600">No available slots for the selected date and level.</p>}
        </div>
      )}
      <div className="pt-6 flex justify-between">
          <Button variant="secondary" onClick={() => dispatch({type: 'PREV_STEP'})}>Back</Button>
          <Button onClick={handleConfirm} disabled={!selected || loading}>Confirm and Proceed</Button>
      </div>
    </div>
  );
};

export default SlotPicker;
