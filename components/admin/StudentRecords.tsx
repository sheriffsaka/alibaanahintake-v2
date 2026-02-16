
import React, { useEffect, useState, useMemo } from 'react';
import { getAllStudents } from '../../services/mockApiService';
import { Student } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import { Download, Search, ArrowUpDown } from 'lucide-react';

type SortKey = keyof Student | '';
type SortDirection = 'asc' | 'desc';

const StudentRecords: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const data = await getAllStudents();
        setStudents(data);
      } catch (error) {
        console.error("Failed to fetch students", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const sortedAndFilteredStudents = useMemo(() => {
    let filtered = students.filter(student =>
      `${student.firstname} ${student.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.registrationCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortKey) {
      filtered.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [students, searchTerm, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'WhatsApp', 'Level', 'IntakeDate', 'Status', 'RegistrationCode'];
    const csvContent = [
      headers.join(','),
      ...sortedAndFilteredStudents.map(s => [
        `"${s.firstname} ${s.surname}"`,
        s.email,
        s.whatsapp,
        s.level,
        s.intakeDate,
        s.status,
        s.registrationCode
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `student_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 ml-2 opacity-30" />;
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  if (loading) return <Spinner />;

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
        <Button onClick={exportToCSV} className="flex items-center w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          Export to CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
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
            {sortedAndFilteredStudents.map(student => (
              <tr key={student.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4">{student.firstname} {student.surname}</td>
                <td className="py-2 px-4">{student.email}</td>
                <td className="py-2 px-4">{student.whatsapp}</td>
                <td className="py-2 px-4">{student.level}</td>
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
        {sortedAndFilteredStudents.length === 0 && (
            <div className="text-center py-8 text-gray-500">No records found.</div>
        )}
      </div>
    </Card>
  );
};

export default StudentRecords;
