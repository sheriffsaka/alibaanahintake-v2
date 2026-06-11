
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getAllStudents, getAllStudentsForExport, getAdminFilterOptions, getAdminSlotsForDate } from '../../services/apiService';
import { Student, AppointmentSlot, Level, Role, Gender } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import { Download, Search, ArrowUpDown, Trash2, Edit3, CheckSquare, Square, Send, ChevronDown, Check, X } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';
import { deleteStudent, updateStudentDetails, getLevels, bulkDeleteStudents, resendConfirmationEmail } from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth';
import Select from '../common/Select';

type SortKey = 'firstname' | 'email' | 'level' | 'intakeDate' | 'status' | 'createdAt' | 'gender' | '';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 15;

const StudentRecords: React.FC = () => {
  const { user } = useAuth();

  // Determine gender filter based on admin role
  const adminGenderFilter = useMemo(() => {
    if (!user) return undefined;
    if (user.role === Role.MaleAdmin || user.role === Role.MaleFrontDesk) {
      return Gender.Male;
    }
    if (user.role === Role.FemaleAdmin || user.role === Role.FemaleFrontDesk) {
      return Gender.Female;
    }
    return undefined; // Super Admin sees all
  }, [user]);

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  
  // New Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterSlotIds, setFilterSlotIds] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AppointmentSlot[]>([]);
  const [isSlotDropdownOpen, setIsSlotDropdownOpen] = useState(false);

  const handleResendConfirmation = async (student: Student) => {
    if (!student.email) return;
    if (!confirm(`Resend confirmation email to ${student.email}?`)) return;

    setResendingId(student.id);
    try {
      await resendConfirmationEmail(student.id);
      alert("Confirmation email resent successfully.");
    } catch (err) {
      console.error("Failed to resend confirmation", err);
      alert(err instanceof Error ? err.message : "Failed to resend confirmation email.");
    } finally {
      setResendingId(null);
    }
  };

  const isFetchingRef = useRef(false);

  const fetchStudents = React.useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    
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
          sortDirection,
          {
            intakeDate: filterDate || undefined,
            appointmentSlotId: filterSlotIds.length > 0 ? filterSlotIds : undefined,
            gender: adminGenderFilter
          }
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
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [currentPage, debouncedSearchTerm, sortKey, sortDirection, filterDate, filterSlotIds, adminGenderFilter]);

  useEffect(() => {
    fetchStudents();
    loadLevels();
  }, [fetchStudents]);

  // Sync / update student records page automatically when tab focuses or becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchStudents();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchStudents]);

  useEffect(() => {
    const fetchDates = async () => {
      const { dates } = await getAdminFilterOptions();
      setAvailableDates(dates);
    };
    fetchDates();
  }, []);

  useEffect(() => {
    const fetchSlots = async () => {
      if (filterDate) {
        const slots = await getAdminSlotsForDate(filterDate, adminGenderFilter);
        setAvailableSlots(slots);
      } else {
        setAvailableSlots([]);
        setFilterSlotIds([]);
      }
    };
    fetchSlots();
  }, [filterDate, adminGenderFilter]);

  const loadLevels = async () => {
    try {
      const data = await getLevels(true);
      setLevels(data);
    } catch (err) {
      console.error("Failed to load levels", err);
    }
  };
  
  // Effect to reset to page 1 when search term, sort or filters change
  useEffect(() => {
    if(currentPage !== 1) {
        setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm, sortKey, sortDirection, filterDate, filterSlotIds]);


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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} selected records? This action cannot be undone.`)) {
        try {
            setLoading(true);
            await bulkDeleteStudents(Array.from(selectedIds));
            alert(`${selectedIds.size} records deleted successfully.`);
            fetchStudents();
        } catch (err) {
            console.error("Failed to bulk delete students", err);
            alert("Failed to delete records. Please try again.");
            setLoading(false);
        }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length && students.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
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

  const exportToCSV = (data: Student[], filename: string) => {
    const headers = ['S/N', 'Name', 'Gender', 'Email', 'WhatsApp', 'Level', 'Address', 'IntakeDate', 'Status', 'RegistrationCode', 'RegisteredAt'];
    const csvContent = [
      headers.join(','),
      ...data.map((s, index) => {
        const serialNumber = index + 1;
        const fullAddress = s.buildingNumber 
            ? `${s.buildingNumber}${s.flatNumber ? ', Flat ' + s.flatNumber : ''}, ${s.streetName}, ${s.district}, ${s.state}`
            : s.address;
        
        const escapeCSV = (str: string) => {
            if (str === null || str === undefined) return '""';
            const stringified = String(str);
            return `"${stringified.replace(/"/g, '""')}"`;
        };

        return [
            serialNumber,
            escapeCSV(`${s.firstname} ${s.othername ? s.othername + ' ' : ''}${s.surname}`),
            escapeCSV(s.gender),
            escapeCSV(s.email),
            escapeCSV(s.whatsapp),
            escapeCSV(s.level?.name || 'N/A'),
            escapeCSV(fullAddress),
            escapeCSV(s.intakeDate),
            escapeCSV(s.status),
            escapeCSV(s.registrationCode),
            escapeCSV(s.createdAt)
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCurrentPage = () => {
    exportToCSV(students, `student_records_page_${currentPage}_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportAll = async () => {
    setIsExportingAll(true);
    try {
      let dbSortKey = sortKey === 'level' ? 'levels(name)' : sortKey;
      if (!dbSortKey) dbSortKey = 'created_at';
      
      const allStudents = await getAllStudentsForExport(
        debouncedSearchTerm,
        dbSortKey,
        sortDirection,
        {
          intakeDate: filterDate || undefined,
          appointmentSlotId: filterSlotIds.length > 0 ? filterSlotIds : undefined,
          gender: adminGenderFilter
        }
      );
      
      const filterInfo = filterDate ? `_${filterDate}${filterSlotIds.length > 0 ? '_multiple_slots' : ''}` : '';
      exportToCSV(allStudents, `student_records_all_${debouncedSearchTerm ? 'search_' + debouncedSearchTerm + '_' : ''}${filterInfo}_${new Date().toISOString().split('T')[0]}`);
    } catch (err) {
      console.error("Failed to export all students", err);
      alert("Failed to export student records. Please try again.");
    } finally {
      setIsExportingAll(false);
    }
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
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-2/3">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by name, email, code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="h-4 w-4 text-gray-400" />}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setFilterSlotIds([]);
              }}
              options={[
                { value: '', label: 'All Dates' },
                ...availableDates.map(d => ({ value: d, label: d }))
              ]}
              containerClassName="mb-0"
            />
          </div>
          <div className="w-full sm:w-80 relative">
            <div 
              className={`
                flex items-center justify-between px-3 py-2 border rounded-md shadow-sm bg-white cursor-pointer min-h-[38px]
                ${!filterDate ? 'bg-gray-100 cursor-not-allowed opacity-50' : 'hover:border-blue-400'}
                ${isSlotDropdownOpen ? 'ring-1 ring-blue-500 border-blue-500' : 'border-gray-300'}
              `}
              onClick={() => filterDate && setIsSlotDropdownOpen(!isSlotDropdownOpen)}
            >
              <div className="flex flex-wrap gap-1 items-center overflow-hidden">
                {filterSlotIds.length === 0 ? (
                  <span className="text-gray-500 text-sm">All Slots</span>
                ) : (
                  filterSlotIds.map(id => {
                    const slot = availableSlots.find(s => s.id === id);
                    return (
                      <span key={id} className="bg-blue-100 text-blue-800 text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
                        {slot ? `${slot.startTime}-${slot.endTime}` : id}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-blue-600" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterSlotIds(prev => prev.filter(item => item !== id));
                          }}
                        />
                      </span>
                    );
                  })
                )}
              </div>
              <ChevronDown className={`h-4 w-4 ml-2 text-gray-400 transition-transform ${isSlotDropdownOpen ? 'rotate-180' : ''}`} />
            </div>

            {isSlotDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsSlotDropdownOpen(false)}></div>
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto py-1">
                  {availableSlots.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No slots available for this date</div>
                  ) : (
                    <>
                      <div 
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm font-medium border-b border-gray-100"
                        onClick={() => setFilterSlotIds([])}
                      >
                        <div className={`w-4 h-4 mr-2 border rounded flex items-center justify-center ${filterSlotIds.length === 0 ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                          {filterSlotIds.length === 0 && <Check className="h-3 w-3" />}
                        </div>
                        All Slots
                      </div>
                      {availableSlots.map(slot => {
                        const isSelected = filterSlotIds.includes(slot.id);
                        return (
                          <div 
                            key={slot.id} 
                            className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                            onClick={() => {
                              setFilterSlotIds(prev => 
                                isSelected ? prev.filter(id => id !== slot.id) : [...prev, slot.id]
                              );
                            }}
                          >
                            <div className={`w-4 h-4 mr-2 border rounded flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300'}`}>
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                            <div className="flex flex-col">
                              <span>{slot.startTime} - {slot.endTime}</span>
                              <span className="text-[10px] text-gray-500 uppercase tracking-tight">{slot.gender} • {slot.level?.name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Button onClick={handleExportCurrentPage} variant="secondary" className="flex items-center flex-1 sm:flex-auto" disabled={students.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Current Page
          </Button>
          <Button onClick={handleExportAll} className="flex items-center flex-1 sm:flex-auto" disabled={students.length === 0 || isExportingAll}>
            <Download className="h-4 w-4 mr-2" />
            {isExportingAll ? "Exporting..." : "Export All"}
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-4">
          <Button variant="danger" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
          <span className="text-sm text-red-700 font-medium">{selectedIds.size} records selected</span>
        </div>
      )}

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
                    options={
                      adminGenderFilter 
                        ? [{ value: adminGenderFilter, label: adminGenderFilter }]
                        : [
                            { value: 'Male', label: 'Male' },
                            { value: 'Female', label: 'Female' }
                          ]
                    }
                    disabled={!!adminGenderFilter}
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
              <th className="py-2 px-4 text-center w-10">
                <div onClick={toggleSelectAll} className="cursor-pointer flex justify-center">
                  {selectedIds.size === students.length && students.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Square className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600">S/N</th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('firstname')}>
                <div className="flex items-center">Name {renderSortIcon('firstname')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600">Registration ID</th>
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
              <tr key={student.id} className={`border-b hover:bg-gray-50 ${selectedIds.has(student.id) ? 'bg-blue-50' : ''}`}>
                <td className="py-2 px-4 text-center">
                  <div onClick={() => toggleSelect(student.id)} className="cursor-pointer flex justify-center">
                    {selectedIds.has(student.id) ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </td>
                <td className="py-2 px-4 text-gray-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                <td className="py-2 px-4">{student.firstname} {student.othername ? student.othername + ' ' : ''}{student.surname}</td>
                <td className="py-2 px-4 font-mono font-semibold text-blue-700">{student.registrationCode}</td>
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
                            onClick={() => handleResendConfirmation(student)}
                            className={`${resendingId === student.id ? 'text-gray-400' : 'text-brand-green hover:text-green-700'} transition-colors p-1`}
                            title="Resend confirmation email"
                            disabled={resendingId === student.id}
                        >
                            <Send size={18} className={resendingId === student.id ? 'animate-pulse' : ''} />
                        </button>
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
