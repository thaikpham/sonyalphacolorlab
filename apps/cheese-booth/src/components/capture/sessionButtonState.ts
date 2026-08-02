import {
  Camera,
  LoaderCircle,
  Play,
  QrCode,
  RefreshCw,
  X,
  type LucideIcon,
} from 'lucide-react'

import type { BrowserCaptureSessionState } from '../../types'

export type SessionButtonUiState =
  | 'start'
  | 'active-empty'
  | 'reviewing'
  | 'finalize'
  | 'finalizing'
  | 'ready'
  | 'retry'
  | 'cancel-confirm'
  | 'reset-confirm'

export type SessionConfirmState = Extract<
  SessionButtonUiState,
  'cancel-confirm' | 'reset-confirm'
> | null

export interface SessionButtonModel {
  uiState: SessionButtonUiState
  label: string
  Icon: LucideIcon
  disabled: boolean
  canLongPress: boolean
  nextConfirmState: SessionConfirmState
  onPress?: () => void
  ariaLabel: string
  title: string
  iconClassName?: string
}

export function getSessionFlowResetKey(
  session: BrowserCaptureSessionState,
): string {
  return `${session.status}:${session.items.length}`
}

export function resolveSessionButtonModel({
  session,
  confirmState,
  onStartBrowserSession,
  onFinalizeBrowserSession,
  onRetryBrowserSessionShare,
  onCancelBrowserSession,
  onResetBrowserSession,
}: {
  session: BrowserCaptureSessionState
  confirmState: SessionConfirmState
  onStartBrowserSession?: () => void
  onFinalizeBrowserSession?: () => void
  onRetryBrowserSessionShare?: () => void
  onCancelBrowserSession?: () => void
  onResetBrowserSession?: () => void
}): SessionButtonModel {
  if (confirmState === 'cancel-confirm') {
    return {
      uiState: 'cancel-confirm',
      label: 'Xác nhận hủy',
      Icon: X,
      disabled: !onCancelBrowserSession,
      canLongPress: false,
      nextConfirmState: null,
      onPress: onCancelBrowserSession,
      ariaLabel: 'Xác nhận hủy session',
      title: 'Nhấn lần nữa để hủy session hiện tại',
    }
  }

  if (confirmState === 'reset-confirm') {
    return {
      uiState: 'reset-confirm',
      label: 'Bỏ session',
      Icon: X,
      disabled: !onResetBrowserSession && !onCancelBrowserSession,
      canLongPress: false,
      nextConfirmState: null,
      onPress: onResetBrowserSession ?? onCancelBrowserSession,
      ariaLabel: 'Bỏ session lỗi và tạo session mới',
      title: 'Nhấn lần nữa để bỏ session lỗi',
    }
  }

  switch (session.status) {
    case 'idle':
      return {
        uiState: 'start',
        label: 'Bắt đầu',
        Icon: Play,
        disabled: !onStartBrowserSession,
        canLongPress: false,
        nextConfirmState: null,
        onPress: onStartBrowserSession,
        ariaLabel: 'Bắt đầu session',
        title: 'Bắt đầu session mới',
      }
    case 'active':
      if (session.items.length > 0) {
        return {
          uiState: 'finalize',
          label: 'Tạo QR',
          Icon: QrCode,
          disabled: !onFinalizeBrowserSession,
          canLongPress: Boolean(onCancelBrowserSession),
          nextConfirmState: onCancelBrowserSession ? 'cancel-confirm' : null,
          onPress: onFinalizeBrowserSession,
          ariaLabel: 'Tạo QR cho session. Giữ để hủy session',
          title: 'Nhấn để tạo QR. Giữ để hủy session.',
        }
      }

      return {
        uiState: 'active-empty',
        label: 'Đang chụp',
        Icon: Camera,
        disabled: false,
        canLongPress: Boolean(onCancelBrowserSession),
        nextConfirmState: onCancelBrowserSession ? 'cancel-confirm' : null,
        ariaLabel: 'Session đang chụp. Giữ để hủy session',
        title: 'Session đang chụp. Giữ để hủy session.',
      }
    case 'reviewing-shot':
      return {
        uiState: 'reviewing',
        label: 'Duyệt ảnh',
        Icon: Camera,
        disabled: false,
        canLongPress: Boolean(onCancelBrowserSession),
        nextConfirmState: onCancelBrowserSession ? 'cancel-confirm' : null,
        ariaLabel: 'Đang duyệt ảnh. Giữ để hủy session',
        title: 'Đang duyệt ảnh. Giữ để hủy session.',
      }
    case 'finalizing':
      return {
        uiState: 'finalizing',
        label: 'Đang tạo QR',
        Icon: LoaderCircle,
        disabled: true,
        canLongPress: false,
        nextConfirmState: null,
        ariaLabel: 'Đang tạo QR cho session',
        title: 'Đang tạo QR cho session',
        iconClassName: 'capture-session-flow-icon-spinner',
      }
    case 'ready':
      return {
        uiState: 'ready',
        label: 'Session mới',
        Icon: RefreshCw,
        disabled: !onResetBrowserSession,
        canLongPress: false,
        nextConfirmState: null,
        onPress: onResetBrowserSession,
        ariaLabel: 'Bắt đầu session mới',
        title: 'Xóa session hiện tại và bắt đầu session mới',
      }
    case 'error':
      return {
        uiState: 'retry',
        label: 'Thử lại',
        Icon: RefreshCw,
        disabled: !onRetryBrowserSessionShare,
        canLongPress: Boolean(onResetBrowserSession ?? onCancelBrowserSession),
        nextConfirmState:
          onResetBrowserSession || onCancelBrowserSession ? 'reset-confirm' : null,
        onPress: onRetryBrowserSessionShare,
        ariaLabel: 'Thử lại upload. Giữ để bỏ session hiện tại',
        title: 'Nhấn để thử lại upload. Giữ để bỏ session hiện tại.',
      }
    default:
      return {
        uiState: 'active-empty',
        label: 'Session',
        Icon: Camera,
        disabled: true,
        canLongPress: false,
        nextConfirmState: null,
        ariaLabel: 'Session',
        title: 'Session',
      }
  }
}
