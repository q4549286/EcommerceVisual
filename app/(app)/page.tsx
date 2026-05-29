"use client";

import Image from "next/image";
import { ChangeEvent, DragEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useUserSession } from "@/components/UserSession";
import { buildImagePlans, imageTypeOptions } from "@/lib/plans";
import type { GenerateResponse, GenerationMode, HistoryEntry, ImagePlan, ImageTypeKey, Language, ListingIntent, PlatformKey, ProductAnalysis, ProductInput } from "@/lib/types";

const HISTORY_KEY = "ecv:history";
const HISTORY_LIMIT = 10;

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

const initialTypes = imageTypeOptions.filter((item) => item.defaultSelected).map((item) => item.key);
const inputClass = "w-full rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none placeholder:text-white/[0.28] focus:border-white/30 focus:bg-white/10";

function splitLines(value: string) {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export default function WorkspacePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user, refresh, setUser } = useUserSession();
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
  const [brand, setBrand] = useState("");
  const [material, setMaterial] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [audience, setAudience] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [avoid, setAvoid] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<ImageTypeKey[]>(initialTypes);
  const [plans, setPlans] = useState<ImagePlan[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);
  const [lightboxPlan, setLightboxPlan] = useState<ImagePlan | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxPlan(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  function buildInput(imageTypes = selectedTypes): ProductInput {
    const normalizedProductName = generationMode === "text_to_image" ? "文生图" : productName.trim();
    return {
      productName: normalizedProductName,
      generationMode,
      platform,
      listingIntent,
      category,
      description,
      language,
      brand,
      material,
      size,
      color,
      audience,
      sellingPoints: splitLines(sellingPoints),
      avoid: splitLines(avoid),
      imageTypes
    };
  }

  function validate(imageTypes = selectedTypes) {
    if (!user) return "请先进入 API 管理模式。";
    if (generationMode === "image_to_image" && !productImage) return "请先上传商品图。";
    if (generationMode === "image_to_image" && !productName.trim()) return "请填写商品名称。";
    if (generationMode === "text_to_image" && !description.trim()) return "请写一句想生成的商品图描述。";
    if (imageTypes.length === 0) return "请至少选择一种图片类型。";
    if (user.credits < imageTypes.length) return `额度不足，本次需要 ${imageTypes.length} 点。`;
    return "";
  }

  function persistHistory(entry: HistoryEntry) {
    const list = loadJSON<HistoryEntry[]>(HISTORY_KEY, []);
    let next = [entry, ...list].slice(0, HISTORY_LIMIT);
    while (next.length > 0) {
      try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return;
      } catch {
        next = next.slice(0, -1);
      }
    }
  }

  function startProgress(nextSteps: string[]) {
    setSteps(nextSteps);
    setStepIndex(0);
    setProgress(0);
    const startedAt = Date.now();
    const estimated = Math.max(20_000, nextSteps.length * 32_000);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(elapsed / estimated, 0.95);
      const next = Math.floor(ratio * 95);
      setProgress(next);
      setStepIndex(Math.min(Math.floor((next / 95) * nextSteps.length), nextSteps.length - 1));
    }, 400);
  }

  function finishProgress() {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = null;
    setProgress(100);
    setStepIndex((current) => Math.max(current, steps.length - 1));
  }

  async function runGeneration(imageTypes: ImageTypeKey[], mode: "new" | "replace" = "new") {
    const validationError = validate(imageTypes);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setIsLoading(true);
    setShowProgressModal(true);
    if (mode === "new") setPlans([]);

    const input = buildInput(imageTypes);
    const draftPlans = buildImagePlans(input);
    startProgress(["连接生图接口", ...draftPlans.map((p) => `生成 ${p.title}`)]);

    const formData = new FormData();
    if (generationMode === "image_to_image" && productImage) {
      formData.append("productImage", productImage);
      for (const referenceImage of referenceImages) {
        formData.append("referenceImages", referenceImage);
      }
    }
    formData.append("input", JSON.stringify(input));
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
        signal: abortRef.current.signal
      });
      const data: GenerateResponse = await response.json();
      if (!data.ok && (!data.plans || data.plans.length === 0)) throw new Error(data.error || "生成失败。");

      if (typeof data.credits === "number" && user) setUser({ ...user, credits: data.credits });
      else refresh();

      const resultPlans = data.plans || draftPlans;
      if (mode === "replace") {
        setPlans((current) => {
          const replacements = new Map(resultPlans.map((plan) => [plan.type, plan]));
          const merged = current.map((plan) => replacements.get(plan.type) || plan);
          for (const plan of resultPlans) if (!merged.some((item) => item.type === plan.type)) merged.push(plan);
          return merged;
        });
      } else {
        setPlans(resultPlans);
      }

      const successCount = resultPlans.filter((p) => p.imageUrl).length;
      const failCount = resultPlans.length - successCount;
      persistHistory({
        id: data.generationId || newId(),
        timestamp: Date.now(),
        productName: mode === "replace" ? `${input.productName || "未命名"}（重新生成）` : input.productName,
        language,
        imageCount: resultPlans.length,
        successCount,
        failCount,
        plans: resultPlans
      });
      finishProgress();
      show(failCount === 0 ? `已完成 ${successCount} 张图片` : `完成 ${successCount} 张，失败 ${failCount} 张`, failCount === 0 ? "success" : "danger");
    } catch (err) {
      if ((err as Error).name === "AbortError") show("已取消生成", "info");
      else {
        const message = err instanceof Error ? err.message : "生成失败。";
        setError(message);
        show(message, "danger");
      }
    } finally {
      setIsLoading(false);
      setQueueCount((current) => Math.max(0, current - 1));
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
  }

  function resetWorkspaceForNextImage() {
    setProductImage(null);
    setPreviewUrl("");
    setReferenceImages([]);
    setReferencePreviewUrls([]);
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

  function sendCurrentJobToBackground() {
    setQueueCount((current) => current + 1);
    setIsLoading(false);
    setShowProgressModal(false);
    resetWorkspaceForNextImage();
    show("已转入后台队列，可以继续上传下一张图片", "info");
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
      show("已自动填写下列信息", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "商品识别失败。";
      setError(message);
      show(message, "danger");
    } finally {
      setIsAnalyzing(false);
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-4 sm:px-6 md:pl-24 lg:pt-6">
      <section className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
        <Image src="/brand/ecommerce-mascot.png" alt="" width={56} height={56} className="h-12 w-12 rounded-2xl object-cover" priority />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-white">电商专用</h1>
          <p className="mt-1 text-sm text-white/[0.45]">手机货架、详情页、外卖上架和商品素材工作台</p>
        </div>
        {queueCount > 0 ? <div className="ml-auto inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs text-white/70">后台队列 {queueCount} 个任务运行中</div> : null}
      </section>

      <section className="mx-auto mt-5 max-w-4xl rounded-[30px] border border-white/[0.12] bg-black/[0.52] p-3 shadow-2xl shadow-black/[0.45] backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[
            { label: "电商套图", value: "image_to_image" as GenerationMode },
            { label: "文生图", value: "text_to_image" as GenerationMode }
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => switchGenerationMode(item.value)}
              className={`rounded-full px-5 py-2 text-sm transition ${generationMode === item.value ? "bg-white text-black" : "border border-white/10 bg-white/[0.08] text-white/[0.62] hover:bg-white/[0.12]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={generationMode === "image_to_image" ? onDrop : undefined}
          className={`grid min-h-[230px] grid-cols-1 gap-4 rounded-[24px] border border-white/[0.08] bg-[#080808]/90 p-4 ${generationMode === "image_to_image" ? "sm:grid-cols-[260px_minmax(0,1fr)]" : ""}`}
        >
          {generationMode === "image_to_image" ? (
          <div className="grid grid-cols-2 gap-4 border-white/10 sm:border-r sm:pr-4">
            <div className="col-span-2 px-1 text-xs font-medium text-white/[0.48]">素材输入</div>
            <button
              type="button"
              onClick={openFileDialog}
              className="flex h-full min-h-32 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/[0.08] text-white/85 transition hover:bg-white/[0.12]"
              aria-label="上传产品图"
            >
              {previewUrl ? <img src={previewUrl} alt="产品图" className="h-full max-h-40 w-full rounded-3xl object-cover" /> : <><span className="text-4xl font-light">+</span><span className="mt-2 text-sm">上传产品图</span></>}
            </button>
            <div className="relative h-full min-h-32">
              <button
                type="button"
                onClick={openReferenceDialog}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onReferenceDrop}
                className="flex h-full w-full min-h-32 flex-col items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/[0.08] text-white/85 transition hover:bg-white/[0.12]"
                aria-label="上传参考图"
              >
                {referencePreviewUrls.length > 0 ? (
                  <div className="grid h-full max-h-40 w-full grid-cols-2 gap-1 p-2">
                    {referencePreviewUrls.slice(0, 4).map((url, index) => <img key={`${url}-${index}`} src={url} alt={`参考图 ${index + 1}`} className="h-full min-h-14 rounded-xl object-cover" />)}
                  </div>
                ) : <><span className="text-4xl font-light">+</span><span className="mt-2 text-sm">上传参考图</span></>}
              </button>
              <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-white/[0.38]">（可选）</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} className="hidden" />
            <input ref={referenceInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onReferenceChange} className="hidden" />
          </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-3">
            <div className="px-1 text-xs font-medium text-white/[0.48]">{generationMode === "image_to_image" ? "补充要求" : "画面描述"}</div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={generationMode === "image_to_image" ? "输入产品卖点、规格、使用场景，再在下方选择本次要输出的手机端电商图" : "直接描述要生成的电商图片：例如 便携榨汁杯手机主图，白底棚拍，商品占比大，适合淘宝货架"}
              className="min-h-[110px] flex-1 resize-none border-0 bg-transparent p-1 text-base leading-7 text-white outline-none placeholder:text-white/[0.32]"
            />
            <div className="flex flex-wrap items-center gap-2">
              {generationMode === "image_to_image" ? (
                <>
                  <select value={platform} onChange={(event) => setPlatform(event.target.value as PlatformKey)} className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white outline-none">
                    {platformOptions.map((item) => <option key={item.value} value={item.value} className="bg-[#111]">{item.label}</option>)}
                  </select>
                  <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white outline-none">
                    {languageOptions.map((item) => <option key={item.value} value={item.value} className="bg-[#111]">{item.label}</option>)}
                  </select>
                  {referenceImages.length > 0 ? <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white/55">参考图 {referenceImages.length} 张</span> : null}
                  <button type="button" onClick={analyzeProduct} disabled={isAnalyzing || isLoading || !productImage} className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white/70 disabled:opacity-40">
                    {isAnalyzing ? "填写中" : "自动填写下列信息"}
                  </button>
                </>
              ) : null}
              <button type="button" onClick={() => runGeneration(selectedTypes)} disabled={isLoading || isAnalyzing} className="ml-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl text-black shadow-lg transition hover:scale-105 disabled:opacity-50">
                ↑
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="mt-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
      </section>

      <section className="mx-auto mt-5 max-w-4xl rounded-[24px] border border-white/[0.08] bg-white/5 p-4 backdrop-blur">
        {generationMode === "image_to_image" ? (
          <>
            <div className="mb-4 text-xs font-medium text-white/[0.48]">商品资料</div>
            <div className="grid gap-3 md:grid-cols-3">
              <FieldBlock label="产品名">
                <input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="例：可携式果汁机" className={inputClass} />
              </FieldBlock>
              <FieldBlock label="运营场景">
                <select value={listingIntent} onChange={(event) => setListingIntent(event.target.value as ListingIntent)} className={inputClass}>
                  {listingIntentOptions.map((item) => <option key={item.value} value={item.value} className="bg-[#111]">{item.label}</option>)}
                </select>
              </FieldBlock>
              <FieldBlock label="类目">
                <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="例：餐饮/零售/服饰" className={inputClass} />
              </FieldBlock>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                <FieldBlock label="品牌"><input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} /></FieldBlock>
                <FieldBlock label="材质"><input value={material} onChange={(e) => setMaterial(e.target.value)} className={inputClass} /></FieldBlock>
                <FieldBlock label="尺寸参数"><input value={size} onChange={(e) => setSize(e.target.value)} className={inputClass} /></FieldBlock>
                <FieldBlock label="颜色"><input value={color} onChange={(e) => setColor(e.target.value)} className={inputClass} /></FieldBlock>
                <FieldBlock label="适用人群"><input value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass} /></FieldBlock>
                <FieldBlock label="避免词"><input value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="假价格、二维码、水印" className={inputClass} /></FieldBlock>
              </div>
              <div className="space-y-3">
                <FieldBlock label="核心卖点">
                  <textarea value={sellingPoints} onChange={(e) => setSellingPoints(e.target.value)} rows={4} placeholder="每行一个卖点" className={`${inputClass} resize-none`} />
                </FieldBlock>
                <div>
                  <div className="mb-2 text-xs font-medium text-white/[0.55]">本次输出清单</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {imageTypeOptions.map((item) => {
                      const active = selectedTypes.includes(item.key);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleType(item.key)}
                          className={`rounded-2xl border px-3 py-3 text-left text-xs transition ${active ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.06] text-white/60 hover:bg-white/10"}`}
                        >
                          <span className="block font-medium">{item.shortTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div>
            <div>
              <div className="mb-2 text-xs font-medium text-white/[0.55]">本次输出清单</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {imageTypeOptions.map((item) => {
                  const active = selectedTypes.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleType(item.key)}
                      className={`rounded-2xl border px-3 py-3 text-left text-xs transition ${active ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.06] text-white/60 hover:bg-white/10"}`}
                    >
                      <span className="block font-medium">{item.shortTitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {plans.length > 0 ? (
        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">生成结果</h2>
            <span className="text-sm text-white/[0.45]">{plans.filter((p) => p.imageUrl).length} / {plans.length} 成功</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.type} className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.06]">
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
                    <button onClick={() => runGeneration([plan.type], "replace")} disabled={isLoading} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/[0.65] hover:bg-white/10">重做</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {isLoading && showProgressModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur">
          <div className="w-[430px] max-w-full rounded-[28px] border border-white/10 bg-[#101010] p-6 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold">正在生成图片</h3>
              <span className="text-sm text-white/[0.45]">{progress}%</span>
            </div>
            <p className="mb-4 text-sm text-white/[0.45]">{steps[stepIndex] || "处理中..."}</p>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={sendCurrentJobToBackground} className="rounded-full bg-white px-4 py-2 text-sm text-black">转入后台队列</button>
              <button onClick={() => abortRef.current?.abort()} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/[0.65]">取消</button>
            </div>
          </div>
        </div>
      ) : null}

      {lightboxPlan?.imageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6" onClick={() => setLightboxPlan(null)}>
          <button type="button" onClick={() => setLightboxPlan(null)} className="absolute right-5 top-5 z-10 rounded-full bg-white px-4 py-2 text-sm text-black">关闭</button>
          <img src={lightboxPlan.imageUrl} alt={lightboxPlan.title} className="max-h-full max-w-full rounded-2xl object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  );
}
