import { ProfileCreateData } from '@/api/endpoints';
import { useCreateProfile } from '@/hooks/use-profiles';
import { X } from 'lucide-react';
import { useState } from 'react';

interface ProfileCreateDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProfileCreateDialog({ open, onClose }: ProfileCreateDialogProps) {
  const createMutation = useCreateProfile();
  
  const [formData, setFormData] = useState<ProfileCreateData>({
    name: '',
    description: '',
    // Conversion defaults
    conversionTableRows: 35,
    conversionTableCols: 20,
    pdfOcrMode: 'auto',
    pdfOcrLanguages: 'en',
    pdfNumThreads: 4,
    pdfTableStructure: false,
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    try {
      await createMutation.mutateAsync(formData);
      onClose();
      // Reset form
      setFormData(prev => ({ ...prev, name: '', description: '' }));
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create New Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="My Custom Profile"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Conversion Section */}
          <SettingsSection title="Conversion">
            <NumberInput label="Table Rows" value={formData.conversionTableRows!} onChange={(v) => setFormData({ ...formData, conversionTableRows: v })} />
            <NumberInput label="Table Cols" value={formData.conversionTableCols!} onChange={(v) => setFormData({ ...formData, conversionTableCols: v })} />
            <SelectInput label="OCR Mode" value={formData.pdfOcrMode!} onChange={(v) => setFormData({ ...formData, pdfOcrMode: v })} options={['auto', 'force', 'off']} />
            <TextInput label="OCR Languages" value={formData.pdfOcrLanguages!} onChange={(v) => setFormData({ ...formData, pdfOcrLanguages: v })} />
            <NumberInput label="Threads" value={formData.pdfNumThreads!} onChange={(v) => setFormData({ ...formData, pdfNumThreads: v })} />
            <CheckboxInput label="Table Structure" checked={formData.pdfTableStructure!} onChange={(v) => setFormData({ ...formData, pdfTableStructure: v })} />
          </SettingsSection>

          {/* Chunking Section */}
          <SettingsSection title="Chunking">
            <NumberInput label="Chunk Size" value={formData.documentChunkSize!} onChange={(v) => setFormData({ ...formData, documentChunkSize: v })} />
            <NumberInput label="Overlap" value={formData.documentChunkOverlap!} onChange={(v) => setFormData({ ...formData, documentChunkOverlap: v })} />
            <NumberInput label="Header Levels" value={formData.documentHeaderLevels!} onChange={(v) => setFormData({ ...formData, documentHeaderLevels: v })} min={1} max={6} />
            <NumberInput label="Presentation Min" value={formData.presentationMinChunk!} onChange={(v) => setFormData({ ...formData, presentationMinChunk: v })} />
            <NumberInput label="Tabular Rows" value={formData.tabularRowsPerChunk!} onChange={(v) => setFormData({ ...formData, tabularRowsPerChunk: v })} />
          </SettingsSection>

          {/* Quality Section */}
          <SettingsSection title="Quality">
            <NumberInput label="Min Chars" value={formData.qualityMinChars!} onChange={(v) => setFormData({ ...formData, qualityMinChars: v })} />
            <NumberInput label="Max Chars" value={formData.qualityMaxChars!} onChange={(v) => setFormData({ ...formData, qualityMaxChars: v })} />
            <NumberInput label="Penalty per Flag" value={formData.qualityPenaltyPerFlag!} onChange={(v) => setFormData({ ...formData, qualityPenaltyPerFlag: v })} step={0.05} />
            <CheckboxInput label="Auto-Fix Enabled" checked={formData.autoFixEnabled!} onChange={(v) => setFormData({ ...formData, autoFixEnabled: v })} />
            <NumberInput label="Max Passes" value={formData.autoFixMaxPasses!} onChange={(v) => setFormData({ ...formData, autoFixMaxPasses: v })} min={1} max={5} />
          </SettingsSection>

          {/* Embedding (display only) */}
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
            <div className="flex items-center gap-2 mb-2 font-medium">
              🔒 Embedding (locked)
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>Model: <span className="text-gray-700">BAAI/bge-small-en-v1.5</span></div>
              <div>Dimension: <span className="text-gray-700">384</span></div>
              <div>Max Tokens: <span className="text-gray-700">512</span></div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !formData.name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Profile'}
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
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
        {children}
      </div>
    </div>
  );
}

function NumberInput({ 
  label, 
  value, 
  onChange, 
  min, 
  max, 
  step = 1 
}: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void; 
  min?: number; 
  max?: number; 
  step?: number 
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
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
  onChange 
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void 
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
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
  options 
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  options: string[] 
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary-500"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function CheckboxInput({ 
  label, 
  checked, 
  onChange 
}: { 
  label: string; 
  checked: boolean; 
  onChange: (v: boolean) => void 
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
      />
      <label className="text-xs text-gray-600">{label}</label>
    </div>
  );
}
