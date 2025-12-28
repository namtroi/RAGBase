import { ProcessingProfile, ProfileCreateData } from '@/api/endpoints';
import { useCreateProfile } from '@/hooks/use-profiles';
import { X, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CONVERSION_FIELDS, CHUNKING_FIELDS, QUALITY_FIELDS } from './profile-field-config';

interface ProfileFormDialogProps {
    open: boolean;
    onClose: () => void;
    sourceProfile?: ProcessingProfile; // If provided, duplicate mode
}

/**
 * Generate a versioned name for duplicated profiles.
 * "Default" -> "Default v2"
 * "Default v2" -> "Default v3"
 */
function generateDuplicateName(originalName: string): string {
    const versionMatch = originalName.match(/^(.+) v(\d+)$/);
    if (versionMatch) {
        const base = versionMatch[1];
        const version = parseInt(versionMatch[2]) + 1;
        return `${base} v${version}`;
    }
    return `${originalName} v2`;
}

const DEFAULT_FORM_DATA: ProfileCreateData = {
    name: '',
    description: '',
    // Conversion defaults
    pdfConverter: 'pymupdf',
    pdfOcrMode: 'auto',
    pdfOcrLanguages: 'en',
    conversionTableRows: 35,
    conversionTableCols: 20,
    // Chunking defaults
    documentChunkSize: 1000,
    documentChunkOverlap: 100,
    documentHeaderLevels: 3,
    presentationMinChunk: 200,
    tabularRowsPerChunk: 20,
    // Quality defaults
    qualityMinChars: 50,
    qualityMaxChars: 2000,
    qualityPenaltyPerFlag: 0.15,
    autoFixEnabled: true,
    autoFixMaxPasses: 2,
};

