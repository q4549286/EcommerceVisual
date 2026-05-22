import type { ReactNode } from "react";

const features = [
  { title: "10 秒上手", desc: "上传商品图，自动生成主图、亮点图、细节图、场景图。" },
  { title: "多语言文案", desc: "中英繁体一键切换，符合海外与台湾电商习惯。" },
  { title: "成本可控", desc: "登录即赠 4 积分，按张计费，不绑订阅。" }
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden h-full flex-col justify-between bg-slate-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-white text-base font-bold text-slate-900">E</span>
          <span className="text-base font-semibold tracking-tight">电商商品图生成器</span>
        </div>
        <div className="space-y-10">
          <div>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              让每一张商品图<br />
              都像专业团队出品。
            </h1>
            <p className="mt-4 max-w-md text-sm text-slate-300">
              面向海外与台湾电商的 AI 商品图工作台。聚焦白底主图、亮点介绍图、细节规格图与场景图。
            </p>
          </div>
          <ul className="space-y-5">
            {features.map((item, index) => (
              <li key={item.title} className="flex gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/30 text-xs font-semibold">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <div className="text-sm font-semibold">{item.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{item.desc}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-slate-500">© {new Date().getFullYear()} Ecommerce Visual</div>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-10 sm:px-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
