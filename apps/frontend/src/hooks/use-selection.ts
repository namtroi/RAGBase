import { useCallback, useState } from 'react';

export interface UseSelectionReturn {
    selected: Set<string>;
    toggle: (id: string) => void;
    selectAll: (ids: string[]) => void;
    selectNone: () => void;
    isSelected: (id: string) => boolean;
    count: number;
}

export function useSelection(): UseSelectionReturn {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const toggle = useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const selectAll = useCallback((ids: string[]) => {
        setSelected(new Set(ids));
    }, []);

    const selectNone = useCallback(() => {
        setSelected(new Set());
    }, []);

    const isSelected = useCallback(
        (id: string) => selected.has(id),
        [selected]
    );

    return {
        selected,
        toggle,
        selectAll,
        selectNone,
        isSelected,
        count: selected.size,
    };
}
