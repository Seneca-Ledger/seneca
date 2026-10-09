/**
 * Icon compatibility layer: maps Lucide icon names to MUI equivalents.
 *
 * Adapts the Lucide API to MUI:
 *   - `size` prop  → `sx.fontSize`
 *   - `color` prop → `sx.color`  (supports hex strings, not just theme tokens)
 *   - `strokeWidth` prop → silently dropped (MUI icons are filled, not stroke-based)
 *
 * Usage: replace `from '@/app/components/icons'` with `from '@/app/components/icons'`
 */

import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ArticleIcon from '@mui/icons-material/Article';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import BalanceIcon from '@mui/icons-material/Balance';
import BarChartIcon from '@mui/icons-material/BarChart';
import BlockIcon from '@mui/icons-material/Block';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import BookIcon from '@mui/icons-material/Book';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import CalculateIcon from '@mui/icons-material/Calculate';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import CancelIcon from '@mui/icons-material/Cancel';
import CardGiftcardOutlinedIcon from '@mui/icons-material/CardGiftcardOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CircleIcon from '@mui/icons-material/Circle';
import CloseIcon from '@mui/icons-material/Close';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DateRangeIcon from '@mui/icons-material/DateRange';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import DirectionsCarOutlinedIcon from '@mui/icons-material/DirectionsCarOutlined';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import DownloadIcon from '@mui/icons-material/Download';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EmailIcon from '@mui/icons-material/Email';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExploreIcon from '@mui/icons-material/Explore';
import ExtensionIcon from '@mui/icons-material/Extension';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FilterListIcon from '@mui/icons-material/FilterList';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import FlagIcon from '@mui/icons-material/Flag';
import FlightOutlinedIcon from '@mui/icons-material/FlightOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import ForwardToInboxIcon from '@mui/icons-material/ForwardToInbox';
import GridViewIcon from '@mui/icons-material/GridView';
import GroupIcon from '@mui/icons-material/Group';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import MuiImageIcon from '@mui/icons-material/Image';
import InboxIcon from '@mui/icons-material/Inbox';
import InfoIcon from '@mui/icons-material/Info';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LaptopOutlinedIcon from '@mui/icons-material/LaptopOutlined';
import LayersIcon from '@mui/icons-material/Layers';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import LocalCafeOutlinedIcon from '@mui/icons-material/LocalCafeOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LockIcon from '@mui/icons-material/Lock';
import LogoutIcon from '@mui/icons-material/Logout';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import MemoryIcon from '@mui/icons-material/Memory';
import MenuIcon from '@mui/icons-material/Menu';
import MonitorIcon from '@mui/icons-material/Monitor';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MusicNoteOutlinedIcon from '@mui/icons-material/MusicNoteOutlined';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import NorthEastIcon from '@mui/icons-material/NorthEast';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import OutletIcon from '@mui/icons-material/Outlet';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import PaletteIcon from '@mui/icons-material/Palette';
import PaymentsIcon from '@mui/icons-material/Payments';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import PersonIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PetsOutlinedIcon from '@mui/icons-material/PetsOutlined';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PieChartIcon from '@mui/icons-material/PieChart';
import PlaceIcon from '@mui/icons-material/Place';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import PrintIcon from '@mui/icons-material/Print';
import PublicIcon from '@mui/icons-material/Public';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined';
import SaveIcon from '@mui/icons-material/Save';
import PiggyBankIcon from '@mui/icons-material/Savings';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import SecurityIcon from '@mui/icons-material/Security';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import ShareIcon from '@mui/icons-material/Share';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SortIcon from '@mui/icons-material/Sort';
import SouthEastIcon from '@mui/icons-material/SouthEast';
import SouthWestIcon from '@mui/icons-material/SouthWest';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StorageIcon from '@mui/icons-material/Storage';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import TableChartIcon from '@mui/icons-material/TableChart';
import TabletIcon from '@mui/icons-material/Tablet';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TuneIcon from '@mui/icons-material/Tune';
import UndoIcon from '@mui/icons-material/Undo';
import UploadIcon from '@mui/icons-material/Upload';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import type { SvgIconProps } from '@mui/material';
import React from 'react';

