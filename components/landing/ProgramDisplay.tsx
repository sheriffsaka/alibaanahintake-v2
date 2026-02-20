
import React from 'react';
import { Program, ResourceType, ProgramResource } from '../../types';
import { Book, Video, Image, FileText, Link as LinkIcon, Download } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext';

const ResourceTypeIcon = ({ type }: { type: ResourceType }) => {
    switch(type) {
        case ResourceType.Book: return <Book className="h-5 w-5 text-indigo-500 flex-shrink-0" />;
        case ResourceType.Video: return <Video className="h-5 w-5 text-red-500 flex-shrink-0" />;
        case ResourceType.Image: return <Image className="h-5 w-5 text-teal-500 flex-shrink-0" />;
        case ResourceType.Document: return <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />;
        default: return <LinkIcon className="h-5 w-5 text-gray-500 flex-shrink-0" />;
    }
};

const ResourceItem: React.FC<{ resource: ProgramResource }> = ({ resource }) => (
    <a 
        href={resource.url} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="flex items-center gap-3 p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors group"
    >
        <ResourceTypeIcon type={resource.resource_type} />
        <div className="flex-grow">
            <p className="font-semibold text-gray-800">{resource.title}</p>
            {resource.description && <p className="text-sm text-gray-600">{resource.description}</p>}
        </div>
        <Download className="h-5 w-5 text-gray-400 group-hover:text-brand-green transition-colors" />
    </a>
);


const ProgramDisplay: React.FC<{ program: Program; level?: number }> = ({ program, level = 0 }) => {
    const { t } = useTranslation();
    const hasResources = program.resources && program.resources.length > 0;
    const hasChildren = program.children && program.children.length > 0;

    return (
        <div className={`bg-white rounded-xl shadow-md overflow-hidden ${level > 0 ? 'border-l-4 border-brand-green-light' : 'border-t-4 border-brand-green'}`}>
            <div className="p-6">
                <h2 className={`font-bold text-gray-800 ${level === 0 ? 'text-2xl' : 'text-xl'}`}>
                    {program.name}
                </h2>
                {program.description && (
                    <p className="mt-2 text-gray-600">{program.description}</p>
                )}

                {hasResources && (
                    <div className="mt-6">
                        <h4 className="font-semibold text-gray-700 mb-3">{t('programResourcesTitle')}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {program.resources?.map(resource => (
                                <ResourceItem key={resource.id} resource={resource} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {hasChildren && (
                <div className="bg-gray-50 p-4 space-y-4">
                    {program.children?.map(childProgram => (
                        <ProgramDisplay key={childProgram.id} program={childProgram} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProgramDisplay;
