
import { DocumentList } from '@/components/documents/document-list';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { DriveSyncTab } from '@/components/drive/DriveSyncTab';
import { SearchForm } from '@/components/query/search-form';
import { AnalyticsPage } from '@/components/analytics/AnalyticsPage';
import { ChunksExplorerPage } from '@/components/chunks/ChunksExplorerPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FileText, FolderSync, Search, Settings, BarChart3, Layers } from 'lucide-react';
import { useState } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10000,
    },
  },
});

type Tab = 'documents' | 'query' | 'analytics' | 'chunks' | 'settings' | 'drive';

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('documents');

  const tabs = [
    { id: 'drive' as Tab, label: 'Drive Sync', icon: FolderSync },
    { id: 'documents' as Tab, label: 'Documents', icon: FileText },
    { id: 'chunks' as Tab, label: 'Chunks', icon: Layers },
    { id: 'query' as Tab, label: 'Search', icon: Search },
    { id: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header + Navigation (combined) */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center">
            {/* Logo */}
            <h1 className="text-lg font-bold text-gray-900 pr-6 py-3 border-r border-gray-200 mr-2">
              📊 RAGBase
            </h1>

            {/* Main Navigation */}
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Settings (right side) */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>


          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Documents
              </h2>
              <p className="text-sm text-gray-500">Manage and upload your documents</p>
            </div>

            <section>
              <UploadDropzone />
            </section>

            <section>
              <DocumentList />
            </section>
          </div>
        )}

        {activeTab === 'query' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-400" />
                Search
              </h2>
              <p className="text-sm text-gray-500">Semantic search across your documents</p>
            </div>
            <SearchForm />
          </div>
        )}

        {activeTab === 'analytics' && (
          <AnalyticsPage />
        )}

        {activeTab === 'chunks' && (
          <ChunksExplorerPage />
        )}

        {activeTab === 'drive' && (
          <DriveSyncTab />
        )}

        {activeTab === 'settings' && (
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Settings
            </h2>
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
              <Settings className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                No settings configured yet.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                More options coming in Phase 5.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { EventProvider } from '@/providers/EventProvider';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EventProvider>
        <AppContent />
      </EventProvider>
    </QueryClientProvider>
  );
}