export function ProfileFormDialog({ open, onClose, sourceProfile }: ProfileFormDialogProps) {
    const createMutation = useCreateProfile();
    const isDuplicate = !!sourceProfile;

    const [formData, setFormData] = useState<ProfileCreateData>(DEFAULT_FORM_DATA);
    const [nameError, setNameError] = useState<string | null>(null);

    // Reset form when dialog opens/closes or source changes
    useEffect(() => {
        if (open) {
            if (sourceProfile) {
                // Duplicate mode: pre-fill with source data
                setFormData({
                    name: generateDuplicateName(sourceProfile.name),
                    description: sourceProfile.description || '',
                    pdfConverter: sourceProfile.pdfConverter || 'pymupdf',
                    pdfOcrMode: sourceProfile.pdfOcrMode,
                    pdfOcrLanguages: sourceProfile.pdfOcrLanguages,
                    conversionTableRows: sourceProfile.conversionTableRows,
                    conversionTableCols: sourceProfile.conversionTableCols,
                    documentChunkSize: sourceProfile.documentChunkSize,
                    documentChunkOverlap: sourceProfile.documentChunkOverlap,
                    documentHeaderLevels: sourceProfile.documentHeaderLevels,
                    presentationMinChunk: sourceProfile.presentationMinChunk,
                    tabularRowsPerChunk: sourceProfile.tabularRowsPerChunk,
                    qualityMinChars: sourceProfile.qualityMinChars,
                    qualityMaxChars: sourceProfile.qualityMaxChars,
                    qualityPenaltyPerFlag: sourceProfile.qualityPenaltyPerFlag,
                    autoFixEnabled: sourceProfile.autoFixEnabled,
                    autoFixMaxPasses: sourceProfile.autoFixMaxPasses,
                });
            } else {
                // Create mode: use defaults
                setFormData(DEFAULT_FORM_DATA);
            }
        }
    }, [open, sourceProfile]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;
        setNameError(null);

        try {
            await createMutation.mutateAsync(formData);
            onClose();
        } catch (error: unknown) {
            // Check for duplicate name error
            const err = error as Error & { code?: string };
            if (err?.code === 'CONFLICT') {
                setNameError('Profile with this name already exists');
            } else {
                console.error('Failed to create profile:', error);
            }
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {isDuplicate ? 'Duplicate Profile' : 'Create New Profile'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 space-y-3">
                    {/* Source indicator for duplicate */}
                    {isDuplicate && sourceProfile && (
                        <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
                            Duplicating from: <span className="font-medium text-blue-700">{sourceProfile.name}</span>
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-0.5">Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => {
                                    setFormData({ ...formData, name: e.target.value });
                                    setNameError(null);  // Clear error when typing
                                }}
                                className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${nameError ? 'border-red-500' : 'border-gray-300'}`}
                                placeholder="My Custom Profile"
                                required
                            />
                            {nameError && (
                                <p className="text-red-600 text-xs mt-1">{nameError}</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-0.5">Description</label>
                            <input
                                type="text"
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                                placeholder="Optional description"
                            />
                        </div>
                    </div>

                    {/* Conversion Section */}
                    <SettingsSection title="Conversion">
                        <SelectInput
                            label={CONVERSION_FIELDS.pdfConverter.label}
                            tooltip={CONVERSION_FIELDS.pdfConverter.tooltip}
                            tooltipPosition="right"
                            value={formData.pdfConverter || 'pymupdf'}
                            onChange={(v) => setFormData({ ...formData, pdfConverter: v })}
                            options={[
                                { value: 'pymupdf', label: 'PyMuPDF4LLM (Fast)' },
                                { value: 'docling', label: 'Docling (High Quality)' }
                            ]}
                        />
                        {/* OCR settings - only show when Docling is selected */}
                        {formData.pdfConverter === 'docling' && (
                            <>
                                <SelectInput
                                    label={CONVERSION_FIELDS.pdfOcrMode.label}
                                    tooltip={CONVERSION_FIELDS.pdfOcrMode.tooltip}
                                    value={formData.pdfOcrMode!}
                                    onChange={(v) => setFormData({ ...formData, pdfOcrMode: v })}
                                    options={[
                                        { value: 'auto', label: 'Auto' },
                                        { value: 'force', label: 'Force' },
                                        { value: 'never', label: 'Never' }
                                    ]}
                                />
                                <TextInput
                                    label={CONVERSION_FIELDS.pdfOcrLanguages.label}
                                    tooltip={CONVERSION_FIELDS.pdfOcrLanguages.tooltip}
                                    value={formData.pdfOcrLanguages!}
                                    onChange={(v) => setFormData({ ...formData, pdfOcrLanguages: v })}
                                />
                            </>
                        )}
                        {/* Table conversion settings for XLSX/CSV */}
                        <NumberInput 
                            label={CONVERSION_FIELDS.conversionTableRows.label} 
                            tooltip={CONVERSION_FIELDS.conversionTableRows.tooltip} 
                            value={formData.conversionTableRows!} 
                            onChange={(v) => setFormData({ ...formData, conversionTableRows: v })} 
                        />
                        <NumberInput 
                            label={CONVERSION_FIELDS.conversionTableCols.label} 
                            tooltip={CONVERSION_FIELDS.conversionTableCols.tooltip} 
                            value={formData.conversionTableCols!} 
                            onChange={(v) => setFormData({ ...formData, conversionTableCols: v })} 
                        />
                    </SettingsSection>

                    {/* Chunking Section */}
                    <SettingsSection title="Chunking">
                        <NumberInput label={CHUNKING_FIELDS.documentChunkSize.label} tooltip={CHUNKING_FIELDS.documentChunkSize.tooltip} tooltipPosition="right" value={formData.documentChunkSize!} onChange={(v) => setFormData({ ...formData, documentChunkSize: v })} />
                        <NumberInput label={CHUNKING_FIELDS.documentChunkOverlap.label} tooltip={CHUNKING_FIELDS.documentChunkOverlap.tooltip} value={formData.documentChunkOverlap!} onChange={(v) => setFormData({ ...formData, documentChunkOverlap: v })} />
                        <NumberInput label={CHUNKING_FIELDS.documentHeaderLevels.label} tooltip={CHUNKING_FIELDS.documentHeaderLevels.tooltip} value={formData.documentHeaderLevels!} onChange={(v) => setFormData({ ...formData, documentHeaderLevels: v })} min={1} max={6} />
                        <NumberInput label={CHUNKING_FIELDS.presentationMinChunk.label} tooltip={CHUNKING_FIELDS.presentationMinChunk.tooltip} tooltipPosition="right" value={formData.presentationMinChunk!} onChange={(v) => setFormData({ ...formData, presentationMinChunk: v })} />
                        <NumberInput label={CHUNKING_FIELDS.tabularRowsPerChunk.label} tooltip={CHUNKING_FIELDS.tabularRowsPerChunk.tooltip} value={formData.tabularRowsPerChunk!} onChange={(v) => setFormData({ ...formData, tabularRowsPerChunk: v })} />
                    </SettingsSection>

                    {/* Quality Section */}
                    <SettingsSection title="Quality">
                        <NumberInput label={QUALITY_FIELDS.qualityMinChars.label} tooltip={QUALITY_FIELDS.qualityMinChars.tooltip} tooltipPosition="right" value={formData.qualityMinChars!} onChange={(v) => setFormData({ ...formData, qualityMinChars: v })} />
                        <NumberInput label={QUALITY_FIELDS.qualityMaxChars.label} tooltip={QUALITY_FIELDS.qualityMaxChars.tooltip} value={formData.qualityMaxChars!} onChange={(v) => setFormData({ ...formData, qualityMaxChars: v })} />
                        <NumberInput label={QUALITY_FIELDS.qualityPenaltyPerFlag.label} tooltip={QUALITY_FIELDS.qualityPenaltyPerFlag.tooltip} value={formData.qualityPenaltyPerFlag!} onChange={(v) => setFormData({ ...formData, qualityPenaltyPerFlag: v })} step={0.05} />
                        <CheckboxInput label={QUALITY_FIELDS.autoFixEnabled.label} tooltip={QUALITY_FIELDS.autoFixEnabled.tooltip} tooltipPosition="right" checked={formData.autoFixEnabled!} onChange={(v) => setFormData({ ...formData, autoFixEnabled: v })} />
                        <NumberInput label={QUALITY_FIELDS.autoFixMaxPasses.label} tooltip={QUALITY_FIELDS.autoFixMaxPasses.tooltip} value={formData.autoFixMaxPasses!} onChange={(v) => setFormData({ ...formData, autoFixMaxPasses: v })} min={1} max={5} />
                    </SettingsSection>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || !formData.name.trim()}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded hover:bg-primary-700 disabled:opacity-50"
                        >
                            {createMutation.isPending
                                ? (isDuplicate ? 'Duplicating...' : 'Creating...')
                                : (isDuplicate ? 'Duplicate Profile' : 'Create Profile')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="text-xs font-medium text-gray-700 mb-1">{title}</h3>
            <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded">
                {children}
            </div>
        </div>
    );
}

// Shared Tooltip component with formatted What/Why/How
// position: 'left' = tooltip on left, 'right' = tooltip on right
function Tooltip({ text, position = 'left' }: { text: string; position?: 'left' | 'right' }) {
    // Parse "What: ... Why: ... How: ..." format
    const parts = text.split(/(?=What:|Why:|How:)/g).filter(Boolean);

    // Position classes: if position='right', tooltip appears to the right of icon
    const positionClasses = position === 'right'
        ? 'left-0'  // Tooltip anchored to left edge, expands right
        : 'right-0'; // Tooltip anchored to right edge, expands left

    return (
        <span className="group relative inline-flex">
            <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
            <span className={`pointer-events-none absolute ${positionClasses} bottom-full mb-2 hidden group-hover:block w-64 p-2 text-xs text-white bg-gray-800 rounded shadow-lg z-50 whitespace-normal`}>
                {parts.map((part, i) => {
                    const [key, ...rest] = part.split(':');
                    const value = rest.join(':').trim();
                    return (
                        <div key={i} className={i > 0 ? 'mt-1.5 pt-1.5 border-t border-gray-600' : ''}>
                            <span className="font-semibold text-blue-300">{key}:</span>{' '}
                            <span>{value}</span>
                        </div>
                    );
                })}
            </span>
        </span>
    );
}

function NumberInput({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    tooltip,
    tooltipPosition = 'left'
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    tooltip?: string;
    tooltipPosition?: 'left' | 'right';
}) {
    return (
        <div>
            <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                {label}
                {tooltip && <Tooltip text={tooltip} position={tooltipPosition} />}
            </label>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                min={min}
                max={max}
                step={step}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
            />
        </div>
    );
}

function TextInput({
    label,
    value,
    onChange,
    tooltip,
    tooltipPosition = 'left'
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    tooltip?: string;
    tooltipPosition?: 'left' | 'right';
}) {
    return (
        <div>
            <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                {label}
                {tooltip && <Tooltip text={tooltip} position={tooltipPosition} />}
            </label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
            />
        </div>
    );
}

function SelectInput({
    label,
    value,
    onChange,
    options,
    tooltip,
    tooltipPosition = 'left'
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[] | { value: string; label: string }[];
    tooltip?: string;
    tooltipPosition?: 'left' | 'right';
}) {
    // Normalize options to always be { value, label } format
    const normalizedOptions = options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
    );

    return (
        <div>
            <label className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                {label}
                {tooltip && <Tooltip text={tooltip} position={tooltipPosition} />}
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
            >
                {normalizedOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

function CheckboxInput({
    label,
    checked,
    onChange,
    tooltip,
    tooltipPosition = 'left'
}: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    tooltip?: string;
    tooltipPosition?: 'left' | 'right';
}) {
    return (
        <div className="flex items-center gap-2">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label className="flex items-center gap-1 text-xs text-gray-600">
                {label}
                {tooltip && <Tooltip text={tooltip} position={tooltipPosition} />}
            </label>
        </div>
    );
}
