
import React, { useEffect, useState } from 'react';
import { getAllStudents } from '../../services/apiService';
import { Student } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import { Download, Search, ArrowUpDown } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';

type SortKey = 'firstname' | 'email' | 'level' | 'intakeDate' | 'status' | 'createdAt' | '';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE = 15;

const StudentRecords: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const dbSortKey = sortKey === 'level' ? 'levels(name)' : sortKey;
        const { students: data, count } = await getAllStudents(
            currentPage,
            PAGE_SIZE,
            debouncedSearchTerm,
            dbSortKey || 'createdAt',
            sortDirection
        );
        setStudents(data);
        setTotalStudents(count);
      } catch (error) {
        console.error("Failed to fetch students", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [currentPage, debouncedSearchTerm, sortKey, sortDirection]);
  
  // Effect to reset to page 1 when search term or sort changes
  useEffect(() => {
    if(currentPage !== 1) {
        setCurrentPage(1);
    }
  
  }, [debouncedSearchTerm, sortKey, sortDirection, currentPage]);


  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const exportToCSV = () => {
    alert("This will export only the records currently visible on this page. For a full data export, please use the database management tools.");
    const headers = ['Name', 'Email', 'WhatsApp', 'Level', 'IntakeDate', 'Status', 'RegistrationCode'];
    const csvContent = [
      headers.join(','),
      ...students.map(s => [
        `"${s.firstname} ${s.surname}"`,
        s.email,
        s.whatsapp,
        s.level?.name || 'N/A',
        s.intakeDate,
        s.status,
        s.registrationCode
      ].join(','))
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

      <div className="overflow-x-auto relative">
        {loading && <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10"><Spinner /></div>}
        <table className="min-w-full bg-white text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('firstname')}>
                <div className="flex items-center">Name {renderSortIcon('firstname')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('email')}>
                 <div className="flex items-center">Email {renderSortIcon('email')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600">WhatsApp</th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('level')}>
                 <div className="flex items-center">Level {renderSortIcon('level')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('intakeDate')}>
                 <div className="flex items-center">Intake Date {renderSortIcon('intakeDate')}</div>
              </th>
              <th className="py-2 px-4 text-left font-semibold text-gray-600 cursor-pointer" onClick={() => handleSort('status')}>
                 <div className="flex items-center">Status {renderSortIcon('status')}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{student.firstname} {student.surname}</td>
                <td className="py-2 px-4">{student.email}</td>
                <td className="py-2 px-4">{student.whatsapp}</td>
                <td className="py-2 px-4">{student.level?.name || 'N/A'}</td>
                <td className="py-2 px-4">{student.intakeDate}</td>
                <td className="py-2 px-4">
                   <span className={`px-2 py-1 text-xs font-semibold rounded-full ${student.status === 'checked-in' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {student.status}
                  </span>
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