// ---------------------------------------------------------------------------
// Compat prop types (mirror Lucide's API)
// ---------------------------------------------------------------------------

export interface LucideProps extends Omit<SvgIconProps, 'color' | 'fontSize'> {
  /** Lucide size → MUI sx.fontSize */
  size?: number | string;
  /** Supports hex colors in addition to MUI theme tokens */
  color?: string;
  /** Lucide stroke weight – no-op for MUI filled icons */
  strokeWidth?: number;
}

export type LucideIcon = React.FC<LucideProps>;

// ---------------------------------------------------------------------------
// Wrapper factory
// ---------------------------------------------------------------------------

function wrap(MuiIcon: React.ComponentType<SvgIconProps>): LucideIcon {
  return function LucideCompatIcon({
    size,
    color,
    strokeWidth: StrokeWidth,
    sx,
    ...rest
  }: LucideProps) {
    const combinedSx = {
      ...(size != null ? { fontSize: size } : {}),
      ...(color != null ? { color } : {}),
      ...(sx as object | undefined),
    };
    return (
      <MuiIcon
        {...(rest as SvgIconProps)}
        sx={Object.keys(combinedSx).length > 0 ? combinedSx : undefined}
      />
    );
  };
}

// ---------------------------------------------------------------------------
// Lucide name → MUI icon mapping
// ---------------------------------------------------------------------------

