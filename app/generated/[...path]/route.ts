import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

function contentTypeFor(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return "image/png";
}

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path: requestedPath } = await context.params;
  const filePath = path.resolve(GENERATED_DIR, ...requestedPath);
  const basePath = path.resolve(GENERATED_DIR);

  if (!filePath.startsWith(`${basePath}${path.sep}`)) {
    return NextResponse.json({ ok: false, error: "Invalid image path." }, { status: 400 });
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ ok: false, error: "Image not found." }, { status: 404 });
    }

    const body = await readFile(filePath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentTypeFor(filePath),
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Image not found." }, { status: 404 });
  }
}
