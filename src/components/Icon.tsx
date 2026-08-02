/**
 * The app's icon set, backed by lucide-react.
 *
 * This replaces Google's Material Symbols, which arrived as a render-blocking
 * third-party stylesheet plus an icon font — a request to fonts.googleapis.com
 * on every load, for a tool that is used at events on hotel wifi. Nothing here
 * leaves the bundle now, and it matches CheeseBooth, which was already on
 * lucide.
 *
 * Icons render at `1em`, deliberately. Material Symbols are glyphs, so their
 * size came from whatever font-size class sat on the span — `text-[18px]`,
 * `text-2xl`, `text-5xl`. An SVG normally ignores those. Sizing at 1em makes
 * the SVG track font-size exactly like the glyph did, so every existing
 * sizing class at every call site keeps working untouched and this swap is not
 * also a layout change.
 *
 * The keys are the original Material Symbol names. Keeping them means the data
 * arrays that carry an icon name as a string (Layout's nav, FAQSection,
 * ChecklistSection …) did not have to change either, and `IconName` makes a
 * typo a compile error rather than an empty square at an event.
 */

import {
  Activity,
  ArrowRight,
  AudioLines,
  BatteryCharging,
  Bot,
  Building2,
  Cable,
  Camera,
  Check,
  CircleAlert,
  CircleCheck,
  CirclePlus,
  Compass,
  Cpu,
  Droplet,
  FileText,
  FolderOpen,
  Gauge,
  Headphones,
  Info,
  Layers,
  Lightbulb,
  Link as LinkIcon,
  ListChecks,
  Mic,
  Monitor,
  Palette,
  Pipette,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Router,
  ScrollText,
  Send,
  Settings,
  Settings2,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Smartphone,
  Sparkles,
  SquareTerminal,
  Star,
  Thermometer,
  Trash2,
  TriangleAlert,
  User,
  Video,
  Wand2,
  Wrench,
  ChevronDown,
  ScanFace,
  Trash,
  Music,
  GitCompareArrows,
  Aperture,
  Speech,
  Zap,
  Copy,
  Clapperboard,
  Gem,
  MemoryStick,
  CircuitBoard,
  Videotape,
  Timer,
  VolumeX,
  PencilRuler,
  Sunset,
} from 'lucide-react'

/** Material Symbol name -> lucide component. */
const ICONS = {
  add_circle: CirclePlus,
  admin_panel_settings: ShieldCheck,
  arrow_forward: ArrowRight,
  assignment_turned_in: ListChecks,
  assistant: Sparkles,
  auto_awesome: Sparkles,
  battery_charging_full: BatteryCharging,
  blur_on: Droplet,
  build: Wrench,
  cable: Cable,
  check: Check,
  check_circle: CircleCheck,
  colorize: Pipette,
  compare: GitCompareArrows,
  computer: Monitor,
  delete: Trash2,
  delete_sweep: Trash,
  done: Check,
  equalizer: AudioLines,
  expand_more: ChevronDown,
  face: ScanFace,
  flare: Sparkles,
  folder_open: FolderOpen,
  graphic_eq: Activity,
  info: Info,
  lens: Aperture,
  lightbulb: Lightbulb,
  link: LinkIcon,
  magic_button: Wand2,
  mic: Mic,
  music_video: Music,
  palette: Palette,
  person: User,
  photo_camera: Camera,
  picture_as_pdf: FileText,
  play_arrow: Play,
  psychology: Bot,
  psychology_alt: Bot,
  receipt_long: ScrollText,
  router: Router,
  send: Send,
  send_to_mobile: Smartphone,
  settings: Settings,
  settings_suggest: Settings2,
  shopping_bag: ShoppingBag,
  smart_toy: Bot,
  spatial_tracking: Radar,
  support_agent: Headphones,
  sync: RefreshCw,
  terminal: SquareTerminal,
  thermostat: Thermometer,
  travel_explore: Compass,
  tune: Sliders,
  verified: Star,
  videocam: Video,
  view_in_ar: Layers,
  warning: TriangleAlert,
  // Referenced by data but not currently rendered anywhere; kept so the union
  // stays a superset of what the content modules may hold.
  mail: Send,
  gauge: Gauge,
  cpu: Cpu,
  building: Building2,
  plus: Plus,
  share: Share2,
  alert: CircleAlert,
  sliders: Sliders,
  speech: Speech,
  bolt: Zap,
  content_copy: Copy,
  auto_videocam: Videotape,
  diamond: Gem,
  movie: Clapperboard,
  memory: MemoryStick,
  developer_board: CircuitBoard,
  timer: Timer,
  volume_off: VolumeX,
  rebase_edit: PencilRuler,
  wb_twilight: Sunset,
} as const

export type IconName = keyof typeof ICONS

export interface IconProps {
  name: IconName
  className?: string
  /** Decorative by default. Pass a label when the icon is the only content. */
  label?: string
}

export function Icon({ name, className, label }: IconProps) {
  const Glyph = ICONS[name]

  return (
    <Glyph
      className={className}
      // Track font-size, exactly as the Material glyph did.
      width="1em"
      height="1em"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
