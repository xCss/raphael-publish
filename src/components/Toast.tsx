import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, RefreshCw, WifiOff, X } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error' | 'offline' | 'refresh';

interface ToastProps {
    message: string;
    variant?: ToastVariant;
    action?: ReactNode;
    onDismiss: () => void;
    dismissLabel?: string;
    testId?: string;
}

const iconByVariant = {
    info: Info,
    success: CheckCircle2,
    warning: AlertCircle,
    error: AlertCircle,
    offline: WifiOff,
    refresh: RefreshCw
};

const iconClassByVariant: Record<ToastVariant, string> = {
    info: 'bg-[#0066cc]/12 text-[#0066cc] dark:bg-[#0a84ff]/12 dark:text-[#0a84ff]',
    success: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300',
    warning: 'bg-[#f5a000]/12 text-[#9a6400] dark:bg-[#ffd98a]/12 dark:text-[#ffd98a]',
    error: 'bg-red-500/12 text-red-600 dark:bg-red-400/12 dark:text-red-300',
    offline: 'bg-[#f5a000]/12 text-[#9a6400] dark:bg-[#ffd98a]/12 dark:text-[#ffd98a]',
    refresh: 'bg-[#f5a000]/12 text-[#9a6400] dark:bg-[#ffd98a]/12 dark:text-[#ffd98a]'
};

export default function Toast({ message, variant = 'info', action, onDismiss, dismissLabel = '关闭提示', testId }: ToastProps) {
    const Icon = iconByVariant[variant];

    return (
        <div className="pointer-events-none fixed right-4 top-[76px] z-[120] flex max-w-[calc(100vw-2rem)] justify-end sm:right-6" aria-live="polite">
            <div className="pointer-events-auto flex max-w-[360px] items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/92 px-4 py-3 text-[13px] font-medium text-[#1d1d1f] shadow-[0_12px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1c1c1e]/92 dark:text-[#f5f5f7]" role="status" data-testid={testId}>
                <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconClassByVariant[variant]}`}>
                        <Icon size={15} />
                    </span>
                    <span className="truncate">{message}</span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {action}
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="rounded-full p-1.5 text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/10 dark:hover:text-white"
                        aria-label={dismissLabel}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
