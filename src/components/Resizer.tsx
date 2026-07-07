import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizerProps {
    onResize: (deltaX: number) => void;
    onResizeEnd?: () => void;
}

export default function Resizer({ onResize, onResizeEnd }: ResizerProps) {
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef<number>(0);
    const accumulatedDeltaRef = useRef<number>(0);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            const deltaX = e.clientX - startXRef.current;
            const incrementalDelta = deltaX - accumulatedDeltaRef.current;
            accumulatedDeltaRef.current = deltaX;
            onResize(incrementalDelta);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            accumulatedDeltaRef.current = 0;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            onResizeEnd?.();
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, onResize, onResizeEnd]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        startXRef.current = e.clientX;
        accumulatedDeltaRef.current = 0;
        setIsDragging(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const handleDoubleClick = () => {
        onResize(0);
        onResizeEnd?.();
    };

    return (
        <div
            className={`hidden md:flex relative w-[8px] cursor-col-resize group transition-colors ${isDragging ? 'bg-[#0066cc]/10 dark:bg-[#0a84ff]/10' : 'hover:bg-[#0066cc]/5 dark:hover:bg-[#0a84ff]/5'}`}
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
            data-testid="resizer"
        >
            {/* Visual divider line */}
            <div className={`absolute left-1/2 top-0 bottom-0 w-[1px] -translate-x-1/2 bg-[#00000015] dark:bg-[#ffffff15] transition-colors ${isDragging ? 'bg-[#0066cc] dark:bg-[#0a84ff]' : 'group-hover:bg-[#0066cc]/30 dark:group-hover:bg-[#0a84ff]/30'}`} />

            {/* Grip handle */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-16 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-[#0066cc]/10 dark:bg-[#0a84ff]/15 pointer-events-none ${isDragging ? 'opacity-100' : ''}`}>
                <GripVertical size={16} className="text-[#0066cc] dark:text-[#0a84ff]" />
            </div>
        </div>
    );
}
