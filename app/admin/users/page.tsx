"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Buttons";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Field, Select, TextInput } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/client-api";
import { formatDateTime, formatRelative } from "@/lib/format";

type AdminUser = {
  id: string;
  phone: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  credits: number;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { apiLogs: number; generations: number; creditRecords: number };
};

type UserCredit = {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

type UserApiLog = {
  id: string;
  action: string;
  status: number;
  ok: boolean;
  imageType: string | null;
  durationMs: number;
  createdAt: string;
};

export default function AdminUsersPage() {
  const { show } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "DISABLED">("");
  const [roleFilter, setRoleFilter] = useState<"" | "USER" | "ADMIN">("");

  const [active, setActive] = useState<AdminUser | null>(null);
  const [activeCredits, setActiveCredits] = useState<UserCredit[]>([]);
  const [activeLogs, setActiveLogs] = useState<UserApiLog[]>([]);

  const [creditModal, setCreditModal] = useState<AdminUser | null>(null);
  const [pwModal, setPwModal] = useState<AdminUser | null>(null);
  const [creditValue, setCreditValue] = useState("");
  const [pwValue, setPwValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: AdminUser[] }>("/api/admin/users", { cache: "no-store" });
      setUsers(data.users || []);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载失败", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function patchUser(userId: string, body: Record<string, unknown>, successMessage = "已更新") {
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      await load();
      show(successMessage, "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "更新失败", "danger");
    }
  }

  async function openDrawer(user: AdminUser) {
    setActive(user);
    setActiveCredits([]);
    setActiveLogs([]);
    try {
      const [creditData, logData] = await Promise.all([
        apiFetch<{ records: UserCredit[] }>(`/api/admin/credits?userId=${user.id}&limit=20`),
        apiFetch<{ items: UserApiLog[] }>(`/api/admin/logs/api?userId=${user.id}&pageSize=20`)
      ]);
      setActiveCredits(creditData.records || []);
      setActiveLogs(logData.items || []);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载详情失败", "danger");
    }
  }

  async function submitCredit(event: FormEvent) {
    event.preventDefault();
    if (!creditModal) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/users/${creditModal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ credits: Number(creditValue) })
      });
      setCreditModal(null);
      setCreditValue("");
      await load();
      show("积分已调整", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "调整失败", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (!pwModal) return;
    if (pwValue.length < 6) {
      show("密码至少 6 位", "danger");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/users/${pwModal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: pwValue })
      });
      setPwModal(null);
      setPwValue("");
      show("密码已重置", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "重置失败", "danger");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    return users.filter((user) => {
      if (keyword && !user.phone.includes(keyword.trim())) return false;
      if (statusFilter && user.status !== statusFilter) return false;
      if (roleFilter && user.role !== roleFilter) return false;
      return true;
    });
  }, [users, keyword, statusFilter, roleFilter]);

  const columns: Column<AdminUser>[] = [
    {
      key: "phone",
      header: "用户",
      width: "200px",
      render: (row) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{row.phone}</div>
          <div className="mt-0.5 truncate text-[11px] text-slate-400">{row.id}</div>
        </div>
      )
    },
    {
      key: "role",
      header: "角色",
      width: "88px",
      render: (row) => <Tag tone={row.role === "ADMIN" ? "info" : "neutral"}>{row.role === "ADMIN" ? "管理员" : "用户"}</Tag>
    },
    {
      key: "status",
      header: "状态",
      width: "88px",
      render: (row) => <Tag tone={row.status === "ACTIVE" ? "success" : "danger"}>{row.status === "ACTIVE" ? "启用" : "停用"}</Tag>
    },
    {
      key: "credits",
      header: "积分",
      width: "72px",
      align: "right",
      render: (row) => <span className="font-semibold tabular-nums">{row.credits}</span>
    },
    {
      key: "calls",
      header: "调用",
      width: "72px",
      align: "right",
      render: (row) => <span className="text-sm text-slate-600 tabular-nums">{row._count.apiLogs}</span>
    },
    {
      key: "lastLoginAt",
      header: "最近登录",
      width: "116px",
      render: (row) => <span className="text-xs text-slate-500">{row.lastLoginAt ? formatRelative(row.lastLoginAt) : "未登录"}</span>
    },
    {
      key: "createdAt",
      header: "注册时间",
      width: "148px",
      render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span>
    },
    {
      key: "actions",
      header: "操作",
      width: "310px",
      align: "right",
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => openDrawer(row)}>详情</Button>
          <Button variant="secondary" size="sm" onClick={() => patchUser(row.id, { status: row.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }, row.status === "ACTIVE" ? "已停用" : "已启用")}>
            {row.status === "ACTIVE" ? "停用" : "启用"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => patchUser(row.id, { role: row.role === "ADMIN" ? "USER" : "ADMIN" }, row.role === "ADMIN" ? "已降级为普通用户" : "已升级为管理员")}>
            {row.role === "ADMIN" ? "降级" : "升管"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setCreditModal(row); setCreditValue(String(row.credits)); }}>积分</Button>
          <Button variant="secondary" size="sm" onClick={() => { setPwModal(row); setPwValue(""); }}>密码</Button>
        </div>
      )
    }
  ];

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="用户管理"
        description="管理平台所有用户，支持启用、停用、积分调整、密码重置以及查看明细。"
        actions={<Button variant="secondary" size="sm" onClick={load}>刷新</Button>}
      />

      <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(220px,280px)_120px_120px_auto] sm:items-center">
        <TextInput
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索手机号"
          className="h-9"
        />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-9">
          <option value="">全部状态</option>
          <option value="ACTIVE">启用</option>
          <option value="DISABLED">停用</option>
        </Select>
        <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} className="h-9">
          <option value="">全部角色</option>
          <option value="USER">用户</option>
          <option value="ADMIN">管理员</option>
        </Select>
        <div className="justify-self-start text-xs text-slate-500 sm:justify-self-end">
          共 <span className="font-semibold text-slate-900">{filtered.length}</span> 个用户
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} rows={filtered} rowKey={(row) => row.id} loading={loading} emptyText="暂无用户" />
      </div>

      <Drawer open={!!active} onClose={() => setActive(null)} title={active?.phone || "用户详情"} description={active ? `${active.role === "ADMIN" ? "管理员" : "用户"} · ${active.status === "ACTIVE" ? "启用" : "停用"}` : ""} width={560}>
        {active ? (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 p-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">积分</div>
                <div className="mt-1 text-lg font-semibold">{active.credits}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">调用次数</div>
                <div className="mt-1 text-lg font-semibold">{active._count.apiLogs}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">生成次数</div>
                <div className="mt-1 text-lg font-semibold">{active._count.generations}</div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">注册时间：</span>{formatDateTime(active.createdAt)}</div>
                <div><span className="text-slate-500">最近登录：</span>{active.lastLoginAt ? formatDateTime(active.lastLoginAt) : "未登录"}</div>
                <div className="col-span-2 truncate"><span className="text-slate-500">用户 ID：</span>{active.id}</div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">最近积分流水</h3>
              <div className="space-y-2">
                {activeCredits.length === 0 ? <div className="text-xs text-slate-400">暂无记录</div> : null}
                {activeCredits.map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-xs">
                    <div>
                      <div className="font-medium text-slate-700">{record.type}</div>
                      <div className="mt-0.5 text-slate-400">{formatDateTime(record.createdAt)}</div>
                    </div>
                    <div className={`font-semibold tabular-nums ${record.amount >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                      {record.amount >= 0 ? "+" : ""}{record.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">最近 API 调用</h3>
              <div className="space-y-2">
                {activeLogs.length === 0 ? <div className="text-xs text-slate-400">暂无记录</div> : null}
                {activeLogs.map((log) => (
                  <div key={log.id} className="rounded border border-slate-100 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{log.action}</span>
                      <Tag tone={log.ok ? "success" : "danger"}>{log.status || "ERR"}</Tag>
                    </div>
                    <div className="mt-1 text-slate-500">{log.imageType || "-"} · {log.durationMs}ms · {formatDateTime(log.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>

      <Modal
        open={!!creditModal}
        onClose={() => setCreditModal(null)}
        title="调整积分"
        description={creditModal ? `用户：${creditModal.phone}（当前 ${creditModal.credits} 积分）` : ""}
      >
        <form onSubmit={submitCredit} className="space-y-4">
          <Field label="新的积分数量" required>
            <TextInput type="number" min={0} value={creditValue} onChange={(event) => setCreditValue(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreditModal(null)}>取消</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "提交中..." : "确认调整"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!pwModal}
        onClose={() => setPwModal(null)}
        title="重置密码"
        description={pwModal ? `用户：${pwModal.phone}` : ""}
      >
        <form onSubmit={submitPassword} className="space-y-4">
          <Field label="新密码" required hint="至少 6 位">
            <TextInput type="text" value={pwValue} onChange={(event) => setPwValue(event.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPwModal(null)}>取消</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "提交中..." : "重置密码"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
