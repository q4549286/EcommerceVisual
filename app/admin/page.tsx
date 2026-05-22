"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { SparklineChart } from "@/components/admin/SparklineChart";
import { Button } from "@/components/ui/Buttons";
import { StatCard } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/client-api";
import { formatRelative } from "@/lib/format";

type DashboardData = {
  stats: {
    totalUsers: number;
    newUsersToday: number;
    activeUsers7d: number;
    totalGenerations: number;
    totalCreditsConsumed: number;
  };
  trend: { day: string; calls: number; success: number; users: number }[];
  topByCalls: { userId: string | null; phone: string; count: number }[];
  topByConsume: { userId: string | null; phone: string; amount: number }[];
  recentSystemLogs: { id: string; level: "INFO" | "WARN" | "ERROR"; action: string; message: string; userPhone: string | null; createdAt: string }[];
};

export default function AdminDashboardPage() {
  const { show } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const result = await apiFetch<DashboardData>("/api/admin/dashboard", { cache: "no-store" });
      setData(result);
    } catch (err) {
      show(err instanceof Error ? err.message : "加载看板失败", "danger");
    } finally {
      setLoading(false);
    }
  }

  const stats = data?.stats;

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="数据看板"
        description="实时跟踪用户增长、调用量、积分消耗与系统状态。"
        actions={<Button variant="secondary" size="sm" onClick={load}>刷新</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="累计用户" value={stats?.totalUsers ?? "-"} hint={`今日新增 ${stats?.newUsersToday ?? 0}`} />
        <StatCard label="近 7 天活跃" value={stats?.activeUsers7d ?? "-"} hint="登录视为活跃" />
        <StatCard label="累计生成次数" value={stats?.totalGenerations ?? "-"} hint="按生成会话计" />
        <StatCard label="累计消耗积分" value={stats?.totalCreditsConsumed ?? "-"} hint="不含赠送与退款" />
        <StatCard label="今日新增用户" value={stats?.newUsersToday ?? "-"} hint="自然日统计" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">近 14 天调用趋势</h2>
              <p className="mt-0.5 text-xs text-slate-500">含成功调用与全部调用</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-slate-900" />全部</span>
              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-emerald-600" />成功</span>
            </div>
          </div>
          {loading || !data ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-400">加载中...</div>
          ) : (
            <SparklineChart
              series={[
                { color: "#0f172a", values: data.trend.map((d) => d.calls) },
                { color: "#16a34a", values: data.trend.map((d) => d.success) }
              ]}
              labels={data.trend.map((d) => d.day.slice(5))}
              height={180}
            />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">近 14 天新增用户</h2>
          {loading || !data ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-400">加载中...</div>
          ) : (
            <SparklineChart
              series={[{ color: "#475569", values: data.trend.map((d) => d.users) }]}
              labels={data.trend.map((d) => d.day.slice(5))}
              height={180}
            />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">调用次数 Top 10 用户</h2>
          <ul className="mt-4 space-y-2">
            {data?.topByCalls.length === 0 ? <li className="text-sm text-slate-400">暂无数据</li> : null}
            {data?.topByCalls.map((item, idx) => (
              <li key={`${item.userId || "anonymous"}-${idx}`} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">{idx + 1}</span>
                  <span className="text-slate-700">{item.phone}</span>
                </span>
                <span className="font-semibold tabular-nums">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">积分消耗 Top 10 用户</h2>
          <ul className="mt-4 space-y-2">
            {data?.topByConsume.length === 0 ? <li className="text-sm text-slate-400">暂无数据</li> : null}
            {data?.topByConsume.map((item, idx) => (
              <li key={`${item.userId || "anonymous"}-${idx}`} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">{idx + 1}</span>
                  <span className="text-slate-700">{item.phone}</span>
                </span>
                <span className="font-semibold tabular-nums">{item.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">最近系统日志</h2>
          <a href="/admin/logs/system" className="text-xs text-slate-500 underline hover:text-slate-900">查看全部</a>
        </div>
        <ul className="space-y-3">
          {data?.recentSystemLogs.length === 0 ? <li className="text-sm text-slate-400">暂无日志</li> : null}
          {data?.recentSystemLogs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Tag tone={log.level === "ERROR" ? "danger" : log.level === "WARN" ? "warning" : "neutral"}>{log.level}</Tag>
              <span className="font-medium text-slate-900">{log.action}</span>
              <span className="text-slate-500">{log.message}</span>
              <span className="ml-auto text-xs text-slate-400">{log.userPhone || "系统"} · {formatRelative(log.createdAt)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
