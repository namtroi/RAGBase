/**
 * Google Drive Picker Hook
 * 
 * Loads Google Picker API and handles folder selection.
 * Requires GOOGLE_PICKER_API_KEY in environment.
 */

import { oauthApi } from '@/api/oauth';
import { useCallback, useEffect, useRef, useState } from 'react';

// Types for Google Picker API (Google Picker API doesn't have proper TypeScript types)
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
    interface Window {
        gapi: {
            load: (api: string, callback: () => void) => void;
        };
        google: {
            picker: {
                PickerBuilder: new () => any;
                DocsView: new (viewId: any) => any;
                ViewId: { FOLDERS: string };
                Action: { PICKED: string; CANCEL: string };
            };
        };
    }
}

export interface PickerResult {
    folderId: string;
    folderName: string;
}

interface UseDrivePickerReturn {
    openPicker: () => Promise<PickerResult | null>;
    isLoading: boolean;
    error: string | null;
}

const PICKER_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;

export function useDrivePicker(): UseDrivePickerReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const pickerApiLoadedRef = useRef(false);
    const resolveRef = useRef<((result: PickerResult | null) => void) | null>(null);

    // Load Google API script
    useEffect(() => {
        if (window.gapi) {
            pickerApiLoadedRef.current = true;
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => {
            window.gapi.load('picker', () => {
                pickerApiLoadedRef.current = true;
            });
        };
        document.body.appendChild(script);

        return () => {
            // Cleanup if needed
        };
    }, []);

    const openPicker = useCallback(async (): Promise<PickerResult | null> => {
        setError(null);
        setIsLoading(true);

        try {
            // Check if Picker API is loaded
            if (!window.gapi || !window.google?.picker) {
                // Try loading picker
                if (window.gapi) {
                    await new Promise<void>((resolve) => {
                        window.gapi.load('picker', resolve);
                    });
                } else {
                    throw new Error('Google API not loaded');
                }
            }

            // Get access token from backend
            const { accessToken } = await oauthApi.getAccessToken();

            return new Promise((resolve) => {
                resolveRef.current = resolve;

                const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
                    .setIncludeFolders(true)
                    .setSelectFolderEnabled(true)
                    .setMimeTypes('application/vnd.google-apps.folder');

                const picker = new window.google.picker.PickerBuilder()
                    .addView(view)
                    .setOAuthToken(accessToken)
                    .setDeveloperKey(PICKER_API_KEY)
                    .setCallback((data: { action: string; docs: Array<{ id: string; name: string }> }) => {
                        if (data.action === window.google.picker.Action.PICKED) {
                            const folder = data.docs[0];
                            resolveRef.current?.({
                                folderId: folder.id,
                                folderName: folder.name,
                            });
                            resolveRef.current = null;
                        } else if (data.action === window.google.picker.Action.CANCEL) {
                            resolveRef.current?.(null);
                            resolveRef.current = null;
                        }
                    })
                    .setTitle('Select a folder to sync')
                    .build();

                picker.setVisible(true);
            });
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to open picker');
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return { openPicker, isLoading, error };
}
