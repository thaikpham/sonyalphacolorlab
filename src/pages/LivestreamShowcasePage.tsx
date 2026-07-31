import { useState, useEffect, useRef, useCallback, type ChangeEvent, type SyntheticEvent } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { spring, SlideIn } from "../lib/ios-motion";
import {
  readLastCameraConnectedAt,
  readPreferredCameraPreference,
  readShowcaseRuntimeFlags,
  readVideoAudioMutedFallback,
  writeLastBootAt,
  writePreferredCameraPreference,
  writeVideoAudioMutedFallback,
  type ShowcaseRuntimeFlags,
} from "../lib/showcase-runtime";
import { AsciiRecBackground } from "../components/AsciiRecBackground";
import {
  Camera,
  Gauge,
  Star,
  Lightbulb,
  Sliders,
  Cable,
  Mic,
  Settings,
  Zap,
  TriangleAlert,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

// ─── TikTok Mockup Types & Data ──────────────────────────────────────────────
interface HeartParticle {
  id: number;
  rightPct: number;
  size: number;
  color: string;
  targetY: number;
  targetX: number;
  duration: number;
}

interface ComplimentBubble {
  id: number;
  text: string;
  leftPct: number;
}

interface GiftParticle {
  id: number;
  rightPct: number;
  emoji: string;
  targetY: number;
  targetX: number;
  duration: number;
  scale: number;
}

interface FeedComment {
  id: number;
  user: string;
  text: string;
  color: string;
  avatar: string;
}

interface VideoSourceOption {
  deviceId: string;
  label: string;
  note: string;
  score: number;
  recommended: boolean;
}

interface SourceSelectionOptions {
  openPickerOnFailure?: boolean;
}

type CameraTrackConstraints = MediaTrackConstraints & {
  resizeMode?: ConstrainDOMString;
};

interface SonyReason {
  id: number;
  title: string;
  hook: string;
  benefit: string;
  imageUrl: string;
  youtubeVideoId?: string;
  youtubeDurationMs?: number;
  mediaAspectRatio?: string;
  chips: string[];
  details: string[];
  icon: React.ComponentType<{ className?: string }>;
  tone: "cool" | "warm" | "warning";
}

type YouTubeQualityLevel = "small" | "medium" | "large" | "hd720" | "hd1080" | "highres" | "default";

interface YouTubePlayer {
  destroy: () => void;
  getPlayerState: () => number;
  isMuted: () => boolean;
  playVideo: () => void;
  mute: () => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
  setPlaybackQuality: (quality: YouTubeQualityLevel) => void;
}

interface YouTubePlayerStateMap {
  BUFFERING: number;
  CUED: number;
  ENDED: number;
  PAUSED: number;
  PLAYING: number;
  UNSTARTED: number;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: YouTubePlayerStateMap;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const HEART_COLORS = ['#ff6b6b', '#ff8787', '#ff6b9d', '#c44569', '#f8b500', '#ff6b35'];
const COMPLIMENT_TEXTS = [
  "Sony lên màu đẹp quá! 📸",
  "Hình Sony nét căng luôn! ✨",
  "Màu da từ Sony nhìn xịn ghê 🎬",
  "Chất lượng hình ảnh quá pro! 🔥",
  "Sony stream đẹp khỏi chỉnh 🎥",
  "Dynamic range đỉnh thật 🌟",
  "Màu cinematic quá đã mắt 🎨",
  "Ảnh Sony quá mượt luôn 🚀",
];

function generateSvgAvatar(initial: string, bgColor: string) {
  return `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='${encodeURIComponent(bgColor)}'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui, sans-serif' font-weight='bold' font-size='14' fill='%23ffffff'%3E${initial}%3C/text%3E%3C/svg%3E`;
}

const COMMENT_POOL: FeedComment[] = [
  {
    id: 0,
    user: "Minh Pro",
    text: "Màu Sony đẹp quá, da người lên cực mịn!",
    color: "text-cyan-400",
    avatar: generateSvgAvatar("M", "#22d3ee"),
  },
  {
    id: 1,
    user: "Lan Studio",
    text: "Độ nét đỉnh thật, nhìn như TVC luôn.",
    color: "text-pink-400",
    avatar: generateSvgAvatar("L", "#f472b6"),
  },
  {
    id: 2,
    user: "Huy Media",
    text: "Dynamic range Sony quá ổn, không cháy highlight.",
    color: "text-yellow-400",
    avatar: generateSvgAvatar("H", "#eab308"),
  },
  {
    id: 3,
    user: "Khanh Film",
    text: "Tone màu cinematic, xem đã mắt ghê.",
    color: "text-green-400",
    avatar: generateSvgAvatar("K", "#4ade80"),
  },
  {
    id: 4,
    user: "An Creator",
    text: "Chất lượng hình ảnh Sony đúng là khác biệt!",
    color: "text-purple-400",
    avatar: generateSvgAvatar("A", "#c084fc"),
  },
  {
    id: 5,
    user: "Trung Live",
    text: "Chi tiết quá tốt, zoom vẫn nét căng.",
    color: "text-orange-400",
    avatar: generateSvgAvatar("T", "#fb923c"),
  },
  {
    id: 6,
    user: "Mai Visual",
    text: "Sony stream mà tưởng quay hậu kỳ rồi.",
    color: "text-blue-400",
    avatar: generateSvgAvatar("M", "#60a5fa"),
  },
];

const GIFT_EMOJIS = ["🎁", "🌹", "💎", "🏆", "🔥", "🚀", "💐", "⭐"];
const INITIAL_VISIBLE_FEED_COMMENTS = 4;
const MAX_VISIBLE_FEED_COMMENTS = 4;
const KIOSK_CAMERA_RETRY_BASE_MS = 1800;
const KIOSK_CAMERA_RETRY_MAX_MS = 6500;
const KIOSK_CAMERA_ERROR_THRESHOLD = 3;
const KIOSK_VIDEO_AUTOPLAY_TIMEOUT_MS = 4200;
const TARGET_CAMERA_VIEWPORT_WIDTH_PX = 1080;
const TARGET_CAMERA_VIEWPORT_HEIGHT_PX = 1920;
const TARGET_CAMERA_RAW_WIDTH_PX = TARGET_CAMERA_VIEWPORT_HEIGHT_PX;
const TARGET_CAMERA_RAW_HEIGHT_PX = TARGET_CAMERA_VIEWPORT_WIDTH_PX;
const TARGET_CAMERA_RAW_ASPECT_RATIO = TARGET_CAMERA_RAW_WIDTH_PX / TARGET_CAMERA_RAW_HEIGHT_PX;
const PHONE_SHELL_WIDTH_PX = 410;
const PHONE_SHELL_BORDER_PX = 8;
const PHONE_VIEWPORT_ASPECT_RATIO = TARGET_CAMERA_VIEWPORT_WIDTH_PX / TARGET_CAMERA_VIEWPORT_HEIGHT_PX;
const PHONE_VIEWPORT_WIDTH_PX = PHONE_SHELL_WIDTH_PX - PHONE_SHELL_BORDER_PX * 2;
const PHONE_VIEWPORT_HEIGHT_PX = PHONE_VIEWPORT_WIDTH_PX / PHONE_VIEWPORT_ASPECT_RATIO;
const PHONE_SHELL_HEIGHT_PX = PHONE_VIEWPORT_HEIGHT_PX + PHONE_SHELL_BORDER_PX * 2;
const CAMERA_BASE_CONSTRAINTS: CameraTrackConstraints = {
  width: { ideal: TARGET_CAMERA_RAW_WIDTH_PX, max: TARGET_CAMERA_RAW_WIDTH_PX },
  height: { ideal: TARGET_CAMERA_RAW_HEIGHT_PX, max: TARGET_CAMERA_RAW_HEIGHT_PX },
  aspectRatio: { ideal: TARGET_CAMERA_RAW_ASPECT_RATIO },
  frameRate: { ideal: 30, max: 60 },
  resizeMode: "crop-and-scale",
};
const DEFAULT_CAMERA_FRAME_SIZE = {
  width: TARGET_CAMERA_RAW_WIDTH_PX,
  height: TARGET_CAMERA_RAW_HEIGHT_PX,
};
const DEFAULT_PHONE_VIEWPORT_SIZE = {
  width: PHONE_VIEWPORT_WIDTH_PX,
  height: PHONE_VIEWPORT_HEIGHT_PX,
};
const CONFLICTING_CAMERA_PATTERNS = [
  "imaging edge",
  "imagingedge",
  "obs virtual",
  "virtual camera",
  "snap camera",
  "droidcam",
  "epoccam",
  "ivcam",
  "iriun",
  "xsplit vcam",
] as const;
const LAPTOP_CAMERA_PATTERNS = [
  "integrated camera",
  "built-in",
  "facetime",
  "hd webcam",
] as const;

function normalizeCameraLabel(label: string) {
  return label.trim().toLowerCase();
}

function isConflictingCameraSource(label: string) {
  const normalized = normalizeCameraLabel(label);
  return CONFLICTING_CAMERA_PATTERNS.some(pattern => normalized.includes(pattern));
}

function isSonyUsbLivestreamSource(label: string) {
  const normalized = normalizeCameraLabel(label);
  const mentionsSony = normalized.includes("sony");
  const mentionsUsbStream =
    normalized.includes("usb") ||
    normalized.includes("uvc") ||
    normalized.includes("stream") ||
    normalized.includes("live");

  return mentionsSony && mentionsUsbStream && !isConflictingCameraSource(label);
}

function isSonyCameraSource(label: string) {
  const normalized = normalizeCameraLabel(label);
  return normalized.includes("sony") && !isConflictingCameraSource(label);
}

function scoreVideoDevice(device: MediaDeviceInfo) {
  const label = device.label || "Camera chưa cấp quyền";
  const normalized = normalizeCameraLabel(label);

  if (!label) return 0;
  if (isConflictingCameraSource(label)) return -1000;
  if (isSonyUsbLivestreamSource(label)) return 300;
  if (isSonyCameraSource(label)) return 220;
  if (normalized.includes("usb")) return 120;
  if (normalized.includes("camera")) return 60;
  if (LAPTOP_CAMERA_PATTERNS.some(pattern => normalized.includes(pattern))) return 10;
  return 30;
}

function describeVideoDevice(label: string) {
  if (isSonyUsbLivestreamSource(label)) return "Ưu tiên: Sony USB Livestream / UVC";
  if (isSonyCameraSource(label)) return "Nguồn Sony vật lý";
  if (normalizeCameraLabel(label).includes("usb")) return "Nguồn USB khả dụng";
  if (LAPTOP_CAMERA_PATTERNS.some(pattern => normalizeCameraLabel(label).includes(pattern))) {
    return "Camera tích hợp";
  }
  return "Camera khả dụng";
}

function buildVideoSourceOptions(devices: MediaDeviceInfo[]) {
  const visibleOptions: VideoSourceOption[] = devices
    .filter(device => device.kind === "videoinput")
    .filter(device => !isConflictingCameraSource(device.label))
    .map(device => {
      const score = scoreVideoDevice(device);
      return {
        deviceId: device.deviceId,
        label: device.label || "Camera chưa rõ tên",
        note: describeVideoDevice(device.label),
        score,
        recommended: score >= 300,
      };
    })
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label));

  const hiddenLabels = devices
    .filter(device => device.kind === "videoinput")
    .filter(device => isConflictingCameraSource(device.label))
    .map(device => device.label || "Nguồn camera ảo");

  return { visibleOptions, hiddenLabels };
}

