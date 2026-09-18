import React, { useEffect, useState, useRef } from 'react';
import { getLevels, updateLevel, createLevel, deleteLevel } from '../../services/apiService';
import { Level } from '../../types';
import Spinner from '../common/Spinner';
import Card from '../common/Card';
import Button from '../common/Button';
import Input from '../common/Input';
import { PlusCircle, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';
import { withHardTimeout, isHardTimeoutError, HARD_TIMEOUT_USER_MESSAGE } from '../../utils/withHardTimeout';

const LevelManager: React.FC = () => {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<Partial<Level> | null>(null);
  const { t } = useTranslation();
  const isFetchingRef = useRef(false);

  const fetchLevels = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await withHardTimeout(
        () => getLevels(true), // Fetch all levels, including inactive
        15000,
        "Fetching levels"
      );
      setLevels(data);
    } catch (error) {
      console.error("Failed to fetch levels", error);
      if (isHardTimeoutError(error)) {
        setError(HARD_TIMEOUT_USER_MESSAGE);
      } else {
        setError("Failed to load levels. Please try again.");
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

  const handleRetry = () => {
    isFetchingRef.current = false;
    fetchLevels();
  };

  useEffect(() => {
    fetchLevels();

    let timer: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => {
          if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            await safeRefreshSession();
            fetchLevels();
          }
        }, 300);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  const handleOpenModal = (level?: Level) => {
    setEditingLevel(level || { name: '', isActive: true, sortOrder: 0 });
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setEditingLevel(null);
    setIsModalOpen(false);
  };

  const handleSave = async () => {
    if (!editingLevel?.name) return;

    try {
        if (editingLevel.id) { // Update
            await updateLevel(editingLevel as Level);
        } else { // Create
            await createLevel(editingLevel as Omit<Level, 'id'>);
        }
        handleCloseModal();
        fetchLevels();
    } catch (error) {
        alert(`Failed to save level: ${error.message}`);
    }
  };

  const handleDelete = async (levelId: string) => {
      if (window.confirm(t('deleteLevelConfirm'))) {
          try {
            await deleteLevel(levelId);
            fetchLevels();
          } catch(e) {
              alert(e.message);
          }
      }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingLevel) return;
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) || 0 : value);
    setEditingLevel({ ...editingLevel, [name]: val });
  };
  
  if (loading && levels.length === 0) {
    return (
        <div className="flex items-center justify-center h-64">
            <Spinner />
        </div>
    );
  }

  if (error && levels.length === 0) {
    return (
      <Card title={t('levelManagerTitle')}>
        <div className="p-12 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Levels</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={handleRetry} className="inline-flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('levelManagerTitle')}>
      {error && levels.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={handleRetry} className="flex-shrink-0">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Retry
          </Button>
        </div>
      )}
      <div className="flex justify-end mb-4">
        <Button onClick={() => handleOpenModal()} className="flex items-center">
            <PlusCircle className="h-4 w-4 mr-2" /> {t('createNewLevel')}
        </Button>
      </div>

      {isModalOpen && editingLevel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">{editingLevel.id ? t('editLevel') : t('createNewLevel')}</h3>
                <div className="space-y-4">
                    <Input label={t('levelName')} name="name" value={editingLevel.name} onChange={handleInputChange} />
                    <Input label={t('sortOrder')} name="sortOrder" type="number" value={editingLevel.sortOrder} onChange={handleInputChange} />
                    <div className="flex items-center">
                        <input type="checkbox" id="isActive" name="isActive" checked={editingLevel.isActive} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">{t('active')}</label>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                    <Button variant="secondary" onClick={handleCloseModal}>{t('cancel')}</Button>
                    <Button onClick={handleSave}>{t('saveLevel')}</Button>
                </div>
            </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">{t('name')}</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">{t('status')}</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">{t('sortOrder')}</th>
              <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {levels.map(level => (
              <tr key={level.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4 font-medium">{level.name}</td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${level.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {level.isActive ? t('active') : t('inactive')}
                  </span>
                </td>
                <td className="py-2 px-4">{level.sortOrder}</td>
                <td className="py-2 px-4 flex items-center space-x-2">
                  <Button onClick={() => handleOpenModal(level)} variant="secondary" className="text-xs py-1 px-2">{t('edit')}</Button>
                  <Button onClick={() => handleDelete(level.id)} variant="danger" className="text-xs py-1 px-2">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default LevelManager;