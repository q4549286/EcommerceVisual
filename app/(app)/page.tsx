"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, ReactNode, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { useToast } from "@/components/ui/Toast";
import { Drawer } from "@/components/ui/Drawer";
import { useUserSession } from "@/components/UserSession";
import { imageTypeOptions } from "@/lib/plans";
import type { GenerationMode, HistoryEntry, ImagePlan, ImageTypeKey, Language, ListingIntent, PlatformKey, ProductAnalysis, ProductInput, QualityMode, TaskSummary } from "@/lib/types";

const HISTORY_KEY = "ecv:history";
const HISTORY_LIMIT = 10;
const OUTPUT_TYPES_KEY = "ecv:output-types";

const languageOptions: { value: Language; label: string }[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" }
];

const platformOptions: { value: PlatformKey; label: string }[] = [
  { value: "meituan_waimai", label: "美团外卖" },
  { value: "meituan_flash", label: "美团闪购" },
  { value: "taobao_tmall", label: "淘宝/天猫" },
  { value: "jd", label: "京东" },
  { value: "douyin", label: "抖音电商" },
  { value: "pdd", label: "拼多多" },
  { value: "rednote", label: "小红书店铺" },
  { value: "generic", label: "跨境电商" }
];

const listingIntentOptions: { value: ListingIntent; label: string }[] = [
  { value: "new_listing", label: "新品上架" },
  { value: "refresh_listing", label: "老品翻新" },
  { value: "delist_clearance", label: "下架清货" },
  { value: "sold_out_pause", label: "售罄/暂停销售" }
];

const qualityModeOptions: { value: QualityMode; label: string; hint: string }[] = [
  { value: "fast", label: "快速", hint: "长边 1024" },
  { value: "hd", label: "高清", hint: "长边 2048" }
];

const generationModeOptions: { value: GenerationMode; label: string; hint: string }[] = [
  { value: "image_to_image", label: "上传改图", hint: "保留商品，批量生成电商套图" },
  { value: "text_to_image", label: "文字生图", hint: "从描述生成商品视觉" }
];

const typeSizeHints: Record<ImageTypeKey, { ratio: string; size: string }> = {
  main_white_bg: { ratio: "1:1", size: "1024x1024" },
  platform_listing: { ratio: "1:1", size: "1024x1024" },
  campaign_poster: { ratio: "3:4", size: "1024x1365" },
  feature_infographic: { ratio: "3:4", size: "1024x1365" },
  detail_specs: { ratio: "4:5", size: "1024x1280" },
  package_label: { ratio: "4:5", size: "1024x1280" },
  virtual_try_on: { ratio: "3:4", size: "1024x1365" },
  handheld_product: { ratio: "3:4", size: "1024x1365" },
  lifestyle: { ratio: "1:1", size: "1024x1024" },
  delist_notice: { ratio: "3:4", size: "1024x1365" },
  text_square: { ratio: "1:1", size: "1024x1024" },
  text_portrait: { ratio: "3:4", size: "1024x1365" },
  text_tall: { ratio: "4:5", size: "1024x1280" }
};

const textRatioOptions: { value: string; label: string; size: string; imageType: ImageTypeKey }[] = [
  { value: "1:1", label: "1:1", size: "1024x1024", imageType: "text_square" },
  { value: "3:4", label: "3:4", size: "1024x1365", imageType: "text_portrait" },
  { value: "4:5", label: "4:5", size: "1024x1280", imageType: "text_tall" }
];

const initialTypes = imageTypeOptions.filter((item) => item.defaultSelected).map((item) => item.key);
const validTypeKeys = new Set(imageTypeOptions.map((item) => item.key));
const controlClass = "w-full rounded-lg border border-white/10 bg-white/[0.07] text-sm text-white outline-none placeholder:text-white/[0.26] focus:border-white/30 focus:bg-white/10";
const inputClass = `${controlClass} h-11 px-3.5`;
const selectClass = `${controlClass} h-11 px-3.5`;

function splitLines(value: string) {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-white/[0.55]">{label}</span>
      {children}
    </label>
  );
}