export const AlertCircle = wrap(ErrorOutlineIcon);
export const AlertTriangle = wrap(WarningAmberIcon);
export const ArrowDown = wrap(KeyboardArrowDownIcon);
export const ArrowDownLeft = wrap(SouthWestIcon);
export const ArrowDownRight = wrap(SouthEastIcon);
export const ArrowLeft = wrap(ChevronLeftIcon);
export const ArrowRight = wrap(ChevronRightIcon);
export const ArrowUp = wrap(KeyboardArrowUpIcon);
export const ArrowUpRight = wrap(NorthEastIcon);
export const Ban = wrap(BlockIcon);
export const BarChart2 = wrap(BarChartIcon);
export const BarChart3 = wrap(BarChartIcon);
export const Bell = wrap(NotificationsNoneIcon);
export const Bookmark = wrap(BookmarkIcon);
export const BookOpen = wrap(BookIcon);
export const Bot = wrap(SmartToyIcon);
export const Bug = wrap(BugReportOutlinedIcon);
export const BriefcaseBusiness = wrap(BusinessCenterIcon);
export const Building2 = wrap(BusinessIcon);
export const CalendarClock = wrap(ScheduleIcon);
export const Calculator = wrap(CalculateIcon);
export const CalendarDays = wrap(CalendarMonthIcon);
export const CalendarRange = wrap(DateRangeIcon);
export const Camera = wrap(PhotoCameraIcon);
export const ChartPie = wrap(PieChartIcon);
export const Check = wrap(CheckIcon);
export const CheckCircle = wrap(CheckCircleIcon);
export const CheckCircle2 = wrap(CheckCircleIcon);
/** Thin outline check, for calm all-clear empty states. */
export const CheckCircleOutline = wrap(CheckCircleOutlineIcon);
export const ChevronDown = wrap(KeyboardArrowDownIcon);
export const ChevronLeft = wrap(ChevronLeftIcon);
export const ChevronRight = wrap(ChevronRightIcon);
export const ChevronUp = wrap(KeyboardArrowUpIcon);
export const Circle = wrap(CircleIcon);
export const CircleHelp = wrap(HelpOutlineIcon);
export const Clock = wrap(AccessTimeIcon);
export const Clock3 = wrap(AccessTimeIcon);
export const Cloud = wrap(CloudIcon);
export const Columns2 = wrap(ViewColumnIcon);
export const Compass = wrap(ExploreIcon);
export const Copy = wrap(ContentCopyIcon);
export const Cpu = wrap(MemoryIcon);
export const CreditCard = wrap(CreditCardIcon);
export const Disc = wrap(FiberManualRecordIcon);
export const DollarSign = wrap(AttachMoneyIcon);
export const Download = wrap(DownloadIcon);
export const Edit3 = wrap(EditNoteIcon);
export const Ellipsis = wrap(MoreHorizIcon);
export const ExternalLink = wrap(OpenInNewIcon);
export const Eye = wrap(VisibilityIcon);
export const File = wrap(InsertDriveFileIcon);
export const FileImage = wrap(MuiImageIcon);
export const FileSpreadsheet = wrap(TableChartIcon);
export const FileText = wrap(DescriptionIcon);
export const FileType2 = wrap(InsertDriveFileIcon);
export const FileUp = wrap(FileUploadIcon);
export const FileX = wrap(InsertDriveFileIcon);
export const Filter = wrap(FilterListIcon);
export const FlaskConical = wrap(ScienceIcon);
export const Folder = wrap(FolderIcon);
export const FolderOpen = wrap(FolderOpenIcon);
export const GitMerge = wrap(CallMergeIcon);
export const Globe = wrap(PublicIcon);
export const Grid = wrap(GridViewIcon);
export const GripVertical = wrap(DragIndicatorIcon);
export const HelpCircle = wrap(HelpOutlineIcon);
export const ImageUp = wrap(FileUploadIcon);
export const Info = wrap(InfoIcon);
export const Landmark = wrap(AccountBalanceIcon);
export const Layers = wrap(LayersIcon);
export const LayoutDashboard = wrap(DashboardIcon);
export const LayoutGrid = wrap(GridViewIcon);
export const Lightbulb = wrap(LightbulbIcon);
export const Quote = wrap(FormatQuoteIcon);
export const Link2 = wrap(LinkIcon);
export const List = wrap(FormatListBulletedIcon);
export const ListChecks = wrap(PlaylistAddCheckIcon);
export const Lock = wrap(LockIcon);
export const LogOut = wrap(LogoutIcon);
export const Mail = wrap(EmailIcon);
export const MailPlus = wrap(ForwardToInboxIcon);
export const MapPin = wrap(PlaceIcon);
export const Menu = wrap(MenuIcon);
export const MessageCircle = wrap(ChatBubbleOutlineIcon);
export const Minus = wrap(HorizontalRuleIcon);
export const Monitor = wrap(MonitorIcon);
export const Moon = wrap(DarkModeIcon);
export const MoonStar = wrap(NightlightRoundIcon);
export const MoreHorizontal = wrap(MoreHorizIcon);
export const MoreVertical = wrap(MoreVertIcon);
export const Palette = wrap(PaletteIcon);
export const PanelLeftClose = wrap(ViewSidebarIcon);
export const PanelLeftOpen = wrap(ViewSidebarIcon);
export const Pencil = wrap(EditIcon);
export const PencilLine = wrap(EditNoteIcon);
export const PieChart = wrap(PieChartIcon);
export const PlayCircle = wrap(PlayCircleIcon);
export const Plug = wrap(OutletIcon);
export const Plus = wrap(AddIcon);
export const PlusCircle = wrap(AddCircleIcon);
export const Printer = wrap(PrintIcon);
export const Puzzle = wrap(ExtensionIcon);
export const Receipt = wrap(ReceiptIcon);
export const RefreshCcw = wrap(RefreshIcon);
export const RefreshCw = wrap(RefreshIcon);
export const RotateCcw = wrap(UndoIcon);
export const Save = wrap(SaveIcon);
export const Scale = wrap(BalanceIcon);
export const Scan = wrap(DocumentScannerIcon);
export const ScanLine = wrap(DocumentScannerIcon);
export const ScrollText = wrap(ArticleIcon);
export const Search = wrap(SearchIcon);
export const Send = wrap(SendIcon);
export const Settings = wrap(SettingsIcon);
export const Share2 = wrap(ShareIcon);
export const ShieldCheck = wrap(VerifiedUserIcon);
export const ShoppingCart = wrap(ShoppingCartIcon);
export const Smartphone = wrap(SmartphoneIcon);
export const SlidersHorizontal = wrap(TuneIcon);
export const SortAsc = wrap(SortIcon);
export const Sparkles = wrap(AutoAwesomeIcon);
export const Star = wrap(StarIcon);
export const StarBorder = wrap(StarBorderIcon);
export const Sun = wrap(WbSunnyIcon);
export const Table = wrap(TableChartIcon);
export const Table2 = wrap(TableChartIcon);
export const Tag = wrap(LocalOfferIcon);
export const Tablet = wrap(TabletIcon);
export const ThumbsUp = wrap(ThumbUpIcon);
export const Trash2 = wrap(DeleteIcon);
export const TrendingDown = wrap(TrendingDownIcon);
export const TrendingUp = wrap(TrendingUpIcon);
export const TriangleAlert = wrap(WarningAmberIcon);
export const Unlink2 = wrap(LinkOffIcon);
export const Upload = wrap(UploadIcon);
export const UploadCloud = wrap(CloudUploadIcon);
export const User = wrap(PersonIcon);
export const UserCircle = wrap(AccountCircleIcon);
export const UserPlus = wrap(PersonAddIcon);
export const Users = wrap(GroupIcon);
export const Wallet = wrap(AccountBalanceWalletIcon);
export const Workflow = wrap(AccountTreeIcon);
export const X = wrap(CloseIcon);
export const XCircle = wrap(CancelIcon);
export const ZoomIn = wrap(ZoomInIcon);
export const ZoomOut = wrap(ZoomOutIcon);

