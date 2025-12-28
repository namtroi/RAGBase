import { ProcessingProfile } from '@/api/endpoints';
import { useActivateProfile, useArchiveProfile } from '@/hooks/use-profiles';
import { Copy, Archive, Check, Lock, Trash2, HelpCircle } from 'lucide-react';
import { useState } from 'react';

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
            label="Max Rows/Table"
            value={profile.conversionTableRows}
            tooltip="What: Max rows to preserve from spreadsheets. Why: Large tables overflow LLM context. How: Reduce for very long tables."
          />
          <SettingItem
            label="Max Cols/Table"
            value={profile.conversionTableCols}
            tooltip="What: Max columns to preserve. Why: Wide tables break formatting. How: Reduce for tables with many columns."
          />
          <SettingItem
            label="PDF OCR Mode"
            value={profile.pdfOcrMode}
            tooltip="What: Text extraction method. Why: Scanned PDFs need OCR. How: auto (detect), force (always OCR), never (text only)."
          />
          <SettingItem
            label="OCR Languages"
            value={profile.pdfOcrLanguages}
            tooltip="What: Language codes for OCR. Why: Accuracy depends on language model. How: Use ISO codes like 'en', 'vi', 'ja'."
          />
          <SettingItem
            label="PDF Threads"
            value={profile.pdfNumThreads}
            tooltip="What: Parallel processing threads. Why: More threads = faster but uses more CPU. How: Match your CPU cores."
          />
          <SettingItem
            label="Detect Tables"
            value={profile.pdfTableStructure ? 'On' : 'Off'}
            tooltip="What: Identify table structures in PDFs. Why: Better Markdown formatting. How: Enable for docs with tables."
          />
          <SettingItem
            label="Max File Size"
            value={`${profile.maxFileSizeMb} MB`}
            tooltip="What: Maximum upload size. Why: Prevents memory issues. How: Increase for large files."
          />
        </SettingsSection>

        {/* Chunking */}
        <SettingsSection
          title="Chunking"
          description="Split content into searchable chunks"
        >
          <SettingItem
            label="Chunk Size (chars)"
            value={profile.documentChunkSize}
            tooltip="What: Target characters per chunk. Why: Affects search precision. How: Smaller = precise, larger = more context. 500-2000 typical."
          />
          <SettingItem
            label="Overlap (chars)"
            value={profile.documentChunkOverlap}
            tooltip="What: Shared characters between chunks. Why: Prevents cutting sentences. How: 10-20% of chunk size recommended."
          />
          <SettingItem
            label="Split at Headers"
            value={`H1-H${profile.documentHeaderLevels}`}
            tooltip="What: Which header levels create chunk boundaries. Why: Preserves document structure. How: H1-H3 for most docs."
          />
          <SettingItem
            label="Min Slide Size"
            value={profile.presentationMinChunk}
            tooltip="What: Minimum content for PPTX slides. Why: Avoid tiny chunks from sparse slides. How: 100-300 chars typical."
          />
          <SettingItem
            label="Rows per Chunk"
            value={profile.tabularRowsPerChunk}
            tooltip="What: Spreadsheet rows per chunk. Why: Group related data together. How: 10-30 rows typical."
          />
        </SettingsSection>

        {/* Quality */}
        <SettingsSection
          title="Quality Analysis"
          description="Score and improve chunk quality"
        >
          <SettingItem
            label="Min Chunk Chars"
            value={profile.qualityMinChars}
            tooltip="What: Minimum allowed chunk size. Why: Filter out noise/fragments. How: 30-100 chars, lower for dense content."
          />
          <SettingItem
            label="Max Chunk Chars"
            value={profile.qualityMaxChars}
            tooltip="What: Maximum allowed chunk size. Why: Prevent context overflow. How: 1500-3000 chars based on LLM."
          />
          <SettingItem
            label="Penalty/Flag"
            value={profile.qualityPenaltyPerFlag}
            tooltip="What: Score deduction per quality issue. Why: Controls quality strictness. How: 0.1-0.2 typical, higher = stricter."
          />
          <SettingItem
            label="Auto-Fix"
            value={profile.autoFixEnabled ? 'Enabled' : 'Disabled'}
            tooltip="What: Automatically improve low-quality chunks. Why: Better retrieval results. How: Enable for most cases."
          />
          <SettingItem
            label="Fix Passes"
            value={profile.autoFixMaxPasses}
            tooltip="What: Max auto-fix retry attempts. Why: Diminishing returns after 2-3. How: 1-3 passes recommended."
          />
        </SettingsSection>

        {/* Embedding (locked) */}
        <SettingsSection
          title="Embedding"
          description="Vector generation (fixed in code)"
          locked
        >
          <SettingItem
            label="Model"
            value={profile.embeddingModel}
            locked
            tooltip="What: Vector embedding model. Why: Determines search quality. How: Fixed in code, contact admin to change."
          />
          <SettingItem
            label="Dimensions"
            value={profile.embeddingDimension}
            locked
            tooltip="What: Vector size (dimensions). Why: Higher = more precise but slower. How: Model-dependent, typically 384-1536."
          />
          <SettingItem
            label="Max Tokens"
            value={profile.embeddingMaxTokens}
            locked
            tooltip="What: Max tokens per embedding. Why: Chunks longer than this are truncated. How: Model limit, typically 512."
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
