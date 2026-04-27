
import React, { useEffect, useState } from 'react';
import { getAllStudents } from '../../services/apiService';
import { Student } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import { Download, Search, ArrowUpDown, Trash2, Edit3 } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';
import { deleteStudent, updateStudentDetails, getLevels } from '../../services/apiService';
import { Level } from '../../types';
import Select from '../common/Select';

type SortKey = 'firstname' | 'email' | 'level' | 'intakeDate' | 'status' | 'createdAt' | 'gender' | '';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 15;

const StudentRecords: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchStudents = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const isPending = { current: true };
    const timeoutId = setTimeout(() => {
        if (isPending.current) {
            setError("Request timed out. Please check your connection and try again.");
            setLoading(false);
        }
    }, 20000); // 20 second timeout for potentially large student list

    try {
      let dbSortKey = sortKey === 'level' ? 'levels(name)' : sortKey;
      if (!dbSortKey) dbSortKey = 'created_at';
      
      const { students: data, count } = await getAllStudents(
          currentPage,
          PAGE_SIZE,
          debouncedSearchTerm,
          dbSortKey,
          sortDirection
      );
      isPending.current = false;
      clearTimeout(timeoutId);
      setStudents(data);
      setTotalStudents(count);
    } catch (err) {
      isPending.current = false;
      clearTimeout(timeoutId);
      console.error("Failed to fetch students", err);
      setError("Failed to load student records. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, sortKey, sortDirection]);

  useEffect(() => {
    fetchStudents();
    loadLevels();
  }, [fetchStudents]);

  const loadLevels = async () => {
    try {
      const data = await getLevels(true);
      setLevels(data);
    } catch (err) {
      console.error("Failed to load levels", err);
    }
  };
  
  // Effect to reset to page 1 when search term or sort changes
  useEffect(() => {
    if(currentPage !== 1) {
        setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, sortKey, sortDirection]);


  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (student: Student) => {
    if (window.confirm(`Are you sure you want to delete the record for ${student.firstname} ${student.surname}? This action cannot be undone.`)) {
        try {
            await deleteStudent(student.id);
            alert("Record deleted successfully.");
            fetchStudents();
        } catch (err) {
            console.error("Failed to delete student", err);
            alert("Failed to delete record. Please try again.");
        }
    }
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent({ ...student });
  };

  const handleUpdate = async () => {
    if (!editingStudent) return;
    setIsSaving(true);
    try {
      await updateStudentDetails(editingStudent.id, editingStudent);
      alert("Student record updated successfully.");
      setEditingStudent(null);
      fetchStudents();
    } catch (err) {
      console.error("Failed to update student", err);
      alert(err instanceof Error ? err.message : "Failed to update record.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!editingStudent) return;
    const { name, value } = e.target;
    setEditingStudent(prev => prev ? ({ ...prev, [name]: value }) : null);
  };

  const exportToCSV = () => {
    alert("This will export only the records currently visible on this page. For a full data export, please use the database management tools.");
    const headers = ['S/N', 'Name', 'Gender', 'Email', 'WhatsApp', 'Level', 'Address', 'IntakeDate', 'Status', 'RegistrationCode'];
    const csvContent = [
      headers.join(','),
      ...students.map((s, index) => {
        const serialNumber = (currentPage - 1) * PAGE_SIZE + index + 1;
        const fullAddress = s.buildingNumber 
            ? `${s.buildingNumber}${s.flatNumber ? ', Flat ' + s.flatNumber : ''}, ${s.streetName}, ${s.district}, ${s.state}`
            : s.address;
        return [
            serialNumber,
            `"${s.firstname} ${s.othername ? s.othername + ' ' : ''}${s.surname}"`,
            s.gender,
            s.email,
            s.whatsapp,
            s.level?.name || 'N/A',
            `"${fullAddress}"`,
            s.intakeDate,
            s.status,
            s.registrationCode
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `student_records_page_${currentPage}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 ml-2 opacity-30" />;
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  const totalPages = Math.ceil(totalStudents / PAGE_SIZE);

  if (error && students.length === 0) {
    return (
      <Card title="Student Records">
        <div className="p-8 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchStudents}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Student Records">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <div className="w-full sm:w-1/3">
          <Input
            placeholder="Search by name, email, code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="h-4 w-4 text-gray-400" />}
          />
        </div>
        <Button onClick={exportToCSV} className="flex items-center w-full sm:w-auto" disabled={students.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export Current Page
        </Button>
      </div>

      {editingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">Edit Student Record</h3>
              <p className="text-sm text-gray-500">Updating details for {editingStudent.registrationCode}</p>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Personal Info */}
                <div className="space-y-4 md:col-span-1">
                  <h4 className="font-semibold text-blue-600 border-b pb-1">Personal Info</h4>
                  <Input label="First Name" name="firstname" value={editingStudent.firstname} onChange={handleEditChange} required />
                  <Input label="Other Name" name="othername" value={editingStudent.othername || ''} onChange={handleEditChange} />
                  <Input label="Surname" name="surname" value={editingStudent.surname} onChange={handleEditChange} required />
                  <Select 
                    label="Gender" 
                    name="gender" 
                    value={editingStudent.gender} 
                    onChange={handleEditChange}
                    options={[
                        { value: 'Male', label: 'Male' },
                        { value: 'Female', label: 'Female' }
                    ]} 
                  />
                  <Input label="Email" name="email" value={editingStudent.email} onChange={handleEditChange} required />
                  <Input label="WhatsApp" name="whatsapp" value={editingStudent.whatsapp} onChange={handleEditChange} required />
                </div>

                {/* Appointment Info */}
                <div className="space-y-4 md:col-span-1">
                  <h4 className="font-semibold text-blue-600 border-b pb-1">Appointment</h4>
                  <Select 
                    label="Level" 
                    name="levelId" 
                    value={editingStudent.levelId} 
                    onChange={handleEditChange}
                    options={levels.map(l => ({ value: l.id, label: l.name }))}
                    required
                  />
                  <Input label="Intake Date" name="intakeDate" type="date" value={editingStudent.intakeDate} onChange={handleEditChange} required />
                  <Select 
                    label="Status" 
                    name="status" 
                    value={editingStudent.status} 
                    onChange={handleEditChange}
                    options={[
                        { value: 'booked', label: 'Booked' },
                        { value: 'checked-in', label: 'Checked-In' },
                        { value: 'archived', label: 'Archived' }
                    ]} 
                    required
                  />
                </div>

                {/* Address Info */}
                <div className="space-y-4 md:col-span-1">
                  <h4 className="font-semibold text-blue-600 border-b pb-1">Address</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Bldg No" name="buildingNumber" value={editingStudent.buildingNumber || ''} onChange={handleEditChange} />
                    <Input label="Flat No" name="flatNumber" value={editingStudent.flatNumber || ''} onChange={handleEditChange} />
                  </div>
                  <Input label="Street" name="streetName" value={editingStudent.streetName || ''} onChange={handleEditChange} />
                  <Input label="District" name="district" value={editingStudent.district || ''} onChange={handleEditChange} />
                  <Input label="State/City" name="state" value={editingStudent.state || ''} onChange={handleEditChange} />
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end space-x-3 bg-gray-50">
              <Button variant="secondary" onClick={() => setEditingStudent(null)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto relative">
        {loading && <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10"><Spinner /></div>}
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left font-semibold text-gray-600">S/N</th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('firstname')}>
                <div className="flex items-center">Name {renderSortIcon('firstname')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('gender')}>
                <div className="flex items-center">Gender {renderSortIcon('gender')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('email')}>
                 <div className="flex items-center">Email {renderSortIcon('email')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600">WhatsApp</th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('level')}>
                 <div className="flex items-center">Level {renderSortIcon('level')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600">Address</th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('intakeDate')}>
                 <div className="flex items-center">Intake Date {renderSortIcon('intakeDate')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('status')}>
                 <div className="flex items-center">Status {renderSortIcon('status')}</div>
              </th>
              <th className="py-2 px-4 text-center font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr key={student.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4 text-gray-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                <td className="py-2 px-4">{student.firstname} {student.othername ? student.othername + ' ' : ''}{student.surname}</td>
                <td className="py-2 px-4">{student.gender}</td>
                <td className="py-2 px-4">{student.email}</td>
                <td className="py-2 px-4">{student.whatsapp}</td>
                <td className="py-2 px-4">{student.level?.name || 'N/A'}</td>
                <td className="py-2 px-4 max-w-xs truncate" title={student.buildingNumber ? `${student.buildingNumber}, ${student.streetName}, ${student.district}, ${student.state}` : student.address}>
                    {student.buildingNumber 
                        ? `${student.buildingNumber}, ${student.streetName}, ${student.district}, ${student.state}`
                        : student.address}
                </td>
                <td className="py-2 px-4">{student.intakeDate}</td>
                <td className="py-2 px-4">
                   <span className={`px-2 py-1 text-xs font-semibold rounded-full ${student.status === 'checked-in' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {student.status}
                  </span>
                </td>
                <td className="py-2 px-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                        <button 
                            onClick={() => handleEditClick(student)}
                            className="text-blue-500 hover:text-blue-700 transition-colors p-1"
                            title="Edit record"
                        >
                            <Edit3 size={18} />
                        </button>
                        <button 
                            onClick={() => handleDelete(student)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="Delete record"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && students.length === 0 && (
            <div className="text-center py-8 text-gray-500">No records found.</div>
        )}
      </div>

      <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-sm text-gray-700">
            Showing <span className="font-semibold">{Math.min((currentPage - 1) * PAGE_SIZE + 1, totalStudents)}</span> to <span className="font-semibold">{Math.min(currentPage * PAGE_SIZE, totalStudents)}</span> of <span className="font-semibold">{totalStudents}</span> results
        </span>
        {totalPages > 1 && (
            <div className="flex items-center space-x-2">
            <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="secondary">Previous</Button>
            <span className="text-sm text-gray-600 px-2">Page {currentPage} of {totalPages}</span>
            <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="secondary">Next</Button>
            </div>
        )}
      </div>
    </Card>
  );
};

export default StudentRecords;
