import { ProcessingProfile } from '@/api/endpoints';
import { useActivateProfile, useArchiveProfile } from '@/hooks/use-profiles';
import { Copy, Archive, Check, Lock, Trash2, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { CONVERSION_FIELDS, CHUNKING_FIELDS, QUALITY_FIELDS, EMBEDDING_FIELDS } from './profile-field-config';

interface ProfileCardProps {
  profile: ProcessingProfile;
  onDelete?: (profile: ProcessingProfile) => void;
  onDuplicate?: (profile: ProcessingProfile) => void;
}

export function ProfileCard({ profile, onDelete, onDuplicate }: ProfileCardProps) {
  const activateMutation = useActivateProfile();
  const archiveMutation = useArchiveProfile();

  const handleActivate = () => {
    activateMutation.mutate(profile.id);
  };

  const handleArchive = () => {
    archiveMutation.mutate(profile.id);
  };

  const handleDuplicate = () => {
    onDuplicate?.(profile);
  };

  return (
    <div className={`bg-white rounded-lg border ${profile.isActive ? 'border-primary-300 ring-2 ring-primary-100' : 'border-gray-200'} overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">{profile.name}</h3>
          {profile.isDefault && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Default</span>
          )}
          {profile.isActive && (
            <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded flex items-center gap-1">
              <Check className="w-3 h-3" /> Active
            </span>
          )}
          {profile.isArchived && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">Archived</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!profile.isActive && !profile.isArchived && (
            <button
              onClick={handleActivate}
              disabled={activateMutation.isPending}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
              title="Set as Active"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleDuplicate}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          {!profile.isDefault && !profile.isActive && !profile.isArchived && (
            <button
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
              title="Archive"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
          {profile.isArchived && onDelete && (
            <button
              onClick={() => onDelete(profile)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <div className="px-4 py-2 border-b border-gray-100">
          <p className="text-sm text-gray-500">{profile.description}</p>
        </div>
      )}

      {/* Settings Grid */}
      <div className="p-3 space-y-2">
        {/* Conversion */}
        <SettingsSection
          title="Conversion"
          description="Convert documents to Markdown format"
        >
          <SettingItem
            label={CONVERSION_FIELDS.pdfConverter.label}
            value={profile.pdfConverter === 'docling' ? 'Docling (High Quality)' : 'PyMuPDF4LLM (Fast)'}
            tooltip={CONVERSION_FIELDS.pdfConverter.tooltip}
          />
          {profile.pdfConverter === 'docling' && (
            <>
              <SettingItem
                label={CONVERSION_FIELDS.pdfOcrMode.label}
                value={profile.pdfOcrMode}
                tooltip={CONVERSION_FIELDS.pdfOcrMode.tooltip}
              />
              <SettingItem
                label={CONVERSION_FIELDS.pdfOcrLanguages.label}
                value={profile.pdfOcrLanguages}
                tooltip={CONVERSION_FIELDS.pdfOcrLanguages.tooltip}
              />
            </>
          )}
          <SettingItem
            label={CONVERSION_FIELDS.conversionTableRows.label}
            value={profile.conversionTableRows}
            tooltip={CONVERSION_FIELDS.conversionTableRows.tooltip}
          />
          <SettingItem
            label={CONVERSION_FIELDS.conversionTableCols.label}
            value={profile.conversionTableCols}
            tooltip={CONVERSION_FIELDS.conversionTableCols.tooltip}
          />
          <SettingItem
            label={CONVERSION_FIELDS.maxFileSizeMb.label}
            value={`${profile.maxFileSizeMb} MB`}
            tooltip={CONVERSION_FIELDS.maxFileSizeMb.tooltip}
          />
        </SettingsSection>

        {/* Chunking */}
        <SettingsSection
          title="Chunking"
          description="Split content into searchable chunks"
        >
          <SettingItem
            label={CHUNKING_FIELDS.documentChunkSize.label}
            value={profile.documentChunkSize}
            tooltip={CHUNKING_FIELDS.documentChunkSize.tooltip}
          />
          <SettingItem
            label={CHUNKING_FIELDS.documentChunkOverlap.label}
            value={profile.documentChunkOverlap}
            tooltip={CHUNKING_FIELDS.documentChunkOverlap.tooltip}
          />
          <SettingItem
            label={CHUNKING_FIELDS.documentHeaderLevels.label}
            value={`H1-H${profile.documentHeaderLevels}`}
            tooltip={CHUNKING_FIELDS.documentHeaderLevels.tooltip}
          />
          <SettingItem
            label={CHUNKING_FIELDS.presentationMinChunk.label}
            value={profile.presentationMinChunk}
            tooltip={CHUNKING_FIELDS.presentationMinChunk.tooltip}
          />
          <SettingItem
            label={CHUNKING_FIELDS.tabularRowsPerChunk.label}
            value={profile.tabularRowsPerChunk}
            tooltip={CHUNKING_FIELDS.tabularRowsPerChunk.tooltip}
          />
        </SettingsSection>

        {/* Quality */}
        <SettingsSection
          title="Quality Analysis"
          description="Score and improve chunk quality"
        >
          <SettingItem
            label={QUALITY_FIELDS.qualityMinChars.label}
            value={profile.qualityMinChars}
            tooltip={QUALITY_FIELDS.qualityMinChars.tooltip}
          />
          <SettingItem
            label={QUALITY_FIELDS.qualityMaxChars.label}
            value={profile.qualityMaxChars}
            tooltip={QUALITY_FIELDS.qualityMaxChars.tooltip}
          />
          <SettingItem
            label={QUALITY_FIELDS.qualityPenaltyPerFlag.label}
            value={profile.qualityPenaltyPerFlag}
            tooltip={QUALITY_FIELDS.qualityPenaltyPerFlag.tooltip}
          />
          <SettingItem
            label={QUALITY_FIELDS.autoFixEnabled.label}
            value={profile.autoFixEnabled ? 'Enabled' : 'Disabled'}
            tooltip={QUALITY_FIELDS.autoFixEnabled.tooltip}
          />
          <SettingItem
            label={QUALITY_FIELDS.autoFixMaxPasses.label}
            value={profile.autoFixMaxPasses}
            tooltip={QUALITY_FIELDS.autoFixMaxPasses.tooltip}
          />
        </SettingsSection>

        {/* Embedding (locked) */}
        <SettingsSection
          title="Embedding"
          description="Vector generation (fixed in code)"
          locked
        >
          <SettingItem
            label={EMBEDDING_FIELDS.embeddingModel.label}
            value={profile.embeddingModel}
            locked
            tooltip={EMBEDDING_FIELDS.embeddingModel.tooltip}
          />
          <SettingItem
            label={EMBEDDING_FIELDS.embeddingDimension.label}
            value={profile.embeddingDimension}
            locked
            tooltip={EMBEDDING_FIELDS.embeddingDimension.tooltip}
          />
          <SettingItem
            label={EMBEDDING_FIELDS.embeddingMaxTokens.label}
            value={profile.embeddingMaxTokens}
            locked
            tooltip={EMBEDDING_FIELDS.embeddingMaxTokens.tooltip}
          />
        </SettingsSection>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
        <span>📄 {profile.documentCount ?? 0} documents</span>
        <span>Created {new Date(profile.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
  locked = false
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  locked?: boolean
}) {
  return (
    <div className="border border-gray-100 rounded-lg">
      <div className={`px-3 py-1.5 ${locked ? 'bg-gray-100' : 'bg-gray-50'}`}>
        <div className={`text-sm font-medium flex items-center gap-1 ${locked ? 'text-gray-500' : 'text-gray-700'}`}>
          {locked && <Lock className="w-3 h-3" />}
          {title}
        </div>
        {description && (
          <div className="text-xs text-gray-400">{description}</div>
        )}
      </div>
      <div className="px-3 py-1.5 grid grid-cols-3 gap-x-4 gap-y-0.5">
        {children}
      </div>
    </div>
  );
}

// Helper to format tooltip text
function formatTooltip(text: string) {
  // Split by keywords but keep them
  const parts = text.match(/(What:|Why:|How:)([^W]*?)(?=(What:|Why:|How:|$))/g) || [text];
  return parts.map((part, i) => {
    const [label, ...content] = part.split(':');
    return (
      <div key={i} className="mb-1 last:mb-0">
        <span className="text-gray-400 font-semibold">{label}:</span>
        <span>{content.join(':')}</span>
      </div>
    );
  });
}

function SettingItem({
  label,
  value,
  tooltip,
  locked = false
}: {
  label: string;
  value: string | number | boolean;
  tooltip?: string;
  locked?: boolean
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setShowTooltip(true);
  };

  return (
    <div className={`${locked ? 'text-gray-400' : ''} flex items-start gap-1 text-sm`}>
      <span className="text-gray-500 shrink-0">{label}:</span>{' '}
      <span className="font-medium break-all">{String(value)}</span>
      {tooltip && (
        <button
          className="text-gray-300 hover:text-primary-500 transition-colors mt-px"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
        >
          <HelpCircle className="w-3 h-3" />
        </button>
      )}

      {/* Tooltip */}
      {tooltip && showTooltip && (
        <div
          className="fixed z-9999 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl pointer-events-none text-left"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y + 12,
          }}
        >
          {formatTooltip(tooltip)}
        </div>
      )}
    </div>
  );
}
