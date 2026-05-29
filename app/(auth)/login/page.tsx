"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { CSSProperties, FormEvent, useState } from "react";
import { Button } from "@/components/ui/Buttons";
import { useUserSession } from "@/components/UserSession";
import { apiFetch } from "@/lib/client-api";
import type { AuthUser } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "";
  const { setUser } = useUserSession();

  const [baseUrl, setBaseUrl] = useState("https://aispeedapi.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-image-2");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fieldClass = "w-full rounded-2xl border border-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-white/30";
  const fieldStyle: CSSProperties = {
    backgroundColor: "#181818",
    color: "#ffffff",
    WebkitTextFillColor: "#ffffff"
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!baseUrl.trim()) return setError("请填写 API Base URL。");
    if (!apiKey.trim()) return setError("请填写 API Key。");
    if (!model.trim()) return setError("请填写图片模型。");

    setLoading(true);
    try {
      const data = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          imageApi: {
            baseUrl: baseUrl.trim(),
            apiKey: apiKey.trim(),
            model: model.trim()
          }
        })
      });
      setUser(data.user);
      router.replace(next || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存 API 配置失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070707] p-5 text-white sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[url('/jiaotu/home-light1.png')] bg-cover bg-center opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,137,45,0.16),transparent_34%),linear-gradient(180deg,rgba(7,7,7,0.18),#070707_68%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Image src="/jiaotu/logo.svg" alt="椒图AI" width={110} height={36} className="h-8 w-auto" priority />
          <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur">
            API 管理模式
          </span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/[0.55] p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="mb-6 text-center">
            <Image src="/jiaotu/mascot.webp" alt="" width={92} height={78} className="mx-auto mb-4 h-20 w-auto" />
            <h1 className="text-2xl font-semibold tracking-tight">配置 API，进入椒图式工作台</h1>
            <p className="mt-2 text-sm leading-6 text-white/[0.55]">
              不再使用手机号登录。API Base、Key、图片模型会写入数据库持久化，后续生成统一读取这套配置。
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-white/60">API Base URL *</span>
              <input
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                placeholder="https://api.openai.com/v1"
                className={fieldClass}
                style={fieldStyle}
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-white/60">
                <span>API Key *</span>
                <span className="text-[11px] font-normal text-white/[0.35]">只保存到本项目数据库，不显示明文</span>
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                className={fieldClass}
                style={fieldStyle}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-white/60">图片模型 *</span>
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder="gpt-image-2"
                className={fieldClass}
                style={fieldStyle}
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</div>
            ) : null}

            <Button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-r from-[#ff7a2f] to-[#df37d8] py-3 text-base shadow-lg shadow-[#df37d8]/20 hover:opacity-95">
              {loading ? "保存中..." : "保存 API 并进入"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