function labelsProbablyMatch(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false;

  const normalizedLeft = normalizeCameraLabel(left);
  const normalizedRight = normalizeCameraLabel(right);

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function pickPreferredVideoSource(options: VideoSourceOption[]) {
  if (!options.length) return null;

  const storedPreference = readPreferredCameraPreference();

  if (storedPreference?.deviceId) {
    const exactMatch = options.find((option) => option.deviceId === storedPreference.deviceId);
    if (exactMatch) return exactMatch;
  }

  if (storedPreference?.normalizedLabel) {
    const labelMatch = options.find((option) => labelsProbablyMatch(option.label, storedPreference.normalizedLabel));
    if (labelMatch) return labelMatch;
  }

  return options[0];
}

function getYouTubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function buildYouTubeEmbedUrl(videoId: string, { muted, autoplay }: { muted: boolean; autoplay: boolean }) {
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    controls: "1",
    enablejsapi: "1",
    fs: "1",
    iv_load_policy: "3",
    modestbranding: "1",
    mute: muted ? "1" : "0",
    playsinline: "1",
    rel: "0",
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function normalizeRotation(rotation: number) {
  return ((rotation % 360) + 360) % 360;
}

function getFittedVideoFrameSize(
  viewport: { width: number; height: number },
  frame: { width: number; height: number },
  rotation: number,
) {
  const normalizedRotation = normalizeRotation(rotation);
  const isQuarterTurn = normalizedRotation === 90 || normalizedRotation === 270;
  const rotatedWidth = isQuarterTurn ? frame.height : frame.width;
  const rotatedHeight = isQuarterTurn ? frame.width : frame.height;

  if (!viewport.width || !viewport.height || !rotatedWidth || !rotatedHeight) {
    return frame;
  }

  const scale = Math.max(viewport.width / rotatedWidth, viewport.height / rotatedHeight);

  return {
    width: frame.width * scale,
    height: frame.height * scale,
  };
}

function buildCameraTrackConstraints(deviceId?: string): CameraTrackConstraints {
  return {
    ...CAMERA_BASE_CONSTRAINTS,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  };
}

function isPlaybackStateRunning(playerState: number | null, playerStateMap: YouTubePlayerStateMap) {
  return playerState === playerStateMap.PLAYING || playerState === playerStateMap.BUFFERING;
}

const SHOWCASE_YOUTUBE_PLAYER_HOST_ID = "showcase-youtube-player-host";
const DEFAULT_MAIN_APP_URL = "http://127.0.0.1:5173";
const YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
let youTubeApiReadyPromise: Promise<YouTubeNamespace> | null = null;

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveMainAppBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_MAIN_APP_URL?.trim();
  if (configuredBaseUrl) return ensureTrailingSlash(configuredBaseUrl);

  if (typeof document !== "undefined" && document.referrer) {
    try {
      const referrerUrl = new URL(document.referrer);
      return ensureTrailingSlash(referrerUrl.origin);
    } catch {
      // Ignore invalid referrer values and continue to local fallbacks.
    }
  }

  if (import.meta.env.DEV) {
    return ensureTrailingSlash(DEFAULT_MAIN_APP_URL);
  }

  if (typeof window !== "undefined") {
    return ensureTrailingSlash(window.location.origin);
  }

  return ensureTrailingSlash(DEFAULT_MAIN_APP_URL);
}

function buildMainAppUrl(pathname: string) {
  return new URL(pathname.replace(/^\//, ""), resolveMainAppBaseUrl()).toString();
}

function loadYouTubeIframeApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API requires a browser environment."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youTubeApiReadyPromise) {
    return youTubeApiReadyPromise;
  }

  youTubeApiReadyPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_IFRAME_API_SRC}"]`);
    const script = existingScript ?? document.createElement("script");

    window.onYouTubeIframeAPIReady = () => {
      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }
      reject(new Error("YouTube API loaded but player constructor is unavailable."));
    };

    script.onerror = () => reject(new Error("Failed to load YouTube Iframe API."));

    if (!existingScript) {
      script.src = YOUTUBE_IFRAME_API_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youTubeApiReadyPromise;
}

