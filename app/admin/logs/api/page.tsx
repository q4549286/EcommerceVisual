"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Buttons";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Select, TextInput } from "@/components/ui/FormField";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/client-api";
import { formatDateTime, formatDuration } from "@/lib/format";

type ApiLogItem = {
  id: string;
  endpoint: string;
  action: string;
  model: string | null;
  imageType: string | null;
  size: string | null;
  status: number;
  durationMs: number;
  ok: boolean;
  error: string | null;
  user: { id: string; phone: string } | null;
  createdAt: string;
};

export default function AdminApiLogsPage() {
  const { show } = useToast();
  const [items, setItems] = useState<ApiLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [onlyError, setOnlyError] = useState(false);

  useEffect(() => { load(); }, [page, onlyError]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (onlyError) params.set("onlyError", "1");
      const data = await apiFetch<{ items: ApiLogItem[]; total: number }>(`/api/admin/logs/api?${params.toString()}`, { cache: "no-store" });
      const filtered = phone.trim() ? (data.items || []).filter((item) => item.user?.phone.includes(phone.trim())) : data.items || [];
      setItems(filtered);
      setTotal(data.total || 0);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载失败", "danger");
    } finally {
      setLoading(false);
    }
  }

  const columns: Column<ApiLogItem>[] = [
    { key: "createdAt", header: "时间", width: "148px", render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span> },
    {
      key: "status",
      header: "状态",
      width: "78px",
      render: (row) => <Tag tone={row.ok ? "success" : "danger"}>{row.status || "ERR"}</Tag>
    },
    { key: "user", header: "用户", width: "150px", render: (row) => <span className="block truncate text-sm text-slate-700">{row.user?.phone || "未知"}</span> },
    { key: "action", header: "动作", width: "126px", render: (row) => <span className="block truncate text-xs font-medium text-slate-700">{row.action}</span> },
    { key: "model", header: "模型/类型", width: "166px", render: (row) => <span className="block truncate text-xs text-slate-500" title={[row.model, row.imageType].filter(Boolean).join(" / ")}>{[row.model, row.imageType].filter(Boolean).join(" / ") || "-"}</span> },
    { key: "size", header: "尺寸", width: "88px", render: (row) => <span className="text-xs text-slate-500">{row.size || "-"}</span> },
    { key: "duration", header: "耗时", width: "76px", align: "right", render: (row) => <span className="text-xs text-slate-500">{formatDuration(row.durationMs)}</span> },
    {
      key: "error",
      header: "错误",
      render: (row) => row.error ? <span className="block max-w-full truncate text-xs text-red-600" title={row.error}>{row.error}</span> : <span className="text-xs text-slate-400">-</span>
    }
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="调用日志"
        description="所有图片生成请求的详细日志，支持按用户、状态筛选。"
        actions={<Button variant="secondary" size="sm" onClick={load}>刷新</Button>}
      />

      <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(220px,280px)_120px_72px_auto] sm:items-center">
        <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="按手机号筛选" className="h-9" />
        <Select value={onlyError ? "1" : ""} onChange={(event) => { setPage(1); setOnlyError(event.target.value === "1"); }} className="h-9">
          <option value="">全部</option>
          <option value="1">仅失败</option>
        </Select>
        <Button size="sm" onClick={load} className="h-9 px-4 justify-self-start">查询</Button>
        <div className="justify-self-start text-xs text-slate-500 sm:justify-self-end">
          共 <span className="font-semibold text-slate-900">{total}</span> 条
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} rows={items} rowKey={(row) => row.id} loading={loading} emptyText="暂无调用日志" />
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
