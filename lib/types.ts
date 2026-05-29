export type Language = "en" | "zh-CN" | "zh-TW";

export type PlatformKey =
  | "generic"
  | "meituan_waimai"
  | "meituan_flash"
  | "taobao_tmall"
  | "jd"
  | "douyin"
  | "pdd"
  | "rednote";

export type ListingIntent = "new_listing" | "refresh_listing" | "delist_clearance" | "sold_out_pause";

export type GenerationMode = "image_to_image" | "text_to_image";

export type ImageTypeKey =
  | "main_white_bg"
  | "platform_listing"
  | "feature_infographic"
  | "detail_specs"
  | "package_label"
  | "lifestyle"
  | "delist_notice";

export type ProductInput = {
  productName: string;
  generationMode?: GenerationMode;
  platform?: PlatformKey;
  listingIntent?: ListingIntent;
  category?: string;
  description?: string;
  language: Language;
  brand?: string;
  material?: string;
  size?: string;
  color?: string;
  audience?: string;
  sellingPoints?: string[];
  avoid?: string[];
  imageTypes: ImageTypeKey[];
};

export type ProductAnalysis = {
  productName: string;
  category: string;
  description: string;
  brand: string;
  material: string;
  size: string;
  color: string;
  audience: string;
  sellingPoints: string[];
  avoid: string[];
};

export type ImageTypeOption = {
  key: ImageTypeKey;
  title: string;
  shortTitle: string;
  description: string;
  defaultSelected: boolean;
};

export type ImagePlan = {
  type: ImageTypeKey;
  title: string;
  usage: string;
  size: string;
  localizedCopy: string[];
  designNotes: string;
  prompt: string;
  negativePrompt: string;
  imageUrl?: string;
  error?: string;
};

export type CallLog = {
  id: string;
  timestamp: number;
  endpoint: string;
  model: string;
  imageType: ImageTypeKey;
  size: string;
  status: number;
  durationMs: number;
  ok: boolean;
  error?: string;
};

export type HistoryEntry = {
  id: string;
  timestamp: number;
  productName: string;
  language: Language;
  imageCount: number;
  successCount: number;
  failCount: number;
  plans: ImagePlan[];
};

export type AuthUser = {
  id: string;
  phone: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  credits: number;
  createdAt: string;
  lastLoginAt: string | null;
};

export type GenerateResponse = {
  ok: boolean;
  generationId?: string;
  plans: ImagePlan[];
  error?: string;
  logs: CallLog[];
  credits?: number;
};
