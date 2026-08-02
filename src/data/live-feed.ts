/**
 * Mock data for the simulated TikTok live feed in the phone mock-up — the
 * comments, hearts, compliments and gifts that make the demo look alive.
 *
 * None of it is real: it exists so a salesperson can show the SOP without an
 * audience. Kept apart from the page so nobody mistakes it for live data.
 */

export interface FeedComment {
  id: number;
  user: string;
  text: string;
  color: string;
  avatar: string;
}

export const HEART_COLORS = ['#ff6b6b', '#ff8787', '#ff6b9d', '#c44569', '#f8b500', '#ff6b35'];

export const COMPLIMENT_TEXTS = [
  "Sony lên màu đẹp quá! 📸",
  "Hình Sony nét căng luôn! ✨",
  "Màu da từ Sony nhìn xịn ghê 🎬",
  "Chất lượng hình ảnh quá pro! 🔥",
  "Sony stream đẹp khỏi chỉnh 🎥",
  "Dynamic range đỉnh thật 🌟",
  "Màu cinematic quá đã mắt 🎨",
  "Ảnh Sony quá mượt luôn 🚀",
];

export function generateSvgAvatar(initial: string, bgColor: string) {
  return `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='${encodeURIComponent(bgColor)}'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui, sans-serif' font-weight='bold' font-size='14' fill='%23ffffff'%3E${initial}%3C/text%3E%3C/svg%3E`;
}

export const COMMENT_POOL: FeedComment[] = [
  {
    id: 0,
    user: "Minh Pro",
    text: "Màu Sony đẹp quá, da người lên cực mịn!",
    color: "text-info-soft",
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
    color: "text-warning-soft",
    avatar: generateSvgAvatar("H", "#eab308"),
  },
  {
    id: 3,
    user: "Khanh Film",
    text: "Tone màu cinematic, xem đã mắt ghê.",
    color: "text-success-soft",
    avatar: generateSvgAvatar("K", "#4ade80"),
  },
  {
    id: 4,
    user: "An Creator",
    text: "Chất lượng hình ảnh Sony đúng là khác biệt!",
    color: "text-accent-mid",
    avatar: generateSvgAvatar("A", "#c084fc"),
  },
  {
    id: 5,
    user: "Trung Live",
    text: "Chi tiết quá tốt, zoom vẫn nét căng.",
    color: "text-warning-soft",
    avatar: generateSvgAvatar("T", "#fb923c"),
  },
  {
    id: 6,
    user: "Mai Visual",
    text: "Sony stream mà tưởng quay hậu kỳ rồi.",
    color: "text-info-soft",
    avatar: generateSvgAvatar("M", "#60a5fa"),
  },
];

export const GIFT_EMOJIS = ["🎁", "🌹", "💎", "🏆", "🔥", "🚀", "💐", "⭐"];
