"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/Buttons";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Select, TextInput } from "@/components/ui/FormField";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/client-api";
import { formatDateTime } from "@/lib/format";

type GenerationItem = {
  id: string;
  productName: string;
  language: string;
  imageCount: number;
  successCount: number;
  failCount: number;
  creditsCharged: number;
  user: { id: string; phone: string };
  createdAt: string;
};

type GenerationDetail = GenerationItem & {
  input: unknown;
  images: { id: string; type: string; title: string; size: string; ok: boolean; imageUrl: string | null; error: string | null }[];
  creditRecords: { id: string; type: string; amount: number; balanceBefore: number; balanceAfter: number; createdAt: string }[];
};

export default function AdminGenerationsPage() {
  const { show } = useToast();
  const [items, setItems] = useState<GenerationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [phoneKeyword, setPhoneKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "success" | "fail">("");
  const [active, setActive] = useState<GenerationDetail | null>(null);

  useEffect(() => { load(); }, [page, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiFetch<{ items: GenerationItem[]; total: number }>(`/api/admin/generations?${params.toString()}`, { cache: "no-store" });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载失败", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: string) {
    try {
      const data = await apiFetch<{ generation: GenerationDetail }>(`/api/admin/generations/${id}`);
      setActive(data.generation);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载详情失败", "danger");
    }
  }

  const filtered = items.filter((item) => !phoneKeyword || item.user.phone.includes(phoneKeyword.trim()));

  const columns: Column<GenerationItem>[] = [
    {
      key: "productName",
      header: "商品",
      width: "280px",
      render: (row) => (
        <div>
          <div className="text-sm font-medium text-slate-900">{row.productName || "未命名"}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{row.language}</div>
        </div>
      )
    },
    { key: "user", header: "用户", width: "150px", render: (row) => <span className="text-sm text-slate-700">{row.user.phone}</span> },
    { key: "imageCount", header: "张数", width: "64px", align: "right", render: (row) => row.imageCount },
    {
      key: "successFail",
      header: "成功/失败",
      width: "110px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Tag tone="success">{row.successCount}</Tag>
          {row.failCount > 0 ? <Tag tone="danger">{row.failCount}</Tag> : <span className="text-xs text-slate-400">0</span>}
        </div>
      )
    },
    { key: "credits", header: "扣分", width: "72px", align: "right", render: (row) => <span className="font-semibold tabular-nums">{row.creditsCharged}</span> },
    { key: "createdAt", header: "时间", width: "148px", render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span> },
    {
      key: "actions",
      header: "操作",
      width: "86px",
      render: (row) => <Button variant="secondary" size="sm" onClick={() => openDetail(row.id)}>查看</Button>
    }
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="生成记录"
        description="所有用户的图片生成历史与详细信息。"
        actions={<Button variant="secondary" size="sm" onClick={load}>刷新</Button>}
      />

      <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(220px,280px)_120px_auto] sm:items-center">
        <TextInput
          value={phoneKeyword}
          onChange={(event) => setPhoneKeyword(event.target.value)}
          placeholder="按手机号筛选"
          className="h-9"
        />
        <Select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value as typeof statusFilter); }} className="h-9">
          <option value="">全部状态</option>
          <option value="success">全部成功</option>
          <option value="fail">含失败</option>
        </Select>
        <div className="justify-self-start text-xs text-slate-500 sm:justify-self-end">
          共 <span className="font-semibold text-slate-900">{total}</span> 条
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} rows={filtered} rowKey={(row) => row.id} loading={loading} emptyText="暂无生成记录" />
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>共 {total} 条 · 第 {page} / {totalPages} 页</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</Button>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</Button>
          </div>
        </div>
      </div>

      <Drawer open={!!active} onClose={() => setActive(null)} title={active?.productName || "生成详情"} description={active ? `${active.user.phone} · ${formatDateTime(active.createdAt)}` : ""} width={640}>
        {active ? (
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 p-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">语言：</span>{active.language}</div>
                <div><span className="text-slate-500">扣分：</span>{active.creditsCharged}</div>
                <div><span className="text-slate-500">成功：</span>{active.successCount}</div>
                <div><span className="text-slate-500">失败：</span>{active.failCount}</div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">输入</h3>
              <pre className="max-h-60 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">{JSON.stringify(active.input, null, 2)}</pre>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">图片</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {active.images.map((image) => (
                  <div key={image.id} className="overflow-hidden rounded border border-slate-200">
                    <div className="aspect-square bg-slate-50">
                      {image.imageUrl ? <img src={image.imageUrl} alt={image.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-400">{image.error || "未生成"}</div>}
                    </div>
                    <div className="p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{image.title}</span>
                        {image.ok ? <Tag tone="success">成功</Tag> : <Tag tone="danger">失败</Tag>}
                      </div>
                      <div className="mt-0.5 text-slate-500">{image.size}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">关联积分流水</h3>
              <div className="space-y-2">
                {active.creditRecords.length === 0 ? <div className="text-xs text-slate-400">暂无</div> : null}
                {active.creditRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-xs">
                    <span>{record.type}</span>
                    <span className={`font-semibold tabular-nums ${record.amount >= 0 ? "text-emerald-700" : "text-red-600"}`}>{record.amount >= 0 ? "+" : ""}{record.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