function taskToHistoryEntry(task: TaskSummary): HistoryEntry | null {
  if (!task.plans?.length) return null;
  const successCount = task.plans.filter((plan) => Boolean(plan.imageUrl)).length;
  const failCount = task.plans.filter((plan) => !plan.imageUrl).length;
  const finishedAt = task.finishedAt ? new Date(task.finishedAt).getTime() : Date.now();
  return {
    id: task.generationId || task.id,
    timestamp: Number.isFinite(finishedAt) ? finishedAt : Date.now(),
    productName: task.title || "未命名",
    language: "zh-CN",
    imageCount: task.totalSteps || task.plans.length,
    successCount,
    failCount,
    status: task.status === "SUCCEEDED" && failCount === 0 ? "success" : successCount > 0 ? "partial" : "failed",
    error: task.error || null,
    plans: task.plans
  };
}

export default function WorkspacePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const tasksPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taskStatusRef = useRef<Map<string, string>>(new Map());
  const { user } = useUserSession();
  const { show } = useToast();

  const [productImage, setProductImage] = useState<File | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("image_to_image");
  const [previewUrl, setPreviewUrl] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [referencePreviewUrls, setReferencePreviewUrls] = useState<string[]>([]);
  const [productName, setProductName] = useState("");
  const [platform, setPlatform] = useState<PlatformKey>("meituan_waimai");
  const [listingIntent, setListingIntent] = useState<ListingIntent>("new_listing");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<Language>("zh-CN");
  const [qualityMode, setQualityMode] = useState<QualityMode>("fast");
  const [textImageRatio, setTextImageRatio] = useState("1:1");
  const [brand, setBrand] = useState("");
  const [material, setMaterial] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [audience, setAudience] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [avoid, setAvoid] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<ImageTypeKey[]>(() => {
    const saved = loadJSON<ImageTypeKey[]>(OUTPUT_TYPES_KEY, initialTypes);
    const validSaved = saved.filter((item) => validTypeKeys.has(item));
    return validSaved.length > 0 ? validSaved : initialTypes;
  });
  const [plans, setPlans] = useState<ImagePlan[]>([]);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lightboxPlan, setLightboxPlan] = useState<ImagePlan | null>(null);
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxPlan(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setActiveTaskId(null);
      return;
    }

    void loadTasks();
    if (tasksPollRef.current) clearInterval(tasksPollRef.current);
    tasksPollRef.current = setInterval(() => {
      void loadTasks(true);
    }, 4000);

    return () => {
      if (tasksPollRef.current) clearInterval(tasksPollRef.current);
      tasksPollRef.current = null;
    };
  }, [user?.id, activeTaskId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(OUTPUT_TYPES_KEY, JSON.stringify(selectedTypes));
    } catch {
    }
  }, [selectedTypes]);

  useEffect(() => {
    if (!activeTaskId && tasks[0]) {
      setActiveTaskId(tasks[0].id);
    }
  }, [activeTaskId, tasks]);

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  function openReferenceDialog() {
    referenceInputRef.current?.click();
  }

  function handleFile(file?: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("仅支持 JPG、PNG、WEBP 格式。");
      return;
    }
    setProductImage(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
  }

  function handleReferenceFiles(files?: FileList | File[] | null) {
    const incoming = Array.from(files || []).filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (incoming.length === 0) return;
    const next = [...referenceImages, ...incoming].slice(0, 6);
    setReferenceImages(next);
    setReferencePreviewUrls(next.map((file) => URL.createObjectURL(file)));
    setError("");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function onReferenceChange(event: ChangeEvent<HTMLInputElement>) {
    handleReferenceFiles(event.target.files);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0] ?? null);
  }

  function onReferenceDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    handleReferenceFiles(event.dataTransfer.files);
  }

  function toggleType(type: ImageTypeKey) {
    setSelectedTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  function switchGenerationMode(mode: GenerationMode) {
    setGenerationMode(mode);
    setError("");
  }

  function imageTypesForCurrentMode() {
    if (generationMode === "text_to_image") {
      const ratio = textRatioOptions.find((item) => item.value === textImageRatio) || textRatioOptions[0];
      return [ratio.imageType];
    }
    return selectedTypes;
  }

  function buildInput(imageTypes = selectedTypes): ProductInput {
    const isTextToImage = generationMode === "text_to_image";
    const normalizedProductName = generationMode === "text_to_image" ? "文字生图" : productName.trim();
    return {
      productName: normalizedProductName,
      generationMode,
      platform: isTextToImage ? "generic" : platform,
      listingIntent: isTextToImage ? "new_listing" : listingIntent,
      category,
      description,
      language: isTextToImage ? "zh-CN" : language,
      brand,
      material,
      size,
      color,
      audience,
      sellingPoints: splitLines(sellingPoints),
      avoid: splitLines(avoid),
      imageTypes,
      qualityMode
    };
  }

  function validate(imageTypes = selectedTypes) {
    if (!user) return "请先进入 API 管理模式。";
    if (generationMode === "image_to_image" && !productImage) return "请先上传商品图。";
    if (generationMode === "image_to_image" && !productName.trim()) return "请填写商品名称。";
    if (generationMode === "text_to_image" && !description.trim()) return "请写一句想生成的商品图描述。";
    if (imageTypes.length === 0) return "请至少选择一种图片类型。";
    return "";
  }

  function persistHistory(entry: HistoryEntry) {
    const list = loadJSON<HistoryEntry[]>(HISTORY_KEY, []);
    let next = [entry, ...list.filter((item) => item.id !== entry.id)].slice(0, HISTORY_LIMIT);
    while (next.length > 0) {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return;
      } catch {
        next = next.slice(0, -1);
      }
    }
  }

  function resetWorkspaceForNextImage() {
    setProductImage(null);
    setPreviewUrl("");
    setReferenceImages([]);
    setReferencePreviewUrls([]);
    setPlans([]);
    setProductName("");
    setCategory("");
    setDescription("");
    setBrand("");
    setMaterial("");
    setSize("");
    setColor("");
    setAudience("");
    setSellingPoints("");
    setAvoid("");
    setError("");
  }

  async function loadTasks(showToast = false) {
    if (!user) return;
    try {
      const data = await apiFetch<{ items: TaskSummary[] }>("/api/tasks?limit=20", { cache: "no-store" });
      setTasks(data.items);
      if (activeTaskId && !data.items.some((task) => task.id === activeTaskId)) {
        setActiveTaskId(data.items[0]?.id || null);
      }
      if (showToast) {
        const previous = taskStatusRef.current;
        const next = new Map(data.items.map((task) => [task.id, task.status]));
        for (const task of data.items) {
          const last = previous.get(task.id);
          if ((last === "PENDING" || last === "RUNNING") && task.status === "SUCCEEDED") {
            const historyEntry = taskToHistoryEntry(task);
            if (historyEntry) persistHistory(historyEntry);
            show(`任务「${task.title}」已完成`, "success");
          }
          if ((last === "PENDING" || last === "RUNNING") && task.status === "FAILED") {
            const historyEntry = taskToHistoryEntry(task);
            if (historyEntry) persistHistory(historyEntry);
            show(`任务「${task.title}」失败了`, "danger");
          }
        }
        taskStatusRef.current = next;
      } else {
        taskStatusRef.current = new Map(data.items.map((task) => [task.id, task.status]));
      }
    } catch {
    }
  }

  async function submitTask(imageTypes: ImageTypeKey[]) {
    const validationError = validate(imageTypes);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setIsSubmitting(true);

    const input = buildInput(imageTypes);
    const formData = new FormData();
    if (generationMode === "image_to_image" && productImage) {
      formData.append("productImage", productImage);
      for (const referenceImage of referenceImages) {
        formData.append("referenceImages", referenceImage);
      }
    }
    formData.append("input", JSON.stringify(input));

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        body: formData
      });
      const data: { ok: boolean; taskId?: string; error?: string } = await response.json();
      if (!response.ok || !data.ok || !data.taskId) throw new Error(data.error || "创建任务失败。");
      resetWorkspaceForNextImage();
      setActiveTaskId(data.taskId);
      await loadTasks();
      show("任务已加入后台队列", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建任务失败。";
      setError(message);
      show(message, "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  function applyAnalysis(analysis: ProductAnalysis) {
    if (analysis.productName) setProductName(analysis.productName);
    if (analysis.category) setCategory(analysis.category);
    if (analysis.description) setDescription(analysis.description);
    if (analysis.brand) setBrand(analysis.brand);
    if (analysis.material) setMaterial(analysis.material);
    if (analysis.size) setSize(analysis.size);
    if (analysis.color) setColor(analysis.color);
    if (analysis.audience) setAudience(analysis.audience);
    if (analysis.sellingPoints.length > 0) setSellingPoints(analysis.sellingPoints.join("\n"));
    if (analysis.avoid.length > 0) setAvoid(analysis.avoid.join("\n"));
  }

  async function analyzeProduct() {
    if (!productImage) {
      setError("请先上传商品图。");
      return;
    }
    setError("");
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append("productImage", productImage);
    formData.append("language", language);
    formData.append("platform", platform);

    try {
      const response = await fetch("/api/analyze-product", { method: "POST", body: formData });
      const data: { ok: boolean; analysis?: ProductAnalysis; error?: string } = await response.json();
      if (!data.ok || !data.analysis) throw new Error(data.error || "商品识别失败。");
      applyAnalysis(data.analysis);
      show("已自动识别商品资料", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "商品识别失败。";
      setError(message);
      show(message, "danger");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function cancelTask(taskId: string) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      const data: { ok: boolean; error?: string } = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "终止任务失败。");
      show("任务已终止", "success");
      await loadTasks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "终止任务失败。";
      show(message, "danger");
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      show("已复制到剪贴板", "success");
    } catch {
      show("复制失败", "danger");
    }
  }

  const activeTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) || null : null;
  const runningCount = tasks.filter((task) => ["PENDING", "RUNNING"].includes(task.status)).length;
  const activeModeOption = generationModeOptions.find((item) => item.value === generationMode) || generationModeOptions[0];
  const currentImageTypes = imageTypesForCurrentMode();

  useEffect(() => {
    if (activeTask?.plans?.length) {
      setPlans(activeTask.plans);
    }
  }, [activeTaskId, activeTask?.plans]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-4 sm:px-6 md:pl-24 lg:pt-6">
      <button
        type="button"
        onClick={() => setTaskDrawerOpen(true)}
        className="fixed bottom-5 right-4 z-40 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#111]/90 px-3 py-2 text-xs text-white/80 shadow-xl shadow-black/30 backdrop-blur hover:bg-[#181818] sm:bottom-6 sm:right-6"
      >
        <span>后台队列</span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-white px-1.5 text-[11px] font-semibold text-black">{runningCount}</span>
      </button>

      <section className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/brand/ecommerce-mascot.png" alt="" width={52} height={52} className="h-11 w-11 rounded-lg object-cover" priority />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-white">AI 商品图工作台</h1>
            <p className="mt-1 text-sm text-white/[0.5]">上传改图、文字生图、手机端电商套图统一生成</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right text-xs text-white/[0.48]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-white">队列</div>
            <div>{runningCount} 个</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="text-white">输出</div>
            <div>{currentImageTypes.length} 张</div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 max-w-5xl rounded-lg border border-white/[0.12] bg-[#0b0b0b]/95 p-3 shadow-2xl shadow-black/[0.35]">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          {generationModeOptions.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => switchGenerationMode(item.value)}
              className={`rounded-lg border px-4 py-3 text-left transition ${generationMode === item.value ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.05] text-white/[0.7] hover:bg-white/[0.09]"}`}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className={`mt-1 block text-xs ${generationMode === item.value ? "text-black/55" : "text-white/[0.38]"}`}>{item.hint}</span>
            </button>
          ))}
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={generationMode === "image_to_image" ? onDrop : undefined}
          className={`grid min-h-[240px] grid-cols-1 gap-4 rounded-lg border border-white/[0.08] bg-[#080808] p-4 ${generationMode === "image_to_image" ? "lg:grid-cols-[280px_minmax(0,1fr)]" : ""}`}
        >
          {generationMode === "image_to_image" ? (
          <div className="grid grid-cols-2 gap-3 border-white/10 lg:border-r lg:pr-4">
            <div className="col-span-2 flex items-center justify-between px-1">
              <span className="text-xs font-medium text-white/[0.52]">素材输入</span>
              <span className="text-[11px] text-white/[0.32]">产品图必填，参考图可选</span>
            </div>
            <button
              type="button"
              onClick={openFileDialog}
              className="flex h-full min-h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/[0.07] text-white/85 transition hover:bg-white/[0.12]"
              aria-label="上传产品图"
            >
              {previewUrl ? <img src={previewUrl} alt="产品图" className="h-full max-h-44 w-full rounded-lg object-cover" /> : <><span className="text-3xl font-light">+</span><span className="mt-2 text-sm">产品图</span></>}
            </button>
            <div className="relative h-full min-h-32">
              <button
                type="button"
                onClick={openReferenceDialog}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onReferenceDrop}
                className="flex h-full w-full min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-white/[0.07] text-white/85 transition hover:bg-white/[0.12]"
                aria-label="上传参考图"
              >
                {referencePreviewUrls.length > 0 ? (
                  <div className="grid h-full max-h-40 w-full grid-cols-2 gap-1 p-2">
                    {referencePreviewUrls.slice(0, 4).map((url, index) => <img key={`${url}-${index}`} src={url} alt={`参考图 ${index + 1}`} className="h-full min-h-14 rounded-md object-cover" />)}
                  </div>
                ) : <><span className="text-3xl font-light">+</span><span className="mt-2 text-sm">参考图</span></>}
              </button>
              <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-white/[0.38]">（可选）</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="hidden" />
            <input ref={referenceInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onReferenceChange} className="hidden" />
          </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-xs font-medium text-white/[0.52]">{generationMode === "image_to_image" ? "补充要求" : "画面描述"}</span>
              <span className="text-[11px] text-white/[0.34]">{activeModeOption.label}</span>
            </div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={generationMode === "image_to_image" ? "输入产品卖点、规格、使用场景；也可以先上传产品图后点自动识别。" : "例：便携榨汁杯手机主图，白底棚拍，商品占比大，适合淘宝货架，干净高转化。"}
              className="min-h-[110px] flex-1 resize-none border-0 bg-transparent p-1 text-base leading-7 text-white outline-none placeholder:text-white/[0.32]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-white/10 bg-white/[0.07] p-1">
                {qualityModeOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setQualityMode(item.value)}
                    className={`rounded-md px-3 py-1.5 text-xs transition ${qualityMode === item.value ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                  >
                    {item.label}
                    <span className={qualityMode === item.value ? "ml-1 text-black/55" : "ml-1 text-white/35"}>{item.hint}</span>
                  </button>
                ))}
              </div>
              {generationMode === "image_to_image" ? (
                <>
                  <select value={platform} onChange={(event) => setPlatform(event.target.value as PlatformKey)} className="rounded-lg border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white outline-none">
                    {platformOptions.map((item) => <option key={item.value} value={item.value} className="bg-[#111]">{item.label}</option>)}
                  </select>
                  <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="rounded-lg border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white outline-none">
                    {languageOptions.map((item) => <option key={item.value} value={item.value} className="bg-[#111]">{item.label}</option>)}
                  </select>
                  {referenceImages.length > 0 ? <span className="rounded-lg border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white/55">参考图 {referenceImages.length} 张</span> : null}
                  <button type="button" onClick={analyzeProduct} disabled={isAnalyzing || isSubmitting || !productImage} className="whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.12] disabled:opacity-40">
                    {isAnalyzing ? "识别中" : "自动识别"}
                  </button>
                </>
              ) : (
                <div className="flex rounded-lg border border-white/10 bg-white/[0.07] p-1">
                  {textRatioOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setTextImageRatio(item.value)}
                      className={`rounded-md px-3 py-1.5 text-xs transition ${textImageRatio === item.value ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                    >
                      {item.label}
                      <span className={textImageRatio === item.value ? "ml-1 text-black/55" : "ml-1 text-white/35"}>{item.size}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => void submitTask(currentImageTypes)} disabled={isAnalyzing || isSubmitting} className="ml-auto flex h-11 min-w-11 items-center justify-center rounded-lg bg-white px-4 text-xl text-black shadow-lg transition hover:scale-[1.02] disabled:opacity-50" aria-label="提交生成">
                ↑
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="mt-3 rounded-lg border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
      </section>

      {generationMode === "image_to_image" ? (
        <section className="mx-auto mt-4 max-w-5xl rounded-lg border border-white/[0.08] bg-white/[0.045] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs font-medium text-white/[0.5]">商品资料</div>
            <div className="text-[11px] text-white/[0.32]">用于自动组织提示词，不会生成在画面里</div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <FieldBlock label="产品名">
              <input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="例：可携式果汁机" className={inputClass} />
            </FieldBlock>
            <FieldBlock label="运营场景">
              <select value={listingIntent} onChange={(event) => setListingIntent(event.target.value as ListingIntent)} className={selectClass}>
                {listingIntentOptions.map((item) => <option key={item.value} value={item.value} className="bg-[#111]">{item.label}</option>)}
              </select>
            </FieldBlock>
            <FieldBlock label="类目">
              <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="例：餐饮/零售/服饰" className={inputClass} />
            </FieldBlock>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)]">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldBlock label="品牌"><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="可选" className={inputClass} /></FieldBlock>
              <FieldBlock label="材质"><input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="可选" className={inputClass} /></FieldBlock>
              <FieldBlock label="尺寸参数"><input value={size} onChange={(e) => setSize(e.target.value)} placeholder="可选" className={inputClass} /></FieldBlock>
              <FieldBlock label="颜色"><input value={color} onChange={(e) => setColor(e.target.value)} placeholder="可选" className={inputClass} /></FieldBlock>
              <FieldBlock label="适用人群"><input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="可选" className={inputClass} /></FieldBlock>
              <FieldBlock label="避免词"><input value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="假价格、二维码、水印" className={inputClass} /></FieldBlock>
            </div>
            <FieldBlock label="核心卖点">
              <textarea value={sellingPoints} onChange={(e) => setSellingPoints(e.target.value)} rows={5} placeholder="每行一个卖点" className={`${inputClass} min-h-[148px] resize-none leading-6`} />
            </FieldBlock>
          </div>
        </section>
      ) : null}

      {generationMode === "image_to_image" ? (
        <section className="mx-auto mt-4 max-w-5xl rounded-lg border border-white/[0.08] bg-white/[0.045] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-white/[0.55]">本次输出</div>
              <div className="mt-1 text-[11px] text-white/[0.34]">按所选图片类型生成套图。</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/[0.55]">{selectedTypes.length} / {imageTypeOptions.length} 张</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {imageTypeOptions.map((item) => {
              const active = selectedTypes.includes(item.key);
              const hint = typeSizeHints[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleType(item.key)}
                  className={`flex min-h-[72px] flex-col justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${active ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.035] text-white/55 hover:bg-white/10 hover:text-white/75"}`}
                >
                  <span className="font-medium">{item.shortTitle}</span>
                  <span className={active ? "text-black/50" : "text-white/[0.32]"}>{hint.ratio} · {hint.size}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {plans.length > 0 ? (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">生成结果</h2>
            <span className="text-sm text-white/[0.45]">{plans.filter((p) => p.imageUrl).length} / {plans.length} 成功</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.type} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.06]">
                <div className="aspect-[4/5] bg-white/5">
                  {plan.imageUrl ? (
                    <img src={plan.imageUrl} alt={plan.title} onClick={() => setLightboxPlan(plan)} className="h-full w-full cursor-zoom-in object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/[0.45]">{plan.error || "未生成"}</div>
                  )}
                </div>
                <div className="p-4">
                  <div className="font-medium">{plan.title}</div>
                  <div className="mt-1 text-xs text-white/[0.35]">{plan.size}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => copyText(plan.prompt)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/[0.65] hover:bg-white/10">复制提示词</button>
                    {plan.imageUrl ? <a href={plan.imageUrl} download={`${plan.type}.png`} className="rounded-full bg-white px-3 py-1.5 text-xs text-black">下载</a> : null}
                    <button onClick={() => void submitTask([plan.type])} disabled={isAnalyzing || isSubmitting} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/[0.65] hover:bg-white/10">重做</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {lightboxPlan?.imageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6" onClick={() => setLightboxPlan(null)}>
          <button type="button" onClick={() => setLightboxPlan(null)} className="absolute right-5 top-5 z-10 rounded-lg bg-white px-4 py-2 text-sm text-black">关闭</button>
          <img src={lightboxPlan.imageUrl} alt={lightboxPlan.title} className="max-h-full max-w-full rounded-lg object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}

      <Drawer
        open={taskDrawerOpen}
        onClose={() => setTaskDrawerOpen(false)}
        title="任务队列"
        description="提交后会在这里持续刷新，刷新页面也能继续看状态。"
        width={760}
        closeLabel="收起"
      >
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">还没有任务。</div>
          ) : (
            tasks.map((task) => {
              const active = task.id === activeTaskId;
              const taskPlansList = task.plans || [];
              return (
                <div
                  key={task.id}
                  onClick={() => setActiveTaskId(task.id)}
                  className={`w-full rounded-lg border p-4 text-left transition ${active ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{task.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{task.status} · {task.progress}% · {task.message || "等待中"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500">{task.totalSteps} 张</div>
                      {["PENDING", "RUNNING"].includes(task.status) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void cancelTask(task.id);
                          }}
                          className="rounded-full border border-red-200 px-2.5 py-1 text-[11px] text-red-600 hover:bg-red-50"
                        >
                          终止
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-slate-900" style={{ width: `${task.progress}%` }} />
                  </div>
                  {taskPlansList.length > 0 ? (
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {taskPlansList.slice(0, 5).map((plan) => (
                        <div key={`${task.id}-${plan.type}`} className="aspect-square overflow-hidden rounded-xl bg-slate-100">
                          {plan.imageUrl ? <img src={plan.imageUrl} alt={plan.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-2 text-[11px] text-slate-400">{plan.error || "未出图"}</div>}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </Drawer>
    </div>
  );
}
