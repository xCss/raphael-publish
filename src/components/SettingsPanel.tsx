import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleHelp, Loader2, X, XCircle } from "lucide-react";
import type { AiModelAvailabilityResult } from "../lib/aiRewrite";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  persistPastedImages: boolean;
  onPersistPastedImagesChange: (enabled: boolean) => void;
  keepImageReferencesOnDisable: boolean;
  onKeepImageReferencesOnDisableChange: (enabled: boolean) => void;
  scrollSyncEnabled: boolean;
  onScrollSyncEnabledChange: (enabled: boolean) => void;
  relayAiRequests: boolean;
  onRelayAiRequestsChange: (enabled: boolean) => void;
  aiWriting: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  onAiWritingChange: (next: {
    baseUrl: string;
    apiKey: string;
    model: string;
  }) => void;
  aiModelAvailability: AiModelAvailabilityResult;
  aiModelChecking: boolean;
}

const sections = [
  {
    title: "Drafts & Images",
    description: "控制本地草稿、粘贴图片持久化和存储清理。",
  },
  {
    title: "AI Writing",
    description: "配置 BASE_URL、API_KEY 和 MODEL 后启用改写能力。",
  },
];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

export default function SettingsPanel({
  open,
  onClose,
  persistPastedImages,
  onPersistPastedImagesChange,
  keepImageReferencesOnDisable,
  onKeepImageReferencesOnDisableChange,
  scrollSyncEnabled,
  onScrollSyncEnabledChange,
  relayAiRequests,
  onRelayAiRequestsChange,
  aiWriting,
  onAiWritingChange,
  aiModelAvailability,
  aiModelChecking,
}: SettingsPanelProps) {
  const isDesktopDrawer = useMediaQuery("(min-width: 640px)");
  const panelInitial = isDesktopDrawer
    ? { opacity: 0, x: 36 }
    : { opacity: 0, y: 28 };
  const panelAnimate = isDesktopDrawer
    ? { opacity: 1, x: 0 }
    : { opacity: 1, y: 0 };
  const panelExit = isDesktopDrawer
    ? { opacity: 0, x: 36 }
    : { opacity: 0, y: 28 };
  const aiModelStatus = !aiWriting.baseUrl.trim() || !aiWriting.apiKey.trim() || !aiWriting.model.trim()
    ? 'empty'
    : aiModelChecking
      ? 'checking'
      : aiModelAvailability.ok
        ? 'available'
        : 'unavailable';
  const aiModelStatusTitle = aiModelStatus === 'checking' ? '正在检测模型是否可用...' : aiModelAvailability.message;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[140]"
          aria-modal="true"
          role="dialog"
          aria-labelledby="settings-title"
        >
          <motion.button
            type="button"
            data-testid="settings-backdrop"
            aria-label="关闭设置"
            className="absolute inset-0 bg-black/20 dark:bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            data-testid="settings-panel"
            data-variant={isDesktopDrawer ? "desktop-drawer" : "mobile-sheet"}
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border border-black/10 bg-white/95 shadow-[0_-18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#1c1c1e]/95 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[420px] sm:rounded-l-[28px] sm:rounded-r-none sm:shadow-[-18px_0_60px_rgba(0,0,0,0.18)]"
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelExit}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div
              className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-black/15 dark:bg-white/20 sm:hidden"
              aria-hidden="true"
            />

            <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-5 dark:border-white/10 sm:px-6">
              <div>
                <h2
                  id="settings-title"
                  className="mt-1 text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]"
                >
                  设置
                </h2>
                <p className="mt-1 text-sm text-[#86868b] dark:text-[#a1a1a6]">
                  管理本地图片缓存和 AI 能力。
                </p>
              </div>
              <button
                type="button"
                data-testid="settings-close"
                aria-label="关闭设置"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 sm:px-6">
              <section className="rounded-2xl border border-black/10 bg-[#f5f5f7]/80 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/80 p-4 shadow-sm dark:bg-[#2c2c2e]/80">
                  <label htmlFor="scroll-sync-toggle" className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      滚动同步
                    </span>
                    <span className="mt-1 block text-[12px] leading-5 text-[#86868b] dark:text-[#a1a1a6]">
                      编辑器与预览区会保持相近阅读位置，默认开启。
                    </span>
                  </label>
                  <button
                    type="button"
                    id="scroll-sync-toggle"
                    data-testid="settings-scroll-sync-toggle"
                    role="switch"
                    aria-checked={scrollSyncEnabled}
                    aria-label="滚动同步"
                    onClick={() => onScrollSyncEnabledChange(!scrollSyncEnabled)}
                    className={`relative h-6 w-14 shrink-0 overflow-hidden rounded-full transition-colors ${scrollSyncEnabled ? 'bg-[#0066cc] dark:bg-[#0a84ff]' : 'bg-black/15 dark:bg-white/20'}`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-4 w-6 rounded-full bg-white shadow-sm transition-transform ${scrollSyncEnabled ? 'translate-x-6' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </section>

              {sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-2xl border border-black/10 bg-[#f5f5f7]/80 p-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {section.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-5 text-[#6e6e73] dark:text-[#a1a1a6]">
                        {section.description}
                      </p>
                    </div>
                  </div>
                  {section.title === "Drafts & Images" && (
                    <div className="mt-4 rounded-2xl bg-white/80 p-4 shadow-sm dark:bg-[#2c2c2e]/80">
                      <div className="flex items-center justify-between gap-4">
                        <label
                          htmlFor="persist-pasted-images-toggle"
                          className="min-w-0 flex-1"
                        >
                          <span className="block text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            使用本地DB缓存图片
                          </span>
                          {/*<span className="mt-1 block text-[12px] leading-5 text-[#86868b] dark:text-[#a1a1a6]">
                            开启后，新粘贴图片将使用本地IndexedDB存储。
                          </span>*/}
                        </label>
                        <button
                          type="button"
                          id="persist-pasted-images-toggle"
                          data-testid="persist-pasted-images-toggle"
                          role="switch"
                          aria-checked={persistPastedImages}
                          aria-label="本地保存粘贴图片"
                          onClick={() =>
                            onPersistPastedImagesChange(!persistPastedImages)
                          }
                          className={`relative h-6 w-14 shrink-0 overflow-hidden rounded-full transition-colors ${persistPastedImages ? "bg-[#0066cc] dark:bg-[#0a84ff]" : "bg-black/15 dark:bg-white/20"}`}
                        >
                          <span
                            className={`absolute left-1 top-1 h-4 w-6 rounded-full bg-white shadow-sm transition-transform ${persistPastedImages ? "translate-x-6" : "translate-x-0"}`}
                          />
                          </button>
                      </div>
                      <div className="flex items-center justify-between gap-4 mt-4">
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                            关闭时，保留 `raphael-image://` 引用
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid="keep-image-references-toggle"
                          role="switch"
                          aria-checked={keepImageReferencesOnDisable}
                          aria-label="关闭缓存时保留 Markdown 图片引用"
                          onClick={() => onKeepImageReferencesOnDisableChange(!keepImageReferencesOnDisable)}
                          className={`relative h-6 w-14 shrink-0 overflow-hidden rounded-full transition-colors ${keepImageReferencesOnDisable ? 'bg-[#0066cc] dark:bg-[#0a84ff]' : 'bg-black/15 dark:bg-white/20'}`}
                        >
                          <span
                            className={`absolute left-1 top-1 h-4 w-6 rounded-full bg-white shadow-sm transition-transform ${keepImageReferencesOnDisable ? 'translate-x-6' : 'translate-x-0'}`}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                  {section.title === "AI Writing" && (
                    <div className="mt-4 space-y-3 rounded-2xl bg-white/80 p-4 shadow-sm dark:bg-[#2c2c2e]/80">
                      <p
                        data-testid="ai-config-warning"
                        className="text-[12px] leading-5 text-[#86868b] dark:text-[#a1a1a6]"
                      >
                        API Key 仅保存在浏览器本地存储中。
                      </p>
                      <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-white/70 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="text-sm font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                            使用
                            <a
                              href="https://github.com/xCss/relayx"
                              target="_blank"
                              rel="noreferrer"
                              className="mx-1 text-[#0066cc] underline-offset-2 hover:underline dark:text-[#0a84ff]"
                              onClick={(event) => event.stopPropagation()}
                            >
                              RELAYX
                            </a>
                            转发AI请求
                          </span>
                        </div>
                        <button
                          type="button"
                          data-testid="relay-ai-requests-toggle"
                          role="switch"
                          aria-checked={relayAiRequests}
                          aria-label="转发 AI 请求"
                          onClick={() => onRelayAiRequestsChange(!relayAiRequests)}
                          className={`relative h-6 w-14 shrink-0 overflow-hidden rounded-full transition-colors ${relayAiRequests ? 'bg-[#0066cc] dark:bg-[#0a84ff]' : 'bg-black/15 dark:bg-white/20'}`}
                        >
                          <span
                            className={`absolute left-1 top-1 h-4 w-6 rounded-full bg-white shadow-sm transition-transform ${relayAiRequests ? 'translate-x-6' : 'translate-x-0'}`}
                          />
                        </button>
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          BASE_URL
                        </span>
                        <input
                          data-testid="ai-base-url-input"
                          value={aiWriting.baseUrl}
                          onChange={(event) =>
                            onAiWritingChange({
                              ...aiWriting,
                              baseUrl: event.currentTarget.value,
                            })
                          }
                          placeholder="https://api.example.com/v1"
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] dark:border-white/10 dark:bg-[#1c1c1e] dark:text-[#f5f5f7]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          API_KEY
                        </span>
                        <input
                          data-testid="ai-api-key-input"
                          type="password"
                          value={aiWriting.apiKey}
                          onChange={(event) =>
                            onAiWritingChange({
                              ...aiWriting,
                              apiKey: event.currentTarget.value,
                            })
                          }
                          placeholder="local-browser-key"
                          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] dark:border-white/10 dark:bg-[#1c1c1e] dark:text-[#f5f5f7]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                          MODEL
                        </span>
                        <div className="relative">
                          <input
                            data-testid="ai-model-input"
                            value={aiWriting.model}
                            onChange={(event) =>
                              onAiWritingChange({
                                ...aiWriting,
                                model: event.currentTarget.value,
                              })
                            }
                            placeholder="gpt-4o-mini"
                            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 pr-11 text-sm text-[#1d1d1f] outline-none transition focus:border-[#0066cc] dark:border-white/10 dark:bg-[#1c1c1e] dark:text-[#f5f5f7]"
                          />
                          <span
                            data-testid="ai-model-status"
                            data-status={aiModelStatus}
                            title={aiModelStatusTitle}
                            aria-label={aiModelStatusTitle}
                            className="absolute right-4 top-1/2 inline-flex -translate-y-1/2 text-[#86868b] dark:text-[#a1a1a6]"
                          >
                            {aiModelStatus === 'checking' && <Loader2 size={16} className="animate-spin" />}
                            {aiModelStatus === 'available' && <CheckCircle2 size={16} className="text-[#1f883d]" />}
                            {aiModelStatus === 'unavailable' && <XCircle size={16} className="text-[#d1242f]" />}
                            {aiModelStatus === 'empty' && <CircleHelp size={16} />}
                          </span>
                        </div>
                      </label>
                      <button
                        type="button"
                        data-testid="ai-config-clear"
                        onClick={() =>
                          onAiWritingChange({
                            baseUrl: "",
                            apiKey: "",
                            model: "",
                          })
                        }
                        className="h-10 rounded-full px-4 text-sm font-semibold text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/10 dark:hover:text-white"
                      >
                        清除配置
                      </button>
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-black/10 bg-white/90 px-5 py-4 dark:border-white/10 dark:bg-[#1c1c1e]/90 sm:px-6">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-full px-4 text-sm font-semibold text-[#86868b] transition-colors hover:bg-black/5 hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:bg-white/10 dark:hover:text-white"
              >
                取消
              </button>
              <button
                type="button"
                data-testid="settings-save"
                onClick={onClose}
                className="h-11 rounded-full bg-[#0066cc] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0052a3] dark:bg-[#0a84ff] dark:hover:bg-[#0070d9]"
              >
                完成
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
