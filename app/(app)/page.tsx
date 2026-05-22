"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Buttons";
import { Field, Select, TextArea, TextInput } from "@/components/ui/FormField";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useUserSession } from "@/components/UserSession";
import { buildImagePlans, imageTypeOptions } from "@/lib/plans";
import type { GenerateResponse, HistoryEntry, ImagePlan, ImageTypeKey, Language, ProductInput } from "@/lib/types";

const HISTORY_KEY = "ecv:history";
const HISTORY_LIMIT = 10;

const languageOptions: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "zh-CN", label: "简体中文" }
];

const initialTypes = imageTypeOptions.filter((item) => item.defaultSelected).map((item) => item.key);

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
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function WorkspacePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user, refresh, setUser } = useUserSession();
  const { show } = useToast();

  const [productImage, setProductImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<Language>("en");
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
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState<string[]>([]);

  const [lightboxPlan, setLightboxPlan] = useState<ImagePlan | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && lightboxPlan) setLightboxPlan(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxPlan]);

  function openFileDialog() {
    fileInputRef.current?.click();
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

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0] ?? null);
  }

  function toggleType(type: ImageTypeKey) {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  }

  function buildInput(imageTypes = selectedTypes): ProductInput {
    return {
      productName,
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
    if (!user) return "请先登录。";
    if (!productImage) return "请先上传商品图。";
    if (!productName.trim()) return "请填写商品名称。";
    if (imageTypes.length === 0) return "请至少选择一种图片类型。";
    if (user.credits < imageTypes.length) return `积分不足，本次需要 ${imageTypes.length} 积分，当前 ${user.credits} 积分。`;
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
      const totalSteps = nextSteps.length;
      const idx = Math.min(Math.floor((next / 95) * totalSteps), totalSteps - 1);
      setStepIndex(idx);
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
    if (mode === "new") {
      setPlans([]);
    }

    const input = buildInput(imageTypes);
    const draftPlans = buildImagePlans(input);
    const stepNames = ["连接生图接口", ...draftPlans.map((p) => `生成 ${p.title}`)];
    startProgress(stepNames);

    const formData = new FormData();
    formData.append("productImage", productImage as File);
    formData.append("input", JSON.stringify(input));

    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
        signal: abortRef.current.signal
      });
      const data: GenerateResponse = await response.json();

      if (!data.ok && (!data.plans || data.plans.length === 0)) {
        throw new Error(data.error || "生成失败。");
      }

      if (typeof data.credits === "number" && user) {
        setUser({ ...user, credits: data.credits });
      } else {
        refresh();
      }

      const resultPlans = data.plans || draftPlans;
      if (mode === "replace") {
        setPlans((current) => {
          const replacements = new Map(resultPlans.map((plan) => [plan.type, plan]));
          const merged = current.map((plan) => replacements.get(plan.type) || plan);
          for (const plan of resultPlans) {
            if (!merged.some((item) => item.type === plan.type)) merged.push(plan);
          }
          return merged;
        });
      } else {
        setPlans(resultPlans);
      }

      const successCount = resultPlans.filter((p) => p.imageUrl).length;
      const failCount = resultPlans.length - successCount;
      const entry: HistoryEntry = {
        id: data.generationId || newId(),
        timestamp: Date.now(),
        productName: mode === "replace" ? `${productName || "未命名"}（重新生成）` : productName,
        language,
        imageCount: resultPlans.length,
        successCount,
        failCount,
        plans: resultPlans
      };
      persistHistory(entry);
      finishProgress();
      show(failCount === 0 ? `已完成 ${successCount} 张图片` : `完成 ${successCount} 张，失败 ${failCount} 张`, failCount === 0 ? "success" : "danger");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        show("已取消生成", "info");
      } else {
        setError(err instanceof Error ? err.message : "生成失败。");
        show(err instanceof Error ? err.message : "生成失败", "danger");
      }
    } finally {
      setIsLoading(false);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
  }

  async function generate() {
    await runGeneration(selectedTypes, "new");
  }

  async function regeneratePlan(plan: ImagePlan) {
    await runGeneration([plan.type], "replace");
  }

  function cancelGenerate() {
    abortRef.current?.abort();
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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">工作台</h1>
          <p className="mt-1 text-sm text-slate-500">上传商品图，自动生成主图、亮点图、细节图、场景图。</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
            当前积分 <span className="ml-1 font-semibold text-slate-900">{user?.credits ?? 0}</span>
          </span>
          <span>每张图消耗 1 积分</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold">生成设置</h2>

          {error ? (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          ) : null}

          <div className="space-y-4">
            <Field label="商品图" required>
              <div
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openFileDialog();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    openFileDialog();
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center transition-colors hover:border-slate-900 hover:bg-white"
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="商品图预览" className="max-h-48 object-contain" />
                ) : (
                  <>
                    <p className="text-sm text-slate-700">点击或拖拽上传商品图</p>
                    <p className="mt-1 text-xs text-slate-400">JPG / PNG / WEBP</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFileChange} onClick={(event) => event.stopPropagation()} className="hidden" />
              {previewUrl ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openFileDialog();
                  }}
                  className="mt-2 text-xs text-slate-500 underline hover:text-slate-900"
                >
                  重新选择
                </button>
              ) : null}
            </Field>

            <Field label="商品名称" required>
              <TextInput value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="例：可携式果汁机" />
            </Field>

            <Field label="商品类目" hint="可选">
              <TextInput value={category} onChange={(event) => setCategory(event.target.value)} placeholder="例：厨房家电" />
            </Field>

            <Field label="商品描述" hint="可选">
              <TextArea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="一句话描述商品的核心特点" />
            </Field>

            <Field label="文案语言" required>
              <Select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                {languageOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="图片类型" required>
              <div className="grid grid-cols-2 gap-2">
                {imageTypeOptions.map((item) => {
                  const active = selectedTypes.includes(item.key);
                  return (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => toggleType(item.key)}
                      className={`rounded border px-3 py-2 text-left text-xs transition-colors ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}
                    >
                      <div className="font-medium">{item.shortTitle}</div>
                      <div className={`mt-0.5 ${active ? "text-white/70" : "text-slate-400"}`}>{item.description}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <details className="rounded border border-slate-200 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700">更多信息（品牌、卖点等）</summary>
              <div className="space-y-3 px-3 pb-3 pt-2">
                <Field label="品牌"><TextInput value={brand} onChange={(event) => setBrand(event.target.value)} /></Field>
                <Field label="材质"><TextInput value={material} onChange={(event) => setMaterial(event.target.value)} /></Field>
                <Field label="尺寸/规格"><TextInput value={size} onChange={(event) => setSize(event.target.value)} /></Field>
                <Field label="颜色"><TextInput value={color} onChange={(event) => setColor(event.target.value)} /></Field>
                <Field label="目标人群"><TextInput value={audience} onChange={(event) => setAudience(event.target.value)} /></Field>
                <Field label="卖点" hint="每行一个"><TextArea value={sellingPoints} onChange={(event) => setSellingPoints(event.target.value)} rows={3} /></Field>
                <Field label="避免词" hint="每行一个"><TextArea value={avoid} onChange={(event) => setAvoid(event.target.value)} rows={2} /></Field>
              </div>
            </details>

            <Button type="button" onClick={generate} disabled={isLoading} className="w-full py-3 text-base">
              {isLoading ? "生成中..." : `开始生成（${selectedTypes.length} 积分）`}
            </Button>
          </div>
        </aside>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold">本次结果</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {plans.length > 0 ? `${productName || "未命名"} · 共 ${plans.length} 张` : "暂无结果"}
              </p>
            </div>
            {plans.length > 0 ? (
              <div className="flex items-center gap-2 text-xs">
                <Tag tone="success">成功 {plans.filter((p) => p.imageUrl).length}</Tag>
                {plans.filter((p) => !p.imageUrl).length > 0 ? <Tag tone="danger">失败 {plans.filter((p) => !p.imageUrl).length}</Tag> : null}
              </div>
            ) : null}
          </div>

          {plans.length === 0 ? (
            <div className="rounded border border-dashed border-slate-200 px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-700">尚未生成内容</p>
              <p className="mt-2 text-xs text-slate-500">填写左侧表单，点击「开始生成」。</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => (
                <article key={plan.type} className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    {plan.imageUrl ? (
                      <img
                        src={plan.imageUrl}
                        alt={plan.title}
                        className="h-full w-full cursor-zoom-in object-cover transition-transform hover:scale-[1.02]"
                        onClick={() => setLightboxPlan(plan)}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">
                        {plan.error || "未生成"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{plan.title}</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">{plan.size}</div>
                      </div>
                      {plan.imageUrl ? <Tag tone="success">已生成</Tag> : <Tag tone="danger">失败</Tag>}
                    </div>
                    {plan.localizedCopy.length > 0 ? (
                      <div className="rounded bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                        {plan.localizedCopy.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button onClick={() => copyText(plan.prompt)} className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">复制提示词</button>
                      {plan.localizedCopy.length > 0 ? (
                        <button onClick={() => copyText(plan.localizedCopy.join("\n"))} className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">复制文案</button>
                      ) : null}
                      {plan.imageUrl ? (
                        <a href={plan.imageUrl} download={`${plan.type}.png`} className="rounded bg-slate-900 px-2.5 py-1 text-xs text-white hover:bg-black">下载</a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => regeneratePlan(plan)}
                        disabled={isLoading}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        重新生成
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {isLoading ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[440px] max-w-full rounded-lg bg-white p-7 shadow-xl">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold">正在生成图片</h3>
              <span className="text-sm text-slate-500">{progress}%</span>
            </div>
            <p className="mb-4 text-xs text-slate-500">{steps[stepIndex] || "处理中..."}</p>
            <div className="relative mb-2 h-1.5 overflow-hidden rounded bg-slate-100">
              <div className="absolute inset-y-0 left-0 bg-slate-900 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="relative mb-5 h-1 overflow-hidden rounded bg-slate-100">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-slate-900 animate-[loadingbar_1.4s_linear_infinite]" />
            </div>
            <div className="space-y-2 text-xs">
              {steps.map((s, i) => (
                <div key={`${s}-${i}`} className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${i <= stepIndex ? "bg-slate-900" : "bg-slate-200"}`} />
                  <span className={i === stepIndex ? "text-slate-900" : i < stepIndex ? "text-slate-500" : "text-slate-400"}>{s}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
              <span>预计耗时 30-180 秒</span>
              <button onClick={cancelGenerate} className="text-slate-500 underline hover:text-slate-900">取消</button>
            </div>
          </div>
        </div>
      ) : null}

      {lightboxPlan && lightboxPlan.imageUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6" onClick={() => setLightboxPlan(null)}>
          <div className="relative max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
            <img src={lightboxPlan.imageUrl} alt={lightboxPlan.title} className="max-h-[88vh] max-w-[90vw] rounded object-contain" />
            <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded bg-black/60 px-3 py-2 text-xs text-white backdrop-blur">
              <span>{lightboxPlan.title} · {lightboxPlan.size}</span>
              <div className="flex gap-3">
                <a href={lightboxPlan.imageUrl} download={`${lightboxPlan.type}.png`} className="hover:underline">下载</a>
                <button onClick={() => setLightboxPlan(null)} className="hover:underline">关闭</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
