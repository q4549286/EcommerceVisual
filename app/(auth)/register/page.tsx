"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Buttons";
import { Field, TextInput } from "@/components/ui/FormField";
import { useUserSession } from "@/components/UserSession";
import { apiFetch } from "@/lib/client-api";
import type { AuthUser } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "";
  const { setUser } = useUserSession();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!phone.trim()) return setError("请输入手机号。");
    if (password.length < 6) return setError("密码至少 6 位。");
    if (password !== confirm) return setError("两次输入的密码不一致。");
    if (!agree) return setError("请阅读并同意服务条款。");

    setLoading(true);
    try {
      const data = await apiFetch<{ user: AuthUser }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), password })
      });
      setUser(data.user);
      const target = next ? next : data.user.role === "ADMIN" ? "/admin" : "/";
      router.replace(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">创建账号</div>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">免费注册</h2>
        <p className="mt-2 text-sm text-slate-500">注册即赠 4 积分，足够生成 4 张图。</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="手机号" required>
          <TextInput
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="请输入手机号"
            autoComplete="tel"
            inputMode="tel"
          />
        </Field>
        <Field label="密码" required hint="至少 6 位">
          <TextInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="设置登录密码"
            autoComplete="new-password"
          />
        </Field>
        <Field label="确认密码" required>
          <TextInput
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="再次输入密码"
            autoComplete="new-password"
          />
        </Field>

        <label className="flex items-start gap-2 text-xs text-slate-500">
          <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} className="mt-0.5" />
          <span>我已阅读并同意《服务条款》《隐私协议》。</span>
        </label>

        {error ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : null}

        <Button type="submit" disabled={loading} className="w-full py-2.5">
          {loading ? "注册中..." : "注册并领取 4 积分"}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
        <span>已有账号？</span>
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-slate-900 underline-offset-2 hover:underline">
          直接登录
        </Link>
      </div>
    </div>
  );
}
