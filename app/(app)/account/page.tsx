"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Buttons";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, TextInput } from "@/components/ui/FormField";
import { StatCard } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useUserSession } from "@/components/UserSession";
import { apiFetch } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";

type CreditRecord = {
  id: string;
  type: "LOGIN_BONUS" | "GENERATION_DEBIT" | "GENERATION_REFUND" | "ADMIN_ADJUSTMENT";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

const typeLabel: Record<CreditRecord["type"], string> = {
  LOGIN_BONUS: "登录赠送",
  GENERATION_DEBIT: "生成扣分",
  GENERATION_REFUND: "失败退款",
  ADMIN_ADJUSTMENT: "管理员调整"
};

const columns: Column<CreditRecord>[] = [
  {
    key: "type",
    header: "类型",
    width: "120px",
    render: (row) => <Tag tone={row.type === "GENERATION_DEBIT" ? "warning" : row.type === "ADMIN_ADJUSTMENT" ? "info" : "success"}>{typeLabel[row.type]}</Tag>
  },
  {
    key: "amount",
    header: "变动",
    width: "100px",
    align: "right",
    render: (row) => (
      <span className={row.amount >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
        {row.amount >= 0 ? "+" : ""}{row.amount}
      </span>
    )
  },
  {
    key: "balance",
    header: "余额",
    width: "140px",
    align: "right",
    render: (row) => <span className="text-slate-700">{row.balanceBefore} → {row.balanceAfter}</span>
  },
  {
    key: "note",
    header: "备注",
    render: (row) => <span className="text-xs text-slate-500">{row.note || "-"}</span>
  },
  {
    key: "createdAt",
    header: "时间",
    width: "180px",
    render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>
  }
];

export default function AccountPage() {
  const { user, refresh } = useUserSession();
  const { show } = useToast();
  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    loadCredits();
  }, []);

  async function loadCredits() {
    setLoading(true);
    try {
      const data = await apiFetch<{ records: CreditRecord[] }>("/api/me/credits", { cache: "no-store" });
      setRecords(data.records || []);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载失败", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPwError("");
    if (newPassword.length < 6) return setPwError("新密码至少 6 位。");
    if (newPassword !== confirmPassword) return setPwError("两次输入的新密码不一致。");

    setPwLoading(true);
    try {
      await apiFetch("/api/me/password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword })
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      show("密码已修改", "success");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "修改失败。");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">账号中心</h1>
        <p className="mt-1 text-sm text-slate-500">查看账号信息、积分流水，并管理登录密码。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="账号" value={user?.phone || "-"} hint={user?.role === "ADMIN" ? "管理员" : "普通用户"} />
        <StatCard label="当前积分" value={user?.credits ?? 0} hint="生成 1 张图消耗 1 积分" />
        <StatCard label="最近登录" value={formatDateTime(user?.lastLoginAt) || "-"} hint={`注册于 ${formatDateTime(user?.createdAt) || "-"}`} />
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">积分流水</h2>
            <p className="mt-0.5 text-xs text-slate-500">最近 50 条记录</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { loadCredits(); refresh(); }}>刷新</Button>
        </header>
        <DataTable columns={columns} rows={records} rowKey={(row) => row.id} loading={loading} emptyText="暂无积分记录" />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <form onSubmit={changePassword} className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">修改密码</h2>
          <p className="mt-1 text-xs text-slate-500">建议使用至少 8 位、含字母和数字的密码。</p>
          <div className="mt-4 space-y-3">
            <Field label="原密码" required>
              <TextInput type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="新密码" required hint="至少 6 位">
              <TextInput type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="确认新密码" required>
              <TextInput type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            </Field>
            {pwError ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{pwError}</div> : null}
            <Button type="submit" disabled={pwLoading} className="w-full">
              {pwLoading ? "提交中..." : "更新密码"}
            </Button>
          </div>
        </form>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">关于积分</h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-900" /><span>登录或注册时赠送 4 积分。</span></li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-900" /><span>每次成功生成 1 张图消耗 1 积分。</span></li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-900" /><span>生成失败将自动退还相应积分。</span></li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-900" /><span>积分余额不足时，请联系管理员调整。</span></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
