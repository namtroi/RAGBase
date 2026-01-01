/**
 * Sync Frequency Select Component
 * 
 * Dropdown with preset sync intervals, replacing raw cron input.
 */

interface SyncFrequencySelectProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const FREQUENCY_OPTIONS = [
    { label: 'Every 15 minutes', value: '*/15 * * * *' },
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Every 12 hours', value: '0 */12 * * *' },
    { label: 'Daily', value: '0 0 * * *' },
    { label: 'Manual only', value: '' },
];

export function SyncFrequencySelect({ value, onChange, disabled }: SyncFrequencySelectProps) {
    return (
        <div>
            <label htmlFor="syncFrequency" className="block text-sm font-medium text-gray-700 mb-1">
                Sync Frequency
            </label>
            <select
                id="syncFrequency"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white"
            >
                {FREQUENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
                How often to check for new or updated files
            </p>
        </div>
    );
}
