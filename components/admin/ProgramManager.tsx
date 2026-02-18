import React, { useEffect, useState } from 'react';
import { getPrograms, updateProgram, createProgram } from '../../services/apiService';
import { Program } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { PlusCircle, Archive, ArchiveRestore, Plus } from 'lucide-react';

const ProgramManager: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [flatPrograms, setFlatPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Partial<Program> | null>(null);

  const fetchPrograms = async () => {
    setLoading(true);
    try {
      const data = await getPrograms();
      setPrograms(data);
      const flatten = (ps: Program[]): Program[] => ps.flatMap(p => [p, ...(p.children ? flatten(p.children) : [])]);
      setFlatPrograms(flatten(data));
    } catch (error) {
      console.error("Failed to fetch programs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleOpenModal = (program?: Partial<Program>) => {
    setEditingProgram(program || { name: '', description: '', parentId: null, isActive: true, isArchived: false, sortOrder: 0 });
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setEditingProgram(null);
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!editingProgram?.name) return;
    try {
      const dataToSave = { ...editingProgram };
      if (dataToSave.parentId === 'null') dataToSave.parentId = null;

      if (dataToSave.id) {
        await updateProgram(dataToSave as Program);
      } else {
        await createProgram(dataToSave as Omit<Program, 'id'>);
      }
      handleCloseModal();
      fetchPrograms();
    } catch (error: any) {
      alert(`Failed to save program: ${error.message}`);
    }
  };
  
  const handleToggleArchive = async (program: Program) => {
      const isArchiving = !program.isArchived;
      if (window.confirm(`Are you sure you want to ${isArchiving ? 'archive' : 'unarchive'} this program?`)) {
          // FIX: The shorthand property 'isArchived' was used incorrectly. 
          // It should be 'isArchived: isArchiving' to pass the toggled value.
          await updateProgram({ ...program, isArchived: isArchiving });
          fetchPrograms();
      }
  };

  const handleToggleActive = async (program: Program) => {
    await updateProgram({ ...program, isActive: !program.isActive });
    fetchPrograms();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!editingProgram) return;
    const { name, value, type } = e.target;
    const val = (type === 'checkbox') ? (e.target as HTMLInputElement).checked : (type === 'number' ? parseInt(value) || 0 : value);
    setEditingProgram({ ...editingProgram, [name]: val });
  };
  
  const renderProgramRows = (programsToRender: Program[], level = 0): React.ReactNode[] => {
    return programsToRender.flatMap(program => [
      <tr key={program.id} className={`border-b hover:bg-gray-50 ${program.isArchived ? 'opacity-50 bg-gray-100' : ''}`}>
        <td className="py-2 px-4 font-medium" style={{ paddingLeft: `${1 + level * 1.5}rem` }}>
          {program.name}
          {program.isArchived && <span className="ml-2 text-xs font-bold text-red-600">ARCHIVED</span>}
        </td>
        <td className="py-2 px-4">
          <button onClick={() => handleToggleActive(program)}
            className={`px-2 py-1 text-xs font-semibold rounded-full ${program.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
          >
            {program.isActive ? 'Active' : 'Inactive'}
          </button>
        </td>
        <td className="py-2 px-4 flex items-center space-x-2">
          <Button onClick={() => handleOpenModal(program)} variant="secondary" className="text-xs py-1 px-2">Edit</Button>
          <Button onClick={() => handleOpenModal({ parentId: program.id })} variant="secondary" className="text-xs py-1 px-2"><Plus size={14}/></Button>
          <Button onClick={() => handleToggleArchive(program)} variant={program.isArchived ? 'secondary' : 'danger'} className="text-xs py-1 px-2">
            {program.isArchived ? <ArchiveRestore size={14}/> : <Archive size={14}/>}
          </Button>
        </td>
      </tr>,
      ...(program.children && program.children.length > 0
          ? renderProgramRows(program.children, level + 1)
          : [])
    ]);
  };

  if (loading) return <Spinner />;

  return (
    <Card title="Program Management">
      <div className="flex justify-end mb-4">
        <Button onClick={() => handleOpenModal()} className="flex items-center">
            <PlusCircle className="h-4 w-4 mr-2" /> Create New Program
        </Button>
      </div>

      {isModalOpen && editingProgram && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">{editingProgram.id ? 'Edit Program' : 'Create New Program'}</h3>
                <div className="space-y-4">
                    <Input label="Program Name" name="name" value={editingProgram.name} onChange={handleInputChange} />
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea name="description" value={editingProgram.description || ''} onChange={handleInputChange} rows={3} className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300" />
                    <Select label="Parent Program (optional)" name="parentId" value={editingProgram.parentId || 'null'} onChange={handleInputChange} options={[
                        {value: 'null', label: 'None (Top-Level Program)'},
                        ...flatPrograms.filter(p => !p.isArchived && p.id !== editingProgram.id).map(p => ({value: p.id, label: p.name}))
                    ]} />
                    <Input label="Sort Order" name="sortOrder" type="number" value={editingProgram.sortOrder} onChange={handleInputChange} />
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                    <Button variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                    <Button onClick={handleSave}>Save Program</Button>
                </div>
            </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Status</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {renderProgramRows(programs)}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default ProgramManager;