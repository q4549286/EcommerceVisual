"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { CSSProperties, useState } from "react";
import { Button } from "@/components/ui/Buttons";
import { appPath } from "@/lib/client-api";

export default function LoginPage() {
  const params = useSearchParams();
  const initialError = params.get("error") || "";

  const [baseUrl, setBaseUrl] = useState("https://aispeedapi.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-image-2");
  const [error, setError] = useState(initialError);
  const fieldClass = "w-full rounded-2xl border border-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/30 focus:border-white/30";
  const fieldStyle: CSSProperties = {
    backgroundColor: "#181818",
    color: "#ffffff",
    WebkitTextFillColor: "#ffffff"
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070707] p-5 text-white sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,137,45,0.32),transparent_34%),radial-gradient(ellipse_at_15%_10%,rgba(37,208,255,0.14),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,7,0.12),#070707_68%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-md flex-col justify-center">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2">
            <Image src="/brand/ecommerce-mascot.png" alt="" width={32} height={32} className="h-8 w-8 rounded-xl object-cover" priority />
            <span className="text-xl font-black tracking-tight">电商专用</span>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70 backdrop-blur">
            API 管理模式
          </span>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-black/[0.55] p-5 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="mb-5">
            <h1 className="text-xl font-semibold tracking-tight">配置 API，进入工作台</h1>
            <p className="mt-1.5 text-sm leading-6 text-white/[0.55]">
              不再使用手机号登录。API Base、Key、图片模型会写入数据库持久化，后续生成统一读取这套配置。
            </p>
          </div>

          <form action={appPath("/api/auth/login")} method="post" className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-white/60">API Base URL *</span>
              <input
                name="baseUrl"
                value={baseUrl}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  setError("");
                }}
                placeholder="https://api.openai.com/v1"
                required
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
                name="apiKey"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setError("");
                }}
                placeholder="sk-..."
                autoComplete="off"
                required
                className={fieldClass}
                style={fieldStyle}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-white/60">图片模型 *</span>
              <input
                name="model"
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setError("");
                }}
                placeholder="gpt-image-2"
                required
                className={fieldClass}
                style={fieldStyle}
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</div>
            ) : null}

            <Button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-[#ff7a2f] to-[#df37d8] py-3 text-base shadow-lg shadow-[#df37d8]/20 hover:opacity-95">
              保存 API 并进入
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