// Additional icons (Lucide aliases / missed in initial scan)
export const Banknote = wrap(PaymentsIcon);
export const Bitcoin = wrap(CurrencyBitcoinIcon);
export const Calendar = wrap(CalendarMonthIcon);
export const CircleAlert = wrap(ErrorOutlineIcon);
export const Database = wrap(StorageIcon);
export const FileDown = wrap(FileDownloadIcon);
export const Flag = wrap(FlagIcon);
export const ImageIcon = wrap(MuiImageIcon);
export const Inbox = wrap(InboxIcon);
export const Link2Off = wrap(LinkOffIcon);
export const PiggyBank = wrap(PiggyBankIcon);
export const Shield = wrap(SecurityIcon);
export const ShieldAlert = wrap(SecurityIcon);
export const ShieldOff = wrap(SecurityIcon);

// ── Category glyphs (outline variants) ──────────────────────────────────────
export const ArrowLeftRight = wrap(SwapHorizOutlinedIcon);
export const Briefcase = wrap(WorkOutlineIcon);
export const Car = wrap(DirectionsCarOutlinedIcon);
export const CircleDollarSign = wrap(PaidOutlinedIcon);
export const Handshake = wrap(HandshakeOutlinedIcon);
export const Heart = wrap(FavoriteBorderIcon);
export const Home = wrap(HomeOutlinedIcon);
export const Laptop = wrap(LaptopOutlinedIcon);
export const Megaphone = wrap(CampaignOutlinedIcon);
export const Package = wrap(Inventory2OutlinedIcon);
export const Percent = wrap(PercentOutlinedIcon);
export const Plane = wrap(FlightOutlinedIcon);
export const ReceiptText = wrap(ReceiptLongOutlinedIcon);
export const ShoppingBag = wrap(ShoppingBagOutlinedIcon);
export const Store = wrap(StorefrontOutlinedIcon);
export const Truck = wrap(LocalShippingOutlinedIcon);
export const Utensils = wrap(RestaurantOutlinedIcon);
export const Wrench = wrap(BuildOutlinedIcon);
export const Zap = wrap(BoltOutlinedIcon);
export const Coffee = wrap(LocalCafeOutlinedIcon);
export const Dumbbell = wrap(FitnessCenterOutlinedIcon);
export const Fuel = wrap(LocalGasStationOutlinedIcon);
export const Gamepad2 = wrap(SportsEsportsOutlinedIcon);
export const Gift = wrap(CardGiftcardOutlinedIcon);
export const GraduationCap = wrap(SchoolOutlinedIcon);
export const Music = wrap(MusicNoteOutlinedIcon);
export const PawPrint = wrap(PetsOutlinedIcon);
export const Repeat = wrap(AutorenewOutlinedIcon);
export const Stethoscope = wrap(MedicalServicesOutlinedIcon);