const SONY_LIVE_REASONS: SonyReason[] = [
  {
    id: 1,
    title: "Image Quality",
    hook: "Chất Lượng Hình Ấn Tượng",
    benefit: "Cảm biến lớn, chi tiết rõ nét, màu sắc trung thực.",
    imageUrl: "https://placehold.co/1600x900/0f172a/93c5fd?text=Image+Quality",
    chips: ["Full-frame", "Dynamic range", "Skin tone"],
    details: [
      "Cảm biến lớn giảm noise, tăng chi tiết.",
      "Dynamic range rộng giữ trọn vùng sáng tối khi setup ánh sáng.",
      "Công nghệ xử lý màu Sony tái hiện da người tự nhiên.",
    ],
    icon: Camera,
    tone: "cool",
  },
  {
    id: 2,
    title: "Bokeh",
    hook: "Nổi Bật Nhờ Xóa Phông",
    benefit: "Ống kính khẩu lớn, chủ thể rõ, nền mờ tự nhiên.",
    imageUrl: "https://placehold.co/1600x900/1f132b/f0abfc?text=Bokeh",
    chips: ["f/1.4-f/2", "Optical blur", "Depth"],
    details: [
      "Ống kính khẩu lớn tạo phông nền mờ sâu, nổi bật chủ thể.",
      "Hiệu ứng bokeh tự nhiên hỗ trợ trải nghiệm livestream ấn tượng.",
      "Quang học thực cho chất lượng nổi bật hơn phần mềm.",
    ],
    icon: Lightbulb,
    tone: "warm",
  },
  {
    id: 3,
    title: "Eye AF",
    hook: "Lấy Nét Mắt Tự Động",
    benefit: "Tự động lấy nét mắt chính xác, duy trì hình ảnh sắc nét.",
    imageUrl: "https://placehold.co/1600x900/0f172a/67e8f9?text=Eye+AF",
    chips: ["Eye AF", "Product focus", "Stability"],
    details: [
      "Eye AF giúp tracking mắt nhanh và chính xác liên tục.",
      "Chuyển nét mượt mà giữa người và vật thể.",
      "Yên tâm cho cả bán hàng lẫn review sản phẩm trực tiếp.",
    ],
    icon: Gauge,
    tone: "cool",
  },
  {
    id: 4,
    title: "Color Control",
    hook: "Quản Lý Màu Chuyên Nghiệp",
    benefit: "Tùy chỉnh màu linh hoạt, đảm bảo đồng nhất trên mọi nền tảng.",
    imageUrl: "https://placehold.co/1600x900/0b1020/60a5fa?text=Color+Control",
    chips: ["Creative Look", "Color Lab", "Color match"],
    details: [
      "Creative Look giúp thiết lập màu sắc nhanh chóng phù hợp với thương hiệu.",
      "Picture Profile hỗ trợ tinh chỉnh chuyên sâu.",
      "Dễ dàng cân chỉnh màu khi sử dụng nhiều camera Sony.",
    ],
    icon: Sliders,
    tone: "cool",
  },
  {
    id: 5,
    title: "Low Light",
    hook: "Quay Sáng Đẹp Đủ Mọi Điều Kiện",
    benefit: "Hiệu suất tốt khi ánh sáng yếu, hình ảnh sạch chi tiết.",
    imageUrl: "https://placehold.co/1600x900/2a180d/fbbf24?text=Low+Light",
    chips: ["Low light", "Clean image", "Flexible"],
    details: [
      "ISO cao giúp hình sạch, giữ chi tiết khi ánh sáng yếu.",
      "Hoạt động ổn định trong môi trường shop hoặc studio indoor.",
      "Kết hợp đèn hỗ trợ cho chất lượng livestream tối ưu.",
    ],
    icon: Zap,
    tone: "warm",
  },
  {
    id: 6,
    title: "Connectivity",
    hook: "Kết Nối Dễ Dàng",
    benefit: "HDMI và USB UVC hỗ trợ đa nền tảng, setup nhanh chóng.",
    imageUrl: "https://placehold.co/1600x900/10203a/7dd3fc?text=Connectivity",
    chips: ["Clean HDMI", "UVC", "OBS/vMix"],
    details: [
      "Hỗ trợ xuất HDMI sạch cho capture card chuyên dụng.",
      "Kết nối USB UVC, không cần driver, cắm là dùng được.",
      "Tương thích tốt với OBS, TikTok Live Studio, vMix.",
    ],
    icon: Cable,
    tone: "cool",
  },
  {
    id: 7,
    title: "Audio",
    hook: "Âm Thanh Chuẩn Xác",
    benefit: "Kết nối digital, âm thanh rõ, đồng bộ hình tiếng.",
    imageUrl: "https://placehold.co/1600x900/0b1326/93c5fd?text=Audio",
    chips: ["MI Shoe", "Low noise", "A/V sync"],
    details: [
      "Mic Sony ECM truyền âm thanh digital trực tiếp, giảm nhiễu.",
      "Không phụ thuộc jack 3.5mm, âm thanh ổn định.",
      "Đồng bộ audio-video chính xác, không lệch khung hình.",
    ],
    icon: Mic,
    tone: "cool",
  },
  {
    id: 8,
    title: "Ecosystem",
    hook: "Hệ Sinh Thái Đa Năng",
    benefit: "Dễ dàng nâng cấp body, thay đổi lens theo nhu cầu.",
    imageUrl: "https://placehold.co/1600x900/0b1a33/c4b5fd?text=Ecosystem",
    chips: ["ZV-E10→A7", "Lens swap", "Multi-use"],
    details: [
      "Chuyển đổi body linh hoạt: ZV-E10, ZV-E1, A7 series.",
      "Đáp ứng linh hoạt mọi nhu cầu: livestream, video, chụp ảnh.",
      "Lens đa dạng: góc rộng, xóa phông, macro...",
    ],
    icon: Settings,
    tone: "cool",
  },
  {
    id: 9,
    title: "Trust Boost",
    hook: "Hình Ảnh Tạo Niềm Tin",
    benefit: "Hình ảnh sắc nét, giữ chân khách hàng hiệu quả.",
    imageUrl: "https://placehold.co/1600x900/1a1024/f9a8d4?text=Trust+Boost",
    chips: ["Retention", "Trust", "Conversion"],
    details: [
      "Tạo ấn tượng chuyên nghiệp, nâng cao uy tín thương hiệu.",
      "Chất lượng hình ảnh giúp tăng thời gian theo dõi livestream.",
      "Tối ưu cho cá nhân, doanh nghiệp, bán hàng trực tuyến.",
    ],
    icon: Star,
    tone: "warm",
  },
  {
    id: 10,
    title: "Tận Hưởng Sự Khác Biệt",
    hook: "Trải Nghiệm Sony, Cảm Nhận Đẳng Cấp",
    benefit: "Hình ảnh và chất lượng vượt trội, khác biệt mọi thiết bị di động.",
    imageUrl: "https://placehold.co/1600x900/2a1b0a/fcd34d?text=Sony+Difference",
    chips: ["Cảm biến lớn", "Chất lượng vượt trội", "Nâng chuẩn livestream"],
    details: [
      "Cảm biến lớn, công nghệ mới dẫn đầu chất lượng hình ảnh.",
      "Trải nghiệm livestream vượt trội so với thiết bị di động thông thường.",
      "Nâng tầm hình ảnh cá nhân, doanh nghiệp ngay tại showroom.",
    ],
    icon: TriangleAlert,
    tone: "warning",
  },
  {
    id: 11,
    title: "Tutorial 01",
    hook: "Bật Product Showcase Trên Sony ZV",
    benefit: "Video hướng dẫn thực hành cách chuyển nhanh chế độ Product Showcase.",
    imageUrl: getYouTubeThumbnailUrl("xlatYBYoGSA"),
    youtubeVideoId: "xlatYBYoGSA",
    youtubeDurationMs: 73_000,
    mediaAspectRatio: "16 / 9",
    chips: ["YouTube Video", "Product Showcase", "Sony ZV"],
    details: [
      "Giải thích khi nào nên dùng Product Showcase trong livestream bán hàng.",
      "Các bước thao tác trực tiếp trên thân máy để bật/tắt nhanh.",
      "Tối ưu lấy nét sản phẩm khi đưa vật thể lên gần camera.",
    ],
    icon: Camera,
    tone: "cool",
  },
  {
    id: 12,
    title: "Tutorial 02",
    hook: "Cài Đặt Soft Skin Trên Máy Sony ZV",
    benefit: "Video cài đặt Soft Skin để làm mịn da tự nhiên khi livestream.",
    imageUrl: getYouTubeThumbnailUrl("CDJcWg5JYww"),
    youtubeVideoId: "CDJcWg5JYww",
    youtubeDurationMs: 36_000,
    mediaAspectRatio: "16 / 9",
    chips: ["YouTube Video", "Soft Skin", "Beauty Setup"],
    details: [
      "Thiết lập mức Soft Skin phù hợp từng điều kiện ánh sáng khác nhau.",
      "Giữ độ chi tiết chủ thể và hạn chế cảm giác xử lý quá tay.",
      "Kết hợp profile màu để da lên đều khi livestream dài phiên.",
    ],
    icon: Lightbulb,
    tone: "warm",
  },
  {
    id: 13,
    title: "Tutorial 03",
    hook: "Combo Lens Và Phụ Kiện Cho Livestream Thời Trang",
    benefit: "Video gợi ý setup lens và phụ kiện tối ưu cho ngành thời trang.",
    imageUrl: getYouTubeThumbnailUrl("f1cIbqmgQOg"),
    youtubeVideoId: "f1cIbqmgQOg",
    youtubeDurationMs: 38_000,
    mediaAspectRatio: "16 / 9",
    chips: ["YouTube Video", "Lens Combo", "Fashion Live"],
    details: [
      "Đề xuất tiêu cự và góc máy giúp tôn chất liệu, màu sắc sản phẩm.",
      "Gợi ý phụ kiện giữ khung hình ổn định trong nhiều format live khác nhau.",
      "Thiết lập nhanh để chuyển giữa talking-head và showcase sản phẩm.",
    ],
    icon: Sliders,
    tone: "cool",
  },
  {
    id: 14,
    title: "Tutorial 04",
    hook: "Combo Lens Và Phụ Kiện Cho F&B Và Mỹ Phẩm",
    benefit: "Video hướng dẫn setup dành cho bối cảnh quay cận món ăn và mỹ phẩm.",
    imageUrl: getYouTubeThumbnailUrl("1r6Tgcytqpk"),
    youtubeVideoId: "1r6Tgcytqpk",
    youtubeDurationMs: 29_000,
    mediaAspectRatio: "16 / 9",
    chips: ["YouTube Video", "F&B", "Cosmetic Live"],
    details: [
      "Tinh chỉnh khung và ánh sáng để texture món ăn/mỹ phẩm nổi bật.",
      "Kết hợp lens phù hợp để quay close-up vẫn giữ nét ổn định.",
      "Giảm rung và giữ chất lượng hình ảnh nhất quán trong suốt buổi live.",
    ],
    icon: Mic,
    tone: "warm",
  },
  {
    id: 15,
    title: "Tutorial 05",
    hook: "Setup Sony Đơn Giản Để Livestream Chuyên Nghiệp",
    benefit: "Video tổng hợp quy trình setup nhanh cho phiên livestream tiêu chuẩn.",
    imageUrl: getYouTubeThumbnailUrl("U2OoMn2H1Pk"),
    youtubeVideoId: "U2OoMn2H1Pk",
    youtubeDurationMs: 41_000,
    mediaAspectRatio: "16 / 9",
    chips: ["YouTube Video", "Quick Setup", "Pro Livestream"],
    details: [
      "Checklist toàn bộ bước chuẩn bị trước khi lên sóng.",
      "Thiết lập camera, audio và ánh sáng theo flow dễ triển khai.",
      "Giúp đội vận hành rút ngắn thời gian setup tại showroom.",
    ],
    icon: Settings,
    tone: "warning",
  },
];

