/**
 * The ten reasons the showcase argues for a Sony body, as data.
 *
 * Lifted out of LivestreamShowcasePage.tsx, where 242 lines of copy sat in the
 * middle of a camera state machine. Content changes far more often than the
 * runtime around it, and an editor should not have to scroll past
 * `getUserMedia` to fix a typo.
 *
 * `icon` holds the component itself rather than a name string so a wrong icon
 * is a type error instead of a blank square at an event.
 */

import {
  Cable,
  Camera,
  Gauge,
  Lightbulb,
  Mic,
  Settings,
  Sliders,
  Star,
  TriangleAlert,
  Zap,
} from "lucide-react";

import { getYouTubeThumbnailUrl } from "../lib/youtube";

export interface SonyReason {
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

export const SONY_LIVE_REASONS: SonyReason[] = [
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
