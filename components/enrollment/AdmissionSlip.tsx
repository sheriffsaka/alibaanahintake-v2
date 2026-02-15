import React, { useEffect, useState } from 'react';
import { Student } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import { getSchedules } from '../../services/mockApiService';

interface AdmissionSlipProps {
  student: Student;
}

const AdmissionSlip: React.FC<AdmissionSlipProps> = ({ student }) => {
  const [appointmentTime, setAppointmentTime] = useState('');

  useEffect(() => {
    const fetchSlotTime = async () => {
      const slots = await getSchedules();
      const studentSlot = slots.find(s => s.id === student.appointmentSlotId);
      if (studentSlot) {
        setAppointmentTime(`${studentSlot.startTime} - ${studentSlot.endTime}`);
      }
    };
    fetchSlotTime();
  }, [student.appointmentSlotId]);

  return (
    <div className="bg-white border-2 border-blue-600 rounded-lg p-6 shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b-2 border-dashed border-gray-300">
        <div>
          <h2 className="text-2xl font-bold text-blue-800">Al-Ibaanah Institute</h2>
          <p className="text-gray-600">Digital Admission Slip</p>
        </div>
        <div className="mt-4 sm:mt-0 text-right">
            <QRCodeSVG value={student.registrationCode} size={80} level="H" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <p className="text-sm text-gray-500">Student Name</p>
          <p className="font-semibold text-lg">{student.firstname} {student.surname}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Registration Code</p>
          <p className="font-mono font-bold text-lg text-red-600">{student.registrationCode}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Arabic Level</p>
          <p className="font-semibold text-lg">{student.level}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Appointment Date & Time</p>
          <p className="font-semibold text-lg">
            {new Date(student.intakeDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            {' @ '}{appointmentTime || '...'}
          </p>
        </div>
      </div>
      <div className="mt-6 text-center text-xs text-gray-500">
        Please present this slip (digital or printed) at the front desk upon arrival.
      </div>
    </div>
  );
};

export default AdmissionSlip;