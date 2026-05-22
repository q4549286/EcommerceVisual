"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Buttons";
import { Field, TextInput } from "@/components/ui/FormField";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/client-api";

type AdminSettings = {
  loginBonusCredits: number;
  generationCreditCost: number;
  imageStorage: {
    enabled: boolean;
    provider: "s3";
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey?: string;
    publicBaseUrl: string;
    pathPrefix: string;
    secretConfigured?: boolean;
  };
  imageApi: {
    baseUrl: string;
    apiKey?: string;
    model: string;
    keyConfigured?: boolean;
  };
};

const defaultImageStorage: AdminSettings["imageStorage"] = {
  enabled: false,
  provider: "s3",
  endpoint: "",
  region: "auto",
  bucket: "",
  accessKeyId: "",
  secretAccessKey: "",
  publicBaseUrl: "",
  pathPrefix: "generated",
  secretConfigured: false
};

const defaultImageApi: AdminSettings["imageApi"] = {
  baseUrl: "",
  apiKey: "",
  model: "",
  keyConfigured: false
};

export default function AdminSettingsPage() {
  const { show } = useToast();
  const [settings, setSettings] = useState<AdminSettings>({ loginBonusCredits: 4, generationCreditCost: 1, imageStorage: defaultImageStorage, imageApi: defaultImageApi });
  const [loginBonusCredits, setLoginBonusCredits] = useState("4");
  const [imageStorage, setImageStorage] = useState<AdminSettings["imageStorage"]>(defaultImageStorage);
  const [imageApi, setImageApi] = useState<AdminSettings["imageApi"]>(defaultImageApi);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ settings: AdminSettings }>("/api/admin/settings", { cache: "no-store" });
      setSettings(data.settings);
      setLoginBonusCredits(String(data.settings.loginBonusCredits));
      setImageStorage({ ...defaultImageStorage, ...data.settings.imageStorage, secretAccessKey: "" });
      setImageApi({ ...defaultImageApi, ...data.settings.imageApi, apiKey: "" });
    } catch (err) {
      show(err instanceof Error ? err.message : "读取设置失败", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await saveSettings();
  }

  async function saveSettings() {
    setSubmitting(true);
    try {
      const data = await apiFetch<{ settings: AdminSettings }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          loginBonusCredits: Number(loginBonusCredits),
          imageStorage,
          imageApi
        })
      });
      setSettings(data.settings);
      setLoginBonusCredits(String(data.settings.loginBonusCredits));
      setImageStorage({ ...defaultImageStorage, ...data.settings.imageStorage, secretAccessKey: "" });
      setImageApi({ ...defaultImageApi, ...data.settings.imageApi, apiKey: "" });
      show("设置已保存", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "保存失败", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="系统设置"
        description="系统级参数配置。"
        actions={<Button variant="secondary" size="sm" onClick={load}>刷新</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">积分规则</h2>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <Field label="每日登录赠送积分" required hint="0-1000，每个用户每天最多赠送一次">
              <TextInput
                type="number"
                min={0}
                max={1000}
                step={1}
                value={loginBonusCredits}
                onChange={(event) => setLoginBonusCredits(event.target.value)}
                disabled={loading}
              />
            </Field>
            <div className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">每张图扣分</span>
                <span className="font-semibold">{settings.generationCreditCost} 积分</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-slate-600">失败退款</span>
                <Tag tone="success">自动</Tag>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting || loading}>{submitting ? "保存中..." : "保存设置"}</Button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">对象存储</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <span>
                <span className="block font-medium text-slate-800">启用对象存储</span>
                <span className="mt-0.5 block text-xs text-slate-500">关闭时继续保存到服务器 public/generated。</span>
              </span>
              <input
                type="checkbox"
                checked={imageStorage.enabled}
                onChange={(event) => setImageStorage((current) => ({ ...current, enabled: event.target.checked }))}
                disabled={loading}
              />
            </label>
            <Field label="Endpoint 地址">
              <TextInput value={imageStorage.endpoint} onChange={(event) => setImageStorage((current) => ({ ...current, endpoint: event.target.value }))} placeholder="https://xxx.r2.cloudflarestorage.com 或 OSS/COS/S3 endpoint" disabled={loading} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Region">
                <TextInput value={imageStorage.region} onChange={(event) => setImageStorage((current) => ({ ...current, region: event.target.value }))} placeholder="auto / ap-guangzhou / us-east-1" disabled={loading} />
              </Field>
              <Field label="Bucket">
                <TextInput value={imageStorage.bucket} onChange={(event) => setImageStorage((current) => ({ ...current, bucket: event.target.value }))} disabled={loading} />
              </Field>
            </div>
            <Field label="Access Key ID">
              <TextInput value={imageStorage.accessKeyId} onChange={(event) => setImageStorage((current) => ({ ...current, accessKeyId: event.target.value }))} disabled={loading} />
            </Field>
            <Field label="Secret Access Key" hint={imageStorage.secretConfigured ? "已保存；留空表示不修改" : "启用对象存储时必填"}>
              <TextInput type="password" value={imageStorage.secretAccessKey || ""} onChange={(event) => setImageStorage((current) => ({ ...current, secretAccessKey: event.target.value }))} disabled={loading} />
            </Field>
            <Field label="公开访问地址" hint="用于拼接最终图片 URL">
              <TextInput value={imageStorage.publicBaseUrl} onChange={(event) => setImageStorage((current) => ({ ...current, publicBaseUrl: event.target.value }))} placeholder="https://cdn.example.com 或 Bucket 公网地址" disabled={loading} />
            </Field>
            <Field label="保存路径前缀">
              <TextInput value={imageStorage.pathPrefix} onChange={(event) => setImageStorage((current) => ({ ...current, pathPrefix: event.target.value }))} placeholder="generated" disabled={loading} />
            </Field>
            <div className="flex justify-end">
              <Button type="button" onClick={saveSettings} disabled={submitting || loading}>{submitting ? "保存中..." : "保存设置"}</Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">图像生成接口</h2>
          <div className="mt-4 space-y-4">
            <Field label="IMAGE_API_BASE" hint="OpenAI-compatible image API base URL">
              <TextInput value={imageApi.baseUrl} onChange={(event) => setImageApi((current) => ({ ...current, baseUrl: event.target.value }))} disabled={loading} />
            </Field>
            <Field label="IMAGE_API_KEY" hint={imageApi.keyConfigured ? "已保存；留空表示不修改" : "生成图片前必须配置"}>
              <TextInput type="password" value={imageApi.apiKey || ""} onChange={(event) => setImageApi((current) => ({ ...current, apiKey: event.target.value }))} disabled={loading} />
            </Field>
            <Field label="IMAGE_MODEL">
              <TextInput value={imageApi.model} onChange={(event) => setImageApi((current) => ({ ...current, model: event.target.value }))} disabled={loading} />
            </Field>
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">接口密钥状态</span>
              <Tag tone={imageApi.keyConfigured ? "success" : "neutral"}>{imageApi.keyConfigured ? "已配置" : "未配置"}</Tag>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={saveSettings} disabled={submitting || loading}>{submitting ? "保存中..." : "保存设置"}</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
