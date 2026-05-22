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

type CreditRecord = {
  id: string;
  type: "LOGIN_BONUS" | "GENERATION_DEBIT" | "GENERATION_REFUND" | "ADMIN_ADJUSTMENT";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  note: string | null;
  user: { id: string; phone: string };
  createdAt: string;
};

const typeLabel: Record<CreditRecord["type"], string> = {
  LOGIN_BONUS: "登录赠送",
  GENERATION_DEBIT: "生成扣分",
  GENERATION_REFUND: "失败退款",
  ADMIN_ADJUSTMENT: "管理员调整"
};

export default function AdminCreditsPage() {
  const { show } = useToast();
  const [records, setRecords] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<"" | CreditRecord["type"]>("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (phone.trim()) params.set("phone", phone.trim());
      const data = await apiFetch<{ records: CreditRecord[] }>(`/api/admin/credits?${params.toString()}`, { cache: "no-store" });
      const filtered = type ? (data.records || []).filter((record) => record.type === type) : data.records || [];
      setRecords(filtered);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载失败", "danger");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const header = ["时间", "用户", "类型", "变动", "余额前", "余额后", "备注"];
    const lines = [header.join(",")];
    for (const record of records) {
      lines.push([
        formatDateTime(record.createdAt),
        record.user.phone,
        typeLabel[record.type],
        record.amount,
        record.balanceBefore,
        record.balanceAfter,
        (record.note || "").replace(/,/g, " ")
      ].join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credit-records-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const columns: Column<CreditRecord>[] = [
    { key: "createdAt", header: "时间", width: "148px", render: (row) => <span className="text-xs text-slate-500">{formatDateTime(row.createdAt)}</span> },
    { key: "user", header: "用户", width: "150px", render: (row) => <span className="text-sm text-slate-700">{row.user.phone}</span> },
    {
      key: "type",
      header: "类型",
      width: "116px",
      render: (row) => <Tag tone={row.type === "GENERATION_DEBIT" ? "warning" : row.type === "ADMIN_ADJUSTMENT" ? "info" : "success"}>{typeLabel[row.type]}</Tag>
    },
    {
      key: "amount",
      header: "变动",
      width: "84px",
      align: "right",
      render: (row) => <span className={`font-semibold tabular-nums ${row.amount >= 0 ? "text-emerald-700" : "text-red-600"}`}>{row.amount >= 0 ? "+" : ""}{row.amount}</span>
    },
    {
      key: "balance",
      header: "余额",
      width: "130px",
      align: "right",
      render: (row) => <span className="text-slate-700 tabular-nums">{row.balanceBefore} → {row.balanceAfter}</span>
    },
    { key: "note", header: "备注", render: (row) => <span className="text-xs text-slate-500">{row.note || "-"}</span> }
  ];

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="积分流水"
        description="按用户、类型、时间范围筛选积分变动记录。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={records.length === 0}>导出 CSV</Button>
            <Button variant="secondary" size="sm" onClick={load}>刷新</Button>
          </>
        }
      />

      <div className="mb-4 grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(220px,280px)_148px_72px_auto] sm:items-center">
        <TextInput
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="按手机号筛选"
          className="h-9"
        />
        <Select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-9">
          <option value="">全部类型</option>
          <option value="LOGIN_BONUS">登录赠送</option>
          <option value="GENERATION_DEBIT">生成扣分</option>
          <option value="GENERATION_REFUND">失败退款</option>
          <option value="ADMIN_ADJUSTMENT">管理员调整</option>
        </Select>
        <Button size="sm" onClick={load} className="h-9 px-4 justify-self-start">查询</Button>
        <div className="justify-self-start text-xs text-slate-500 sm:justify-self-end">
          共 <span className="font-semibold text-slate-900">{records.length}</span> 条
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataTable columns={columns} rows={records} rowKey={(row) => row.id} loading={loading} emptyText="暂无积分记录" />
      </div>
    </div>
  );
}
