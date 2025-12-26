import { getApiKey, setApiKey } from '@/api/client';
import { DocumentList } from '@/components/documents/document-list';
import { UploadDropzone } from '@/components/documents/upload-dropzone';
import { DriveSyncTab } from '@/components/drive/DriveSyncTab';
import { SearchForm } from '@/components/query/search-form';
import { AnalyticsPage } from '@/components/analytics/AnalyticsPage';
import { ChunksExplorerPage } from '@/components/chunks/ChunksExplorerPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FileText, FolderSync, Key, Search, Settings, BarChart3, Layers } from 'lucide-react';
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
  const [apiKey, setApiKeyState] = useState(getApiKey());

  const handleApiKeyChange = (key: string) => {
    setApiKeyState(key);
    setApiKey(key);
  };

  const tabs = [
    { id: 'documents' as Tab, label: 'Documents', icon: FileText },
    { id: 'query' as Tab, label: 'Search', icon: Search },
    { id: 'analytics' as Tab, label: 'Analytics', icon: BarChart3 },
    { id: 'chunks' as Tab, label: 'Chunks', icon: Layers },
    { id: 'drive' as Tab, label: 'Drive Sync', icon: FolderSync },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">RAGBase</h1>
            <div className="flex items-center gap-2">
              {!apiKey && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <Key className="w-4 h-4" />
                  API key required
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'documents' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Upload Document
              </h2>
              <UploadDropzone />
            </section>

            <section>
              <DocumentList />
            </section>
          </div>
        )}

        {activeTab === 'query' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Vector Search
            </h2>
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
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Enter your API key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                Your API key is stored locally in your browser.
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
