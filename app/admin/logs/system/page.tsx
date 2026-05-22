"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Buttons";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Select, TextInput } from "@/components/ui/FormField";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";

type SystemLogItem = {
  id: string;
  level: "INFO" | "WARN" | "ERROR";
  action: string;
  message: string;
  user: { id: string; phone: string } | null;
  createdAt: string;
};

export default function AdminSystemLogsPage() {
  const { show } = useToast();
  const [items, setItems] = useState<SystemLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<"" | "INFO" | "WARN" | "ERROR">("");
  const [phone, setPhone] = useState("");

  useEffect(() => { load(); }, [page, level]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (level) params.set("level", level);
      const data = await apiFetch<{ items: SystemLogItem[]; total: number }>(`/api/admin/logs/system?${params.toString()}`, { cache: "no-store" });
      const filtered = phone.trim() ? (data.items || []).filter((item) => item.user?.phone.includes(phone.trim())) : data.items || [];
      setItems(filtered);
      setTotal(data.total || 0);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载失败", "danger");
    } finally {
      setLoading(false);
    }
  }

  const columns: Column<SystemLogItem>[] = [
    { key: "createdAt", header: "时间", width: "148px", render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span> },
    {
      key: "level",
      header: "级别",
      width: "78px",
      render: (row) => <Tag tone={row.level === "ERROR" ? "danger" : row.level === "WARN" ? "warning" : "neutral"}>{row.level}</Tag>
    },
    { key: "action", header: "动作", width: "180px", render: (row) => <span className="text-xs font-medium text-slate-700">{row.action}</span> },
    { key: "user", header: "用户", width: "150px", render: (row) => <span className="text-sm text-slate-700">{row.user?.phone || "系统"}</span> },
    { key: "message", header: "消息", render: (row) => <span className="text-sm text-slate-600">{row.message}</span> }
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="系统日志"
        description="注册、登录、密码修改、管理员操作等系统级事件。"
        actions={<Button variant="secondary" size="sm" onClick={load}>刷新</Button>}
      />

      <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(220px,280px)_120px_72px_auto] sm:items-center">
        <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="按手机号筛选" className="h-9" />
        <Select value={level} onChange={(event) => { setPage(1); setLevel(event.target.value as typeof level); }} className="h-9">
          <option value="">全部级别</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </Select>
        <Button size="sm" onClick={load} className="h-9 px-4 justify-self-start">查询</Button>
        <div className="justify-self-start text-xs text-slate-500 sm:justify-self-end">
          共 <span className="font-semibold text-slate-900">{total}</span> 条
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} rows={items} rowKey={(row) => row.id} loading={loading} emptyText="暂无系统日志" />
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>共 {total} 条 · 第 {page} / {totalPages} 页</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