// ─── Sony Reasons Infographic Panel ───────────────────────────────────────────
function SonyLiveReasonsPanel({
  kioskMode = false,
  onVideoFocusChange,
}: {
  kioskMode?: boolean;
  onVideoFocusChange?: (isVideoMode: boolean) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [isVideoFrameLoaded, setIsVideoFrameLoaded] = useState(false);
  const [playerReloadNonce, setPlayerReloadNonce] = useState(0);
  const [audioFallbackMuted, setAudioFallbackMuted] = useState(() => (kioskMode ? readVideoAudioMutedFallback() : false));
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const youtubePlayerHostRef = useRef<HTMLDivElement | null>(null);
  const autoplayTimeoutRef = useRef<number | null>(null);
  const audioLiftTimeoutRef = useRef<number | null>(null);
  const hasReloadedCurrentVideoRef = useRef(false);
  const hasAttemptedAudioLiftRef = useRef(false);
  const playerStateRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const AUTO_PLAY_MS = 15000;

  const toneStyles: Record<
    SonyReason["tone"],
    { surface: string; badge: string; chip: string; dot: string; glow: string; hoverShadow: string }
  > = {
    cool: {
      surface: "border-cyan-300/16",
      badge: "border border-white/10 bg-slate-600/72 text-slate-100",
      chip: "border border-cyan-300/18 bg-cyan-400/12 text-cyan-100",
      dot: "bg-cyan-300",
      glow: "from-cyan-300/20 via-sky-300/6 to-transparent",
      hoverShadow: "0 26px 48px rgba(3, 8, 20, 0.46), 0 0 0 1px rgba(94, 221, 255, 0.14)",
    },
    warm: {
      surface: "border-fuchsia-300/16",
      badge: "border border-white/10 bg-stone-500/68 text-stone-100",
      chip: "border border-fuchsia-300/16 bg-fuchsia-400/12 text-fuchsia-100",
      dot: "bg-fuchsia-300",
      glow: "from-fuchsia-300/18 via-amber-200/6 to-transparent",
      hoverShadow: "0 26px 48px rgba(3, 8, 20, 0.46), 0 0 0 1px rgba(244, 114, 182, 0.14)",
    },
    warning: {
      surface: "border-amber-300/18",
      badge: "border border-white/10 bg-neutral-600/72 text-neutral-100",
      chip: "border border-amber-300/18 bg-amber-400/12 text-amber-100",
      dot: "bg-amber-300",
      glow: "from-amber-300/18 via-orange-300/6 to-transparent",
      hoverShadow: "0 26px 48px rgba(3, 8, 20, 0.46), 0 0 0 1px rgba(245, 185, 92, 0.14)",
    },
  };

  const currentReason = SONY_LIVE_REASONS[activeIndex];
  const hasYouTubeVideo = Boolean(currentReason.youtubeVideoId);
  const currentTone = toneStyles[currentReason.tone];
  const slideProgress = ((activeIndex + 1) / SONY_LIVE_REASONS.length) * 100;
  const currentMediaAspectRatio = currentReason.mediaAspectRatio ?? (hasYouTubeVideo ? "16 / 9" : "1.92 / 1");
  const imagePlaceholderTone: Record<SonyReason["tone"], string> = {
    cool: "from-[#526c96] via-[#3c4767] to-[#1a2748]",
    warm: "from-[#8e6b55] via-[#785a4e] to-[#39263a]",
    warning: "from-[#7f6347] via-[#5d432f] to-[#2d2131]",
  };

  useEffect(() => {
    onVideoFocusChange?.(hasYouTubeVideo);
  }, [hasYouTubeVideo, onVideoFocusChange]);

  useEffect(() => {
    if (!kioskMode) return;
    writeVideoAudioMutedFallback(audioFallbackMuted);
  }, [audioFallbackMuted, kioskMode]);

  useEffect(() => {
    playerStateRef.current = null;
    hasReloadedCurrentVideoRef.current = false;
    hasAttemptedAudioLiftRef.current = false;
    setIsVideoFrameLoaded(false);
    setUseIframeFallback(false);
  }, [currentReason.id, hasYouTubeVideo]);

  const goPrev = useCallback(() => {
    setSlideDirection(-1);
    setActiveIndex((prev) => (prev - 1 + SONY_LIVE_REASONS.length) % SONY_LIVE_REASONS.length);
  }, []);

  const goNext = useCallback(() => {
    setSlideDirection(1);
    setActiveIndex((prev) => (prev + 1) % SONY_LIVE_REASONS.length);
  }, []);

  const goTo = useCallback((index: number) => {
    setSlideDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  }, [activeIndex]);

  useEffect(() => {
    const preconnectTargets = [
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
      "https://i.ytimg.com",
      "https://s.ytimg.com",
    ];
    const appendedLinks: HTMLLinkElement[] = [];

    preconnectTargets.forEach((href) => {
      if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = href;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
      appendedLinks.push(link);
    });

    return () => {
      appendedLinks.forEach((link) => link.remove());
    };
  }, []);

  useEffect(() => {
    if (hasYouTubeVideo && !useIframeFallback) {
      return;
    }

    const autoAdvanceMs = hasYouTubeVideo
      ? (currentReason.youtubeDurationMs ?? AUTO_PLAY_MS) + 1200
      : AUTO_PLAY_MS;

    const timer = window.setTimeout(() => {
      setSlideDirection(1);
      setActiveIndex((prev) => (prev + 1) % SONY_LIVE_REASONS.length);
    }, autoAdvanceMs);

    return () => window.clearTimeout(timer);
  }, [activeIndex, currentReason.youtubeDurationMs, hasYouTubeVideo, useIframeFallback]);

  useEffect(() => {
    let cancelled = false;

    const clearAutoplayTimeout = () => {
      if (autoplayTimeoutRef.current) {
        window.clearTimeout(autoplayTimeoutRef.current);
        autoplayTimeoutRef.current = null;
      }
    };

    const clearAudioLiftTimeout = () => {
      if (audioLiftTimeoutRef.current) {
        window.clearTimeout(audioLiftTimeoutRef.current);
        audioLiftTimeoutRef.current = null;
      }
    };

    const destroyPlayer = () => {
      clearAutoplayTimeout();
      clearAudioLiftTimeout();

      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }

      youtubePlayerHostRef.current?.replaceChildren();
    };

    if (!hasYouTubeVideo || !currentReason.youtubeVideoId || useIframeFallback || !youtubePlayerHostRef.current) {
      destroyPlayer();
      return;
    }

    const youtubeVideoId = currentReason.youtubeVideoId;
    const shouldAttemptAudibleAutoplay = !audioFallbackMuted;

    setIsVideoFrameLoaded(false);
    destroyPlayer();

    void loadYouTubeIframeApi()
      .then((yt) => {
        if (cancelled || !youtubePlayerHostRef.current) return;

        youtubePlayerRef.current = new yt.Player(youtubePlayerHostRef.current, {
          videoId: youtubeVideoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            mute: shouldAttemptAudibleAutoplay ? 0 : 1,
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            fs: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              setIsVideoFrameLoaded(true);
              playerStateRef.current = yt.PlayerState.UNSTARTED;
              event.target.setVolume(100);
              if (shouldAttemptAudibleAutoplay) {
                event.target.unMute();
              } else {
                event.target.mute();
              }

              event.target.setPlaybackQuality("hd720");
              event.target.playVideo();

              clearAutoplayTimeout();
              autoplayTimeoutRef.current = window.setTimeout(() => {
                const currentPlayerState = playerStateRef.current;
                const hasPlaybackStarted = isPlaybackStateRunning(currentPlayerState, yt.PlayerState);

                if (cancelled || hasPlaybackStarted) return;

                if (!hasReloadedCurrentVideoRef.current) {
                  hasReloadedCurrentVideoRef.current = true;
                  setPlayerReloadNonce((prev) => prev + 1);
                  return;
                }

                if (shouldAttemptAudibleAutoplay) {
                  setAudioFallbackMuted(true);
                  setPlayerReloadNonce((prev) => prev + 1);
                  return;
                }

                setUseIframeFallback(true);
              }, KIOSK_VIDEO_AUTOPLAY_TIMEOUT_MS);
            },
            onStateChange: (event) => {
              if (cancelled) return;
              playerStateRef.current = event.data;

              if (event.data === yt.PlayerState.PLAYING) {
                setIsVideoFrameLoaded(true);
                clearAutoplayTimeout();

                if (shouldAttemptAudibleAutoplay && !hasAttemptedAudioLiftRef.current) {
                  hasAttemptedAudioLiftRef.current = true;
                  clearAudioLiftTimeout();
                  audioLiftTimeoutRef.current = window.setTimeout(() => {
                    if (cancelled || !youtubePlayerRef.current) return;

                    youtubePlayerRef.current.setVolume(100);
                    if (shouldAttemptAudibleAutoplay) {
                      youtubePlayerRef.current.unMute();
                    }

                    window.setTimeout(() => {
                      if (cancelled || !youtubePlayerRef.current) return;

                      const playerStopped =
                        playerStateRef.current === yt.PlayerState.UNSTARTED ||
                        playerStateRef.current === yt.PlayerState.PAUSED;

                      if (playerStopped) {
                        setAudioFallbackMuted(true);
                        setPlayerReloadNonce((prev) => prev + 1);
                        return;
                      }

                      if (shouldAttemptAudibleAutoplay && youtubePlayerRef.current.isMuted()) {
                        setAudioFallbackMuted(true);
                        setPlayerReloadNonce((prev) => prev + 1);
                      }
                    }, 450);
                  }, 180);
                }
              }

              if (event.data === yt.PlayerState.ENDED) {
                clearAutoplayTimeout();
                goNext();
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setIsVideoFrameLoaded(false);
          if (!audioFallbackMuted) {
            setAudioFallbackMuted(true);
          }
          setUseIframeFallback(true);
        }
      });

    return () => {
      cancelled = true;
      destroyPlayer();
    };
  }, [currentReason.youtubeVideoId, goNext, hasYouTubeVideo, playerReloadNonce, useIframeFallback]);

  return (
    <SlideIn from="left" delay={0.28} className="flex w-full max-w-[940px] flex-col lg:origin-center lg:scale-[0.86] xl:scale-[0.92] 2xl:scale-100">
      <div className="space-y-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={currentReason.id}
            initial={reduceMotion || hasYouTubeVideo ? { opacity: 0 } : { opacity: 0, x: slideDirection * 56, scale: 0.98 }}
            animate={reduceMotion || hasYouTubeVideo ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
            exit={reduceMotion || hasYouTubeVideo ? { opacity: 0 } : { opacity: 0, x: slideDirection * -56, scale: 0.98 }}
            transition={reduceMotion || hasYouTubeVideo ? { duration: 0.12 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={`showcase-panel-shell group relative overflow-hidden rounded-[30px] p-4 md:p-5 ${currentTone.surface}`}
            whileHover={
              reduceMotion || hasYouTubeVideo || kioskMode
                ? undefined
                : {
                    y: -4,
                    boxShadow: currentTone.hoverShadow,
                  }
            }
            data-testid="showcase-carousel-panel"
            data-kiosk-audio-mode={audioFallbackMuted ? "muted" : "audible"}
          >
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
            <div
              className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${currentTone.glow} opacity-80 blur-3xl transition-opacity duration-200 group-hover:opacity-100`}
            />

            <div className="flex flex-col gap-4 p-1">
              <div
                className={`showcase-panel-media relative mx-auto w-full max-w-[860px] ${
                  hasYouTubeVideo ? "bg-transparent" : `bg-gradient-to-br ${imagePlaceholderTone[currentReason.tone]}`
                }`}
                style={{ aspectRatio: currentMediaAspectRatio }}
              >
                <div
                  className={`absolute inset-0 transition-opacity duration-200 ${
                    hasYouTubeVideo && isVideoFrameLoaded ? "opacity-100" : "pointer-events-none opacity-0"
                  }`}
                  style={{ transform: "translateZ(0)" }}
                >
                  <div
                    id={SHOWCASE_YOUTUBE_PLAYER_HOST_ID}
                    className="h-full w-full overflow-hidden rounded-[inherit]"
                    ref={useIframeFallback ? undefined : youtubePlayerHostRef}
                  >
                    {hasYouTubeVideo && useIframeFallback && currentReason.youtubeVideoId && (
                      <iframe
                        key={`${currentReason.id}-${audioFallbackMuted ? "muted" : "audible"}-${kioskMode ? "kiosk" : "standard"}`}
                        src={buildYouTubeEmbedUrl(currentReason.youtubeVideoId, {
                          autoplay: true,
                          muted: audioFallbackMuted,
                        })}
                        title={currentReason.hook}
                        className="h-full w-full rounded-[inherit] border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        onLoad={() => setIsVideoFrameLoaded(true)}
                      />
                    )}
                  </div>
                </div>
                <img
                  src={currentReason.imageUrl}
                  alt={currentReason.hook}
                  className={`h-full w-full object-cover transition-opacity duration-200 ${
                    hasYouTubeVideo && isVideoFrameLoaded ? "pointer-events-none opacity-0" : "opacity-100"
                  }`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(event: SyntheticEvent<HTMLImageElement>) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
                {!hasYouTubeVideo && (
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,255,255,0.2),transparent_48%)]" />
                )}
                {!hasYouTubeVideo && (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.04),transparent_38%,rgba(1,3,7,0.34))]" />
                )}
                <div className={`pointer-events-none absolute left-4 top-4 rounded-xl px-3 py-1.5 text-[12px] font-semibold tracking-[0.01em] backdrop-blur-md ${currentTone.badge}`}>
                  {String(activeIndex + 1).padStart(2, "0")} · {currentReason.title}
                </div>
              </div>

              <div className="w-full min-w-0 px-1 sm:px-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/52">{currentReason.title}</p>
                <h3 className="mt-3 w-full text-[30px] font-black leading-[0.96] tracking-[-0.045em] text-balance text-white sm:text-[36px] xl:text-[48px]">
                  {currentReason.hook}
                </h3>
                <p className="mt-3 w-full text-[14px] leading-[1.6] text-balance text-white/78 sm:text-[16px]">
                  {currentReason.benefit}
                </p>

                <ul className="mt-4 space-y-2 text-[15px] leading-[1.58] text-pretty text-white/92 sm:text-[16px]">
                  {currentReason.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2">
                      <span className={`mt-[0.72rem] h-1.5 w-1.5 rounded-full ${currentTone.dot}`} />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4 border-t border-white/8 px-1 pt-4 sm:px-2">
                <div className="flex items-center gap-3">
                  <span className="min-w-[74px] text-[30px] font-light tracking-[-0.05em] text-white/95">
                    {String(activeIndex + 1).padStart(2, "0")}
                    <span className="ml-1 text-white/34">/</span>
                    <span className="ml-1 text-[22px] text-white/52">
                      {String(SONY_LIVE_REASONS.length).padStart(2, "0")}
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goPrev}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/78 transition hover:bg-white/[0.12] hover:text-white"
                      aria-label="Previous reason"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/78 transition hover:bg-white/[0.12] hover:text-white"
                      aria-label="Next reason"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="showcase-progress-track ml-auto h-2.5 flex-1">
                    <motion.div
                      className="showcase-progress-fill"
                      animate={{ width: `${slideProgress}%` }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <motion.span
                      className="showcase-progress-thumb"
                      animate={{ left: `${slideProgress}%` }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
                  {SONY_LIVE_REASONS.map((reason, index) => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => goTo(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === activeIndex ? "bg-white sm:w-8" : `bg-white/22 ${kioskMode ? "" : "hover:bg-white/40"} sm:w-4`
                      }`}
                      aria-label={`Go to reason ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
    </SlideIn>
  );
}

// ─── Phone Mockup ──────────────────────────────────────────────────────────────
function PhoneMockup({
  performanceMode = "normal",
  kioskMode = false,
  debugMode = false,
  bootTimestamp = null,
}: {
  performanceMode?: "normal" | "video";
  kioskMode?: boolean;
  debugMode?: boolean;
  bootTimestamp?: string | null;
}) {
  const commentIndexRef = useRef<number>(INITIAL_VISIBLE_FEED_COMMENTS);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStoppingStreamRef = useRef(false);
  const selectedDeviceIdRef = useRef<string | null>(null);
  const autoReconnectRef = useRef<(requestPermission?: boolean) => Promise<boolean>>(async () => false);
  const retryTimeoutRef = useRef<number | null>(null);
  const autoConnectAttemptRef = useRef(0);
  const [hearts, setHearts] = useState<HeartParticle[]>([]);
  const [gifts, setGifts] = useState<GiftParticle[]>([]);
  const [compliments, setCompliments] = useState<ComplimentBubble[]>([]);
  const [feedComments, setFeedComments] = useState<FeedComment[]>(
    () => COMMENT_POOL.slice(0, INITIAL_VISIBLE_FEED_COMMENTS).map((c, i) => ({ ...c, id: i }))
  );
  const [viewerCount, setViewerCount] = useState(1847);
  const [followCount, setFollowCount] = useState(12840);
  const [likeCount, setLikeCount] = useState(42384);
  const [giftCount, setGiftCount] = useState(1862);
  const [cameraState, setCameraState] = useState<"idle" | "loading" | "live" | "fallback">("idle");
  const [cameraLabel, setCameraLabel] = useState("Chưa chọn source");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoSources, setVideoSources] = useState<VideoSourceOption[]>([]);
  const [hiddenSourceLabels, setHiddenSourceLabels] = useState<string[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(() => !kioskMode);
  const [isRefreshingSources, setIsRefreshingSources] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const transientIdRef = useRef(INITIAL_VISIBLE_FEED_COMMENTS);
  const [showControlPanel, setShowControlPanel] = useState(() => debugMode);
  const [flipHorizontal, setFlipHorizontal] = useState(false);
  const [flipVertical, setFlipVertical] = useState(false);
  const [sourceRotation, setSourceRotation] = useState<number>(90);
  const [frameRotate90, setFrameRotate90] = useState(false);
  const [sourceFrameSize, setSourceFrameSize] = useState<{ width: number; height: number }>(DEFAULT_CAMERA_FRAME_SIZE);
  const [phoneViewportSize, setPhoneViewportSize] = useState<{ width: number; height: number }>(DEFAULT_PHONE_VIEWPORT_SIZE);
  const [retryCount, setRetryCount] = useState(0);
  const [lastCameraConnectedAt, setLastCameraConnectedAt] = useState<string | null>(() => readLastCameraConnectedAt());
  const isVideoPerformanceMode = performanceMode === "video";
  const reduceAmbientEffects = kioskMode || isVideoPerformanceMode;
  const phoneViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  useEffect(() => {
    const viewport = phoneViewportRef.current;
    if (!viewport) return;

    const syncViewportSize = () => {
      const nextSize = {
        width: viewport.clientWidth || DEFAULT_PHONE_VIEWPORT_SIZE.width,
        height: viewport.clientHeight || DEFAULT_PHONE_VIEWPORT_SIZE.height,
      };

      setPhoneViewportSize((current) => {
        if (current.width === nextSize.width && current.height === nextSize.height) {
          return current;
        }

        return nextSize;
      });
    };

    syncViewportSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncViewportSize();
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const nextTransientId = useCallback(() => {
    const nextId = transientIdRef.current;
    transientIdRef.current += 1;
    return nextId;
  }, []);

  const stopCurrentStream = useCallback(() => {
    if (streamRef.current) {
      isStoppingStreamRef.current = true;
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      window.setTimeout(() => {
        isStoppingStreamRef.current = false;
      }, 0);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const syncVideoFrameSize = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl?.videoWidth || !videoEl.videoHeight) return;

    setSourceFrameSize((current) => {
      if (current.width === videoEl.videoWidth && current.height === videoEl.videoHeight) {
        return current;
      }

      return {
        width: videoEl.videoWidth,
        height: videoEl.videoHeight,
      };
    });
  }, []);

  const scheduleAutoReconnect = useCallback(
    (requestPermission = false) => {
      if (!kioskMode) return;

      clearRetryTimeout();

      autoConnectAttemptRef.current += 1;
      const attempt = autoConnectAttemptRef.current;
      setRetryCount(attempt);

      const delay = Math.min(
        KIOSK_CAMERA_RETRY_BASE_MS + Math.max(0, attempt - 1) * 900,
        KIOSK_CAMERA_RETRY_MAX_MS,
      );

      retryTimeoutRef.current = window.setTimeout(() => {
        void autoReconnectRef.current(requestPermission || attempt <= 2);
      }, delay);
    },
    [clearRetryTimeout, kioskMode],
  );

  const attachStream = useCallback(async (stream: MediaStream, label?: string) => {
    const videoEl = videoRef.current;
    streamRef.current = stream;
    const resolvedLabel = label || stream.getVideoTracks()[0]?.label || "USB Camera";
    setCameraLabel(resolvedLabel);

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack?.applyConstraints) {
      try {
        await videoTrack.applyConstraints(buildCameraTrackConstraints());
      } catch {
        // Some browsers ignore crop-and-scale for USB UVC sources; keep the stream live and fit it in CSS instead.
      }
    }

    if (videoEl) {
      videoEl.srcObject = stream;
      try {
        await videoEl.play();
      } catch {
        // Ignore autoplay race in case browser delays playback briefly.
      }
    }

    videoTrack?.addEventListener("ended", () => {
      if (isStoppingStreamRef.current) return;

      setCameraState("fallback");
      setCameraError(
        kioskMode
          ? "Tín hiệu Sony USB Livestream bị ngắt, hệ thống đang tự kết nối lại."
          : "Tín hiệu camera đã bị ngắt. Hãy chọn lại source camera.",
      );

      if (kioskMode) {
        scheduleAutoReconnect(false);
      } else {
        setIsPickerOpen(true);
      }
    }, { once: true });

    autoConnectAttemptRef.current = 0;
    setRetryCount(0);
    setLastCameraConnectedAt(new Date().toISOString());
    writePreferredCameraPreference(selectedDeviceIdRef.current, resolvedLabel);
    clearRetryTimeout();
    setCameraState("live");
  }, [clearRetryTimeout, kioskMode, scheduleAutoReconnect]);

  const refreshVideoSources = useCallback(async (requestPermission = false) => {
    if (!navigator.mediaDevices?.enumerateDevices || !navigator.mediaDevices?.getUserMedia) {
      const message = "Trình duyệt không hỗ trợ camera API.";
      setVideoSources([]);
      setHiddenSourceLabels([]);
      setPickerError(message);
      setCameraError(message);
      setCameraState("fallback");
      return [];
    }

    setIsRefreshingSources(true);
    setPickerError(null);

    try {
      if (requestPermission) {
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          video: buildCameraTrackConstraints(),
          audio: false,
        });
        permissionStream.getTracks().forEach(track => track.stop());
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const { visibleOptions, hiddenLabels } = buildVideoSourceOptions(devices);

      setVideoSources(visibleOptions);
      setHiddenSourceLabels(hiddenLabels);

      if (!visibleOptions.length) {
        const message = kioskMode
          ? "Đang chờ Sony USB Livestream xuất hiện. Hệ thống sẽ tự quét lại."
          : "Không tìm thấy Sony USB Livestream hoặc camera USB khả dụng. Hãy bật USB Streaming trên máy ảnh rồi quét lại.";
        setSelectedDeviceId(null);
        setPickerError(message);
        setCameraError(message);
        setCameraState("fallback");
        return [];
      }

      const currentDeviceId = selectedDeviceIdRef.current;
      const preferredSource = pickPreferredVideoSource(visibleOptions);
      const nextDeviceId =
        currentDeviceId && visibleOptions.some((option) => option.deviceId === currentDeviceId)
          ? currentDeviceId
          : preferredSource?.deviceId ?? visibleOptions[0].deviceId;

      if (currentDeviceId && nextDeviceId !== currentDeviceId && streamRef.current) {
        stopCurrentStream();
        setCameraState("fallback");
        setCameraError(
          kioskMode
            ? "Source Sony vừa đổi cổng hoặc bị ngắt. Hệ thống đang tự kết nối lại."
            : "Source trước đó đã đổi hoặc bị ngắt. Hãy chọn lại source camera.",
        );

        if (!kioskMode) {
          setIsPickerOpen(true);
        }
      }

      setSelectedDeviceId(nextDeviceId);
      return visibleOptions;
    } catch (error) {
      const message =
        error instanceof DOMException
          ? error.message
          : error instanceof Error
            ? error.message
            : "Không thể quét danh sách camera.";
      setVideoSources([]);
      setHiddenSourceLabels([]);
      setSelectedDeviceId(null);
      setPickerError(message);
      setCameraError(message);
      setCameraState("fallback");
      return [];
    } finally {
      setIsRefreshingSources(false);
    }
  }, [kioskMode, stopCurrentStream]);

  const connectToDevice = useCallback(async (
    deviceId: string | null,
    sourceList: VideoSourceOption[],
    options: SourceSelectionOptions = {},
  ) => {
    if (!deviceId || !navigator.mediaDevices?.getUserMedia) {
      setPickerError("Chưa có source nào được chọn.");
      return false;
    }

    setSelectedDeviceId(deviceId);
    selectedDeviceIdRef.current = deviceId;
    setCameraState("loading");
    setCameraError(null);
    setPickerError(null);

    try {
      stopCurrentStream();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: buildCameraTrackConstraints(deviceId),
        audio: false,
      });

      const selectedSource = sourceList.find((option) => option.deviceId === deviceId);
      await attachStream(stream, stream.getVideoTracks()[0]?.label || selectedSource?.label);
      setIsPickerOpen(false);
      return true;
    } catch (error) {
      const message =
        error instanceof DOMException
          ? error.message
          : error instanceof Error
            ? error.message
            : "Không thể mở source camera đã chọn.";
      setCameraState("fallback");
      setCameraError(message);
      setPickerError(message);
      if (options.openPickerOnFailure ?? !kioskMode) {
        setIsPickerOpen(true);
      }
      return false;
    }
  }, [attachStream, kioskMode, stopCurrentStream]);

  const connectSelectedCamera = useCallback(async () => {
    return connectToDevice(selectedDeviceId, videoSources, { openPickerOnFailure: true });
  }, [connectToDevice, selectedDeviceId, videoSources]);

  const autoConnectCamera = useCallback(async (requestPermission = false) => {
    const sources = await refreshVideoSources(requestPermission);
    if (!sources.length) {
      scheduleAutoReconnect(requestPermission);
      return false;
    }

    const preferredSource = pickPreferredVideoSource(sources);
    if (!preferredSource) {
      scheduleAutoReconnect(requestPermission);
      return false;
    }

    const currentStreamStillHealthy = Boolean(
      streamRef.current?.getVideoTracks().some((track) => track.readyState === "live"),
    );

    if (preferredSource.deviceId === selectedDeviceIdRef.current && currentStreamStillHealthy) {
      autoConnectAttemptRef.current = 0;
      setRetryCount(0);
      clearRetryTimeout();
      setCameraState("live");
      return true;
    }

    const didConnect = await connectToDevice(preferredSource.deviceId, sources, {
      openPickerOnFailure: debugMode,
    });

    if (!didConnect) {
      scheduleAutoReconnect(requestPermission);
      return false;
    }

    return true;
  }, [clearRetryTimeout, connectToDevice, debugMode, refreshVideoSources, scheduleAutoReconnect]);

  autoReconnectRef.current = autoConnectCamera;

  const spawnHeart = useCallback(() => {
    const id = nextTransientId();
    const heart: HeartParticle = {
      id,
      rightPct: 4 + Math.floor(Math.random() * 20),
      size: 14 + Math.floor(Math.random() * 18),
      color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
      targetY: -(140 + Math.floor(Math.random() * 110)),
      targetX: Math.floor((Math.random() - 0.5) * 50),
      duration: 1.8 + Math.random() * 0.7,
    };
    setHearts(prev => [...prev, heart]);
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 2800);
  }, [nextTransientId]);

  const spawnGift = useCallback(() => {
    const id = nextTransientId();
    const gift: GiftParticle = {
      id,
      rightPct: 8 + Math.floor(Math.random() * 18),
      emoji: GIFT_EMOJIS[Math.floor(Math.random() * GIFT_EMOJIS.length)],
      targetY: -(180 + Math.floor(Math.random() * 140)),
      targetX: Math.floor((Math.random() - 0.5) * 40),
      duration: 2 + Math.random() * 0.8,
      scale: 0.9 + Math.random() * 0.5,
    };
    setGifts(prev => [...prev, gift]);
    setTimeout(() => setGifts(prev => prev.filter(g => g.id !== id)), 3200);
  }, [nextTransientId]);

  const appendNextFeedComment = useCallback(() => {
    const idx = commentIndexRef.current;
    commentIndexRef.current = idx + 1;
    const next = COMMENT_POOL[idx % COMMENT_POOL.length];
    const id = nextTransientId();
    setFeedComments(prev => [...prev, { ...next, id }].slice(-MAX_VISIBLE_FEED_COMMENTS));
  }, [nextTransientId]);

  const spawnGiftBurst = useCallback(() => {
    const burstSize = kioskMode ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 3);
    const burstSpacingMs = kioskMode ? 110 + Math.floor(Math.random() * 70) : 55 + Math.floor(Math.random() * 55);

    for (let i = 0; i < burstSize; i += 1) {
      window.setTimeout(() => {
        spawnGift();
      }, i * burstSpacingMs);
    }

    setGiftCount((prev) => prev + burstSize + Math.floor(Math.random() * (kioskMode ? 2 : 4)) + 1);
  }, [kioskMode, spawnGift]);

  // Auto-spawn hearts
  useEffect(() => {
    if (isVideoPerformanceMode) return;
    const t = setInterval(spawnHeart, kioskMode ? 960 : 430);
    return () => clearInterval(t);
  }, [isVideoPerformanceMode, kioskMode, spawnHeart]);

  // Spawn compliment bubbles
  useEffect(() => {
    if (isVideoPerformanceMode) return;
    const t = setInterval(() => {
      const id = nextTransientId();
      const text = COMPLIMENT_TEXTS[Math.floor(Math.random() * COMPLIMENT_TEXTS.length)];
      const leftPct = 4 + Math.floor(Math.random() * 38);
      setCompliments(prev => [...prev, { id, text, leftPct }]);
      setTimeout(() => setCompliments(prev => prev.filter(c => c.id !== id)), kioskMode ? 2400 : 2900);
    }, kioskMode ? 4200 : 2100);
    return () => clearInterval(t);
  }, [isVideoPerformanceMode, kioskMode, nextTransientId]);

  // Viewer count drift up
  useEffect(() => {
    if (isVideoPerformanceMode) return;
    const t = setInterval(() => {
      setViewerCount(prev => prev + Math.floor(Math.random() * 3) + 1);
    }, kioskMode ? 4200 : 2700);
    return () => clearInterval(t);
  }, [isVideoPerformanceMode, kioskMode]);

  // Follow count drift up
  useEffect(() => {
    if (isVideoPerformanceMode) return;
    const t = setInterval(() => {
      setFollowCount(prev => prev + Math.floor(Math.random() * 7) + 2);
    }, kioskMode ? 3600 : 2300);
    return () => clearInterval(t);
  }, [isVideoPerformanceMode, kioskMode]);

  // Like count drift up
  useEffect(() => {
    if (isVideoPerformanceMode) return;
    const t = setInterval(() => {
      setLikeCount(prev => prev + Math.floor(Math.random() * 9) + 3);
    }, kioskMode ? 2100 : 1100);
    return () => clearInterval(t);
  }, [isVideoPerformanceMode, kioskMode]);

  // Gift stream + count drift up
  useEffect(() => {
    if (isVideoPerformanceMode) return;
    let timeoutId = 0;
    let cancelled = false;

    const queueNextBurst = () => {
      timeoutId = window.setTimeout(() => {
        spawnGiftBurst();
        if (Math.random() > (kioskMode ? 0.72 : 0.55)) {
          window.setTimeout(() => {
            spawnGift();
            setGiftCount(prev => prev + 1);
          }, (kioskMode ? 140 : 90) + Math.floor(Math.random() * 90));
        }

        if (!cancelled) {
          queueNextBurst();
        }
      }, (kioskMode ? 1200 : 520) + Math.floor(Math.random() * (kioskMode ? 460 : 360)));
    };

    queueNextBurst();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isVideoPerformanceMode, kioskMode, spawnGift, spawnGiftBurst]);

  // Rotating chat comments praising Sony image quality
  useEffect(() => {
    if (isVideoPerformanceMode) return;
    let timeoutId = 0;
    let cancelled = false;

    const queueNextComment = () => {
      timeoutId = window.setTimeout(() => {
        appendNextFeedComment();

        if (Math.random() > (kioskMode ? 0.82 : 0.65)) {
          window.setTimeout(() => {
            appendNextFeedComment();
          }, (kioskMode ? 260 : 180) + Math.floor(Math.random() * 180));
        }

        if (!cancelled) {
          queueNextComment();
        }
      }, (kioskMode ? 1400 : 820) + Math.floor(Math.random() * (kioskMode ? 700 : 520)));
    };

    queueNextComment();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [appendNextFeedComment, isVideoPerformanceMode, kioskMode]);

  useEffect(() => {
    if (!isVideoPerformanceMode) return;
    setHearts([]);
    setCompliments([]);
  }, [isVideoPerformanceMode]);

  // Hidden control panel toggle (Ctrl/Cmd only)
  useEffect(() => {
    if (kioskMode && !debugMode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Control" || event.key === "Meta") && !event.repeat) {
        setShowControlPanel(prev => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [debugMode, kioskMode]);

  useEffect(() => {
    if (kioskMode) {
      setIsPickerOpen(false);
      void autoConnectCamera(true);
    } else {
      void refreshVideoSources(true);
      setIsPickerOpen(true);
    }

    return () => {
      clearRetryTimeout();
      stopCurrentStream();
    };
  }, [autoConnectCamera, clearRetryTimeout, kioskMode, refreshVideoSources, stopCurrentStream]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;

    const handleDeviceChange = () => {
      if (kioskMode) {
        void autoConnectCamera(false);
        return;
      }

      void refreshVideoSources(false);
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, [autoConnectCamera, kioskMode, refreshVideoSources]);

  const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
  const sourceTransform = `translate(-50%, -50%) rotate(${sourceRotation}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`;
  const frameTransform = frameRotate90 ? "rotate(90deg) scale(1.78)" : "none";
  const fittedVideoFrameSize = getFittedVideoFrameSize(phoneViewportSize, sourceFrameSize, sourceRotation);
  const interactionEnabled = !kioskMode || debugMode;
  const shouldSurfaceCompactCameraError = cameraState === "fallback" && retryCount >= KIOSK_CAMERA_ERROR_THRESHOLD;
  const cameraBadgeText =
    cameraState === "live"
      ? `${cameraLabel} ● LIVE`
      : cameraState === "loading"
        ? "ĐANG KẾT NỐI CAMERA..."
        : cameraState === "idle"
          ? kioskMode
            ? "ĐANG KHỞI TẠO KIOSK CAMERA"
            : "CHỌN SOURCE CAMERA"
          : "KHÔNG CÓ TÍN HIỆU CAMERA";

  return (
    <motion.div
      className="relative flex-shrink-0 origin-top"
      data-testid="phone-mockup"
      data-kiosk-mode={kioskMode ? "true" : "false"}
      data-debug-mode={debugMode ? "true" : "false"}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring.smooth, delay: 0.2 }}
    >
      {/* ── Phone shell ── */}
      <div
        className="relative"
        style={{
          width: `${PHONE_SHELL_WIDTH_PX}px`,
          height: `${PHONE_SHELL_HEIGHT_PX}px`,
        }}
      >
        <AnimatePresence>
          {isPickerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              data-testid="video-source-picker"
              className="absolute inset-0 z-[140] flex items-start justify-center rounded-[38px] bg-[#04070d]/58 px-5 pb-5 pt-[72px] backdrop-blur-md"
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="max-h-full w-full overflow-y-auto rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(17,24,45,0.96)_0%,rgba(8,12,24,0.95)_100%)] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.65)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                      Video Source Picker
                    </p>
                    <h3 className="mt-1 text-[22px] font-black leading-tight text-white">
                      Chọn camera cho Showcase
                    </h3>
                    <p className="mt-2 text-[11px] leading-relaxed text-white/65">
                      {kioskMode
                        ? "Debug mode đang mở picker thủ công. Kiosk vẫn ưu tiên Sony USB Livestream và tự khôi phục source nền."
                        : "Mỗi lần truy cập Showcase sẽ hiện hộp chọn này. App đang ưu tiên Sony USB Livestream và tự ẩn các source ảo dễ gây nhầm."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshVideoSources(true)}
                    disabled={isRefreshingSources}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/80 transition hover:bg-white/[0.12] hover:text-white disabled:cursor-wait disabled:opacity-50"
                    aria-label="Quét lại source camera"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRefreshingSources ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="mt-4 space-y-2.5">
                  {videoSources.map(source => {
                    const active = selectedDeviceId === source.deviceId;

                    return (
                      <label
                        key={source.deviceId}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                          active
                            ? "border-cyan-300/32 bg-cyan-400/8 shadow-[0_0_0_1px_rgba(103,232,249,0.16)]"
                            : "border-white/10 bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="video-source"
                          className="mt-1 h-4 w-4 accent-cyan-400"
                          checked={active}
                          onChange={() => setSelectedDeviceId(source.deviceId)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[12px] font-semibold text-white">{source.label}</p>
                            {source.recommended && (
                              <span className="rounded-full border border-cyan-300/18 bg-cyan-400/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[10px] text-white/55">{source.note}</p>
                        </div>
                      </label>
                    );
                  })}

                  {!videoSources.length && !isRefreshingSources && (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-3 text-[11px] leading-relaxed text-amber-100/90">
                      Không có source khả dụng. Bật chế độ USB Livestream trên máy ảnh Sony rồi bấm quét lại.
                    </div>
                  )}
                </div>

                {!!hiddenSourceLabels.length && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      Hidden Sources
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-white/55">
                      Đã ẩn {hiddenSourceLabels.length} source ảo/xung đột để tránh chọn nhầm:
                      {" "}
                      {hiddenSourceLabels.join(", ")}.
                    </p>
                  </div>
                )}

                {pickerError && (
                  <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-3 py-2.5">
                    <p className="text-[10px] leading-relaxed text-amber-100/90">{pickerError}</p>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshVideoSources(true)}
                    disabled={isRefreshingSources}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[11px] font-semibold text-white/85 transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-50"
                  >
                    Cấp quyền & quét lại
                  </button>
                  <button
                    type="button"
                    onClick={() => void connectSelectedCamera()}
                    disabled={!selectedDeviceId || isRefreshingSources}
                    className="inline-flex flex-[1.2] items-center justify-center rounded-2xl bg-cyan-300 px-3 py-2.5 text-[11px] font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/35"
                  >
                    Dùng source đã chọn
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {showControlPanel && (
            <motion.div
              initial={{ opacity: 0, x: -320, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -280, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="absolute left-4 top-1/2 z-[120] w-[260px] -translate-y-1/2 rounded-2xl border border-white/20 bg-black/80 p-3 backdrop-blur-md"
              data-testid="preview-control-panel"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">Preview Control</p>
              <p className="mt-1 text-[10px] text-white/55">
                {interactionEnabled ? "Toggle panel: Ctrl / Cmd" : "Kiosk locked"}
              </p>
              <p className="mt-1 text-[10px] text-white/70">Active source: {cameraLabel}</p>
              {bootTimestamp && <p className="mt-1 text-[10px] text-white/55">Last boot: {bootTimestamp}</p>}
              {lastCameraConnectedAt && (
                <p className="mt-1 text-[10px] text-white/55">Last camera live: {lastCameraConnectedAt}</p>
              )}
              {kioskMode && <p className="mt-1 text-[10px] text-white/55">Auto reconnect attempts: {retryCount}</p>}
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-2 py-1.5 text-[10px] font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
              >
                Mở lại source picker
              </button>

              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="text-[10px] font-semibold text-white/75">Rotate source</span>
                  <select
                    id="rotate-source"
                    name="rotate-source"
                    value={String(sourceRotation)}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setSourceRotation(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#0e1118] px-2 py-1.5 text-[11px] text-white outline-none"
                  >
                    <option value="0">0°</option>
                    <option value="90">90°</option>
                    <option value="180">180°</option>
                    <option value="270">270°</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e1118] px-2 py-1.5 text-[10px] text-white/90">
                    <input id="flip-horizontal" name="flip-horizontal" type="checkbox" checked={flipHorizontal} onChange={(e: ChangeEvent<HTMLInputElement>) => setFlipHorizontal(e.target.checked)} />
                    Flip H
                  </label>
                  <label className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0e1118] px-2 py-1.5 text-[10px] text-white/90">
                    <input id="flip-vertical" name="flip-vertical" type="checkbox" checked={flipVertical} onChange={(e: ChangeEvent<HTMLInputElement>) => setFlipVertical(e.target.checked)} />
                    Flip V
                  </label>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0e1118] px-2 py-1.5 text-[10px] text-white/90">
                  <input id="rotate-frame-90" name="rotate-frame-90" type="checkbox" checked={frameRotate90} onChange={(e: ChangeEvent<HTMLInputElement>) => setFrameRotate90(e.target.checked)} />
                  Rotate frame 90°
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-none absolute -inset-7 rounded-[48px] bg-[radial-gradient(circle_at_16%_22%,rgba(86,198,213,0.22),rgba(86,198,213,0.06)_34%,transparent_66%)] blur-3xl" />
        <div className="pointer-events-none absolute -inset-8 rounded-[52px] bg-[radial-gradient(circle_at_78%_72%,rgba(152,53,128,0.18),rgba(152,53,128,0.05)_30%,transparent_66%)] blur-3xl" />
        <div className="pointer-events-none absolute -inset-[1px] rounded-[40px] border border-white/16 shadow-[0_0_0_1px_rgba(198,221,255,0.16),0_0_24px_rgba(44,194,209,0.12)]" />
        <div className="pointer-events-none absolute inset-[2px] rounded-[36px] border border-white/7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.04)]" />
        <motion.div
          className="pointer-events-none absolute -left-8 -right-8 top-1 z-10 h-11 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18),rgba(255,255,255,0.02)_55%,transparent_72%)] blur-md"
          animate={reduceAmbientEffects ? undefined : { opacity: [0.32, 0.55, 0.32] }}
          transition={reduceAmbientEffects ? undefined : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={reduceAmbientEffects ? { opacity: 0.24 } : undefined}
        />

        <div className="relative h-full w-full overflow-hidden rounded-[36px] border-[6px] border-[#0f1116] bg-[linear-gradient(180deg,#10131a_0%,#080a0f_100%)] shadow-[0_34px_120px_rgba(0,0,0,0.92),0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="pointer-events-none absolute inset-[3px] rounded-[30px] border border-white/6 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(255,255,255,0.03)]" />
        <div className="pointer-events-none absolute left-[2px] top-36 z-40 h-20 w-[2px] rounded-full bg-neutral-500/25" />
        <div className="pointer-events-none absolute right-[1px] top-36 z-40 h-10 w-[3px] rounded-l-full bg-neutral-400/35" />
        <div className="pointer-events-none absolute right-[1px] top-[198px] z-40 h-24 w-[3px] rounded-l-full bg-neutral-400/35" />
        <div className="pointer-events-none absolute right-[1px] top-[336px] z-40 h-14 w-[4px] rounded-l-full bg-neutral-400/40" />

        {/* ── Camera feed ── */}
        <div ref={phoneViewportRef} className="absolute inset-0 overflow-hidden bg-black">
          <div className="absolute inset-0" style={{ transform: frameTransform, transformOrigin: "center center" }}>
            <video
              ref={videoRef}
              className={`absolute left-1/2 top-1/2 max-w-none object-cover transition-opacity duration-300 ${
                cameraState === "live" ? "opacity-100" : "opacity-0"
              }`}
              style={{
                width: `${fittedVideoFrameSize.width}px`,
                height: `${fittedVideoFrameSize.height}px`,
                transform: sourceTransform,
              }}
              onLoadedData={syncVideoFrameSize}
              onLoadedMetadata={syncVideoFrameSize}
              autoPlay
              muted
              playsInline
            />
          </div>

          {/* Gradient fallback */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              cameraState === "live" ? "opacity-0" : "opacity-100"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-amber-950 via-stone-950 to-slate-950" />
            <div className="absolute -top-12 right-0 h-64 w-64 rounded-full bg-orange-700/30 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-56 w-full bg-gradient-to-t from-blue-950/60 to-transparent" />
          </div>

          {/* Enhanced bokeh particles */}
          {!reduceAmbientEffects && ([
            { w:100, h:100, l:'10%', t:'15%', c:'#fbbf24', dur:4.5 },
            { w:70,  h:70,  l:'55%', t:'8%',  c:'#f97316', dur:5.5 },
            { w:120, h:120, l:'2%',  t:'35%', c:'#fcd34d', dur:6.5 },
            { w:80,  h:80,  l:'65%', t:'28%', c:'#fb923c', dur:5.0 },
            { w:60,  h:60,  l:'35%', t:'48%', c:'#fef08a', dur:5.8 },
            { w:110, h:110, l:'18%', t:'58%', c:'#fed7aa', dur:4.0 },
            { w:50,  h:50,  l:'72%', t:'50%', c:'#fda4af', dur:5.2 },
          ] as const).map((b, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full blur-2xl"
              style={{ width:b.w, height:b.h, left:b.l, top:b.t, background:b.c, opacity:0.15 }}
              animate={{ x:[0,10,-6,0], y:[0,-8,5,0], opacity:[0.12,0.25,0.12] }}
              transition={{ duration:b.dur, repeat:Infinity, ease:'easeInOut' }}
            />
          ))}

          {(cameraError && (!kioskMode || shouldSurfaceCompactCameraError)) && (
            <div className="pointer-events-none absolute left-4 right-4 top-[86px] rounded-xl border border-amber-300/20 bg-black/45 px-3 py-1.5 backdrop-blur-sm">
              <p className="line-clamp-2 text-[10px] font-medium text-amber-200/90">Camera: {cameraError}</p>
            </div>
          )}
        </div>

        {/* Bottom gradient for readability */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-gradient-to-b from-black/34 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none z-10" />
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 h-1 w-28 -translate-x-1/2 rounded-full bg-white/60" />

        {/* ── TOP BAR ── */}
        <div className="absolute left-0 right-0 top-0 z-30 px-5 pt-[16px]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_10px_30px_rgba(239,68,68,0.35)]">
                  Live
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-white/14 bg-black/48 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
                  <span className="h-2 w-2 rounded-full bg-white/85" />
                  {fmt(viewerCount)}
                </span>
                <span className="rounded-full border border-white/14 bg-black/42 px-2.5 py-1 text-[10px] font-semibold text-teal-200 backdrop-blur-sm">
                  Follow {fmt(followCount)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/35 bg-black/40 shadow-lg">
                  <span className="absolute inset-0 z-10 flex items-center justify-center text-[20px] font-bold text-[#f97316] font-serif select-none leading-none">α</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold leading-none drop-shadow-lg">@sony.vietnam</div>
                  <div
                    className="mt-1 text-[10px] text-white/64"
                    data-testid="camera-badge"
                    data-camera-state={cameraState}
                    data-camera-label={cameraLabel}
                  >
                    {cameraBadgeText}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 pt-0.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/14 bg-black/42 text-lg font-light text-white/90 backdrop-blur-sm">
                ×
              </div>
            </div>
          </div>
        </div>

        {/* ── FLOATING COMPLIMENTS ── */}
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          <AnimatePresence>
            {compliments.map(c => (
              <motion.div
                key={c.id}
                className="absolute"
                style={{ left:`${c.leftPct}%`, bottom:180 }}
                initial={{ y:0, opacity:0, scale:0.8 }}
                animate={{ y:-150, opacity:[0,1,1,0], scale:[0.8,1,1,0.9] }}
                exit={{ opacity:0 }}
                transition={{ duration:2.8, ease:'easeOut', times:[0,0.1,0.7,1] }}
              >
                <div className="bg-black/30 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow-xl">
                  {c.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── HEART & GIFT STREAM ── */}
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          <AnimatePresence>
            {hearts.map(heart => (
              <motion.div
                key={heart.id}
                className="absolute"
                style={{ right: `${heart.rightPct}%`, bottom: 90, color: heart.color, fontSize: heart.size }}
                initial={{ y: 0, x: 0, opacity: 0, scale: 0.8 }}
                animate={{ y: heart.targetY, x: heart.targetX, opacity: [0, 1, 1, 0], scale: [0.8, 1.1, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: heart.duration, ease: "easeOut", times: [0, 0.2, 0.8, 1] }}
              >
                ❤
              </motion.div>
            ))}
          </AnimatePresence>
          <AnimatePresence>
            {gifts.map(gift => (
              <motion.div
                key={gift.id}
                className="absolute drop-shadow-[0_0_10px_rgba(255,255,255,0.35)]"
                style={{ right: `${gift.rightPct}%`, bottom: 110, fontSize: 20 }}
                initial={{ y: 0, x: 0, opacity: 0, scale: 0.8 }}
                animate={{ y: gift.targetY, x: gift.targetX, opacity: [0, 1, 1, 0], scale: [0.8, gift.scale, 0.9] }}
                exit={{ opacity: 0 }}
                transition={{ duration: gift.duration, ease: "easeOut", times: [0, 0.15, 0.75, 1] }}
              >
                {gift.emoji}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── LIVE COMMENTS ── */}
        <div className="absolute bottom-8 left-5 right-5 z-30 flex flex-col gap-1.5">
          <AnimatePresence mode="popLayout">
            {feedComments.map(comment => (
              <motion.div
                key={comment.id}
                layout
                data-testid="live-comment-item"
                className="flex items-center gap-2"
                initial={{ opacity:0, x:-16, y:10 }}
                animate={{ opacity:1, x:0, y:0 }}
                exit={{ opacity:0, x:-10, scale:0.95 }}
                transition={{ duration:0.28 }}
              >
                <div className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 backdrop-blur-sm">
                  <img
                    src={comment.avatar}
                    alt={comment.user}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    onError={(e: SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="z-10 text-[9px] font-bold text-white">{comment.user[0]}</span>
                </div>
                <div className="min-w-0 max-w-[250px] rounded-2xl bg-black/30 px-3 py-1.5 backdrop-blur-sm">
                  <span className={`text-[10px] font-bold ${comment.color}`}>{comment.user}</span>
                  <span className="ml-1 text-[10px] text-white/90">{comment.text}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── RIGHT ACTION BUTTONS ── */}
          <div className="absolute bottom-[124px] right-3 z-30 flex flex-col items-center gap-4">
          {/* Enhanced Like */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/14 bg-[linear-gradient(180deg,rgba(31,37,54,0.92),rgba(12,14,21,0.96))] shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
              whileHover={interactionEnabled ? { scale:1.2, rotate:5 } : undefined}
              whileTap={interactionEnabled ? { scale:0.8 } : undefined}
              onClick={() => {
                for (let i = 0; i < 7; i++) setTimeout(spawnHeart, i * 75);
                setLikeCount(p => p + 1);
              }}
              transition={spring.bouncy}
            >
              <span className="text-2xl">❤️</span>
            </motion.button>
            <motion.span
              key={likeCount}
              className="text-white text-[10px] font-bold tabular-nums drop-shadow-lg"
              initial={{ scale:1.8, color:'#fb7185' }}
              animate={{ scale:1, color:'#ffffff' }}
              transition={{ duration:0.25 }}
            >
              {fmt(likeCount)}
            </motion.span>
          </div>

          {/* Gift button */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-[linear-gradient(180deg,rgba(31,37,54,0.92),rgba(12,14,21,0.96))] shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
              whileHover={interactionEnabled ? { scale:1.15, rotate:-8 } : undefined}
              whileTap={interactionEnabled ? { scale:0.85 } : undefined}
              onClick={() => {
                for (let i = 0; i < 4; i++) setTimeout(spawnGift, i * 90);
                setGiftCount(prev => prev + 2);
              }}
              transition={spring.bouncy}
            >
              <span className="text-xl">🎁</span>
            </motion.button>
            <motion.span
              key={giftCount}
              data-testid="gift-count"
              data-count={giftCount}
              className="text-[10px] font-bold tabular-nums text-white drop-shadow-lg"
              initial={{ scale:1.5, color:"#fcd34d" }}
              animate={{ scale:1, color:"#ffffff" }}
              transition={{ duration:0.25 }}
            >
              {fmt(giftCount)}
            </motion.span>
          </div>
        </div>

        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Showcase Page ───────────────────────────────────────────────────────
export function LivestreamShowcasePage({ onExit }: { onExit?: () => void } = {}) {
  const [runtimeFlags] = useState<ShowcaseRuntimeFlags>(() => readShowcaseRuntimeFlags());
  const [isExiting, setIsExiting] = useState(false);
  const [isVideoSlideFocused, setIsVideoSlideFocused] = useState(false);
  const [bootTimestamp, setBootTimestamp] = useState<string | null>(null);
  const [mainAppSopUrl] = useState(() => buildMainAppUrl("/livestream"));
  const { kioskMode, debugMode } = runtimeFlags;

  useEffect(() => {
    if (!kioskMode) return;
    const now = new Date().toISOString();
    writeLastBootAt(now);
    setBootTimestamp(now);
  }, [kioskMode]);

  const exitToSop = useCallback(() => {
    if (kioskMode) return;

    setIsExiting(true);
    setTimeout(() => {
      if (onExit) {
        onExit();
      } else {
        window.location.assign(mainAppSopUrl);
      }
    }, 260);
  }, [kioskMode, mainAppSopUrl, onExit]);

  // ESC key handler
  useEffect(() => {
    if (kioskMode) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        exitToSop();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [exitToSop, kioskMode]);

  return (
    <AnimatePresence mode="wait">
      {!isExiting && (
        <motion.div
          className="showcase-stage absolute inset-0 overflow-hidden non-critical"
          data-testid="showcase-root"
          data-kiosk-mode={kioskMode ? "true" : "false"}
          data-debug-mode={debugMode ? "true" : "false"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="relative h-full w-full y2k-grid-bg">
            <div className="y2k-laser-grid" />
            <div className="showcase-stage__grain" />
            <div className={`pointer-events-none absolute -left-[18%] top-[52%] z-[1] h-[48rem] w-[48rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(45,193,196,0.22)_0%,rgba(45,193,196,0.06)_36%,transparent_66%)] blur-3xl ${kioskMode ? "opacity-75" : ""}`} />
            <div className={`pointer-events-none absolute right-[-10%] top-[18%] z-[1] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(144,40,119,0.22)_0%,rgba(144,40,119,0.06)_34%,transparent_70%)] blur-3xl ${kioskMode ? "opacity-70" : ""}`} />
            {!kioskMode && (
              <div className="pointer-events-none absolute bottom-[-24%] left-[12%] z-[1] h-[24rem] w-[48rem] rounded-full border border-cyan-200/10 bg-[radial-gradient(ellipse_at_center,rgba(92,247,255,0.12)_0%,rgba(92,247,255,0.02)_40%,transparent_74%)] blur-2xl" />
            )}
            <AsciiRecBackground kioskMode={kioskMode} videoFocused={isVideoSlideFocused} className="absolute inset-0 z-[1] opacity-75" />

            <div className="showcase-stage__brand-mark" aria-hidden="true">
              <span>SONY STUDIO</span>
              <span>LIVESTREAM</span>
            </div>

            <div className="relative z-10 mx-auto flex h-full w-full max-w-[1600px] items-center justify-center px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
              <div className="grid h-full w-full grid-cols-1 items-center gap-y-8 lg:grid-cols-[38.2%_61.8%] lg:gap-x-10 xl:gap-x-14 2xl:gap-x-18">
                <div className="relative flex h-full items-center justify-center overflow-visible lg:justify-end">
                  <div className="showcase-phone-stage relative scale-[0.82] lg:scale-[0.88] xl:scale-[0.92] lg:translate-y-[8px] xl:translate-y-[12px]">
                    <PhoneMockup
                      bootTimestamp={bootTimestamp}
                      kioskMode={kioskMode}
                      debugMode={debugMode}
                      performanceMode={isVideoSlideFocused ? "video" : "normal"}
                    />
                  </div>
                </div>
                <div className="relative flex h-full items-center justify-center lg:pr-10 xl:pr-16 2xl:pr-20">
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="w-full max-w-[1020px]">
                      <SonyLiveReasonsPanel kioskMode={kioskMode} onVideoFocusChange={setIsVideoSlideFocused} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
