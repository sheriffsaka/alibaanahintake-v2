import React, { useEffect, useState, useCallback } from 'react';
import { Program, ProgramResource, ResourceType } from '../../types';
import { getProgramResources, createProgramResource, updateProgramResource, deleteProgramResource } from '../../services/apiService';
import Spinner from '../common/Spinner';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
// FIX: Import 'Card' component to resolve 'Cannot find name' errors.
import Card from '../common/Card';
import { X, PlusCircle, Trash2, Edit2, Book, Video, Image, FileText } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

interface ResourceManagerModalProps {
    program: Program;
    onClose: () => void;
}

const ResourceTypeIcon = ({ type }: { type: ResourceType }) => {
    switch(type) {
        case ResourceType.Book: return <Book className="h-5 w-5 text-indigo-500" />;
        case ResourceType.Video: return <Video className="h-5 w-5 text-red-500" />;
        case ResourceType.Image: return <Image className="h-5 w-5 text-teal-500" />;
        case ResourceType.Document: return <FileText className="h-5 w-5 text-gray-500" />;
        default: return null;
    }
};

const ResourceManagerModal: React.FC<ResourceManagerModalProps> = ({ program, onClose }) => {
    const { t } = useTranslation();
    const [resources, setResources] = useState<ProgramResource[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingResource, setEditingResource] = useState<Partial<ProgramResource> | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchResources = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getProgramResources(program.id);
            setResources(data);
        } catch (error) {
            console.error(`Failed to fetch resources for program ${program.id}`, error);
        } finally {
            setLoading(false);
        }
    }, [program.id]);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    const handleOpenForm = (resource?: ProgramResource) => {
        setEditingResource(resource || { 
            title: '', 
            description: '', 
            resource_type: ResourceType.Book, 
            url: '',
            sort_order: resources.length + 1
        });
        setFile(null);
    };

    const handleCloseForm = () => {
        setEditingResource(null);
        setFile(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        if (!editingResource) return;
        const { name, value } = e.target;
        const val = name === 'sort_order' ? parseInt(value) || 0 : value;
        setEditingResource({ ...editingResource, [name]: val });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingResource?.title || (!editingResource.id && editingResource.resource_type !== 'video' && !file)) {
            alert("Title and file (for non-video types) are required.");
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingResource.id) { // Update
                await updateProgramResource(editingResource as ProgramResource, file || undefined);
            } else { // Create
                const newResource = {
                    ...editingResource,
                    program_id: program.id,
                } as Omit<ProgramResource, 'id' | 'created_at'>;
                await createProgramResource(newResource, file || undefined);
            }
            handleCloseForm();
            fetchResources();
        } catch (error) {
            console.error("Failed to save resource", error);
            alert("Failed to save resource. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (resource: ProgramResource) => {
        if (window.confirm(t('deleteResourceConfirm'))) {
            try {
                await deleteProgramResource(resource);
                fetchResources();
            } catch (error) {
                console.error("Failed to delete resource", error);
                alert("Failed to delete resource.");
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">{t('resourceManagerTitle', { programName: program.name })}</h2>
                    <Button onClick={onClose} variant="secondary" className="p-2 h-auto"><X size={20} /></Button>
                </header>

                <main className="p-6 overflow-y-auto">
                    {loading ? <Spinner /> : (
                        <div>
                            {/* Resource Form */}
                            {editingResource ? (
                                <Card className="mb-6 bg-gray-50">
                                    <h3 className="text-lg font-semibold mb-4">{editingResource.id ? t('editResource') : t('addResource')}</h3>
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <Input label={t('resourceTitleLabel')} name="title" value={editingResource.title || ''} onChange={handleInputChange} required />
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('description')}</label>
                                            <textarea name="description" value={editingResource.description || ''} onChange={handleInputChange} rows={3} className="block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm border-gray-300" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Select label={t('resourceTypeLabel')} name="resource_type" value={editingResource.resource_type} onChange={handleInputChange}
                                                options={Object.values(ResourceType).map(rt => ({ value: rt, label: t(`resource${rt.charAt(0).toUpperCase() + rt.slice(1)}`) }))} />
                                            <Input label={t('sortOrder')} name="sort_order" type="number" value={editingResource.sort_order} onChange={handleInputChange} />
                                        </div>
                                        {editingResource.resource_type === ResourceType.Video ? (
                                            <Input label={t('resourceUrlLabel')} name="url" value={editingResource.url || ''} onChange={handleInputChange} required />
                                        ) : (
                                            <Input label={t('resourceFileLabel')} type="file" onChange={handleFileChange} />
                                        )}
                                        <div className="flex justify-end space-x-2 pt-2">
                                            <Button type="button" variant="secondary" onClick={handleCloseForm}>{t('cancel')}</Button>
                                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : t('saveResource')}</Button>
                                        </div>
                                    </form>
                                </Card>
                            ) : (
                                <div className="text-right mb-4">
                                    <Button onClick={() => handleOpenForm()} className="flex items-center ml-auto">
                                        <PlusCircle className="h-4 w-4 mr-2" /> {t('addResource')}
                                    </Button>
                                </div>
                            )}

                            {/* Resource List */}
                            <div className="space-y-3">
                                {resources.length > 0 ? resources.map(res => (
                                    <div key={res.id} className="bg-white p-3 border rounded-lg flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex items-center gap-4">
                                            <ResourceTypeIcon type={res.resource_type} />
                                            <div>
                                                <p className="font-semibold text-gray-800">{res.title}</p>
                                                <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-xs block">{res.url}</a>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Button onClick={() => handleOpenForm(res)} variant="secondary" className="p-2 h-auto"><Edit2 size={16}/></Button>
                                            <Button onClick={() => handleDelete(res)} variant="danger" className="p-2 h-auto"><Trash2 size={16}/></Button>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-center text-gray-500 py-8">{t('noResourcesFound')}</p>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ResourceManagerModal;