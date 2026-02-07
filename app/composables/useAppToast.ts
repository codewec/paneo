const TOAST_DEFAULT_DURATION = 3500

const ICON_BY_COLOR: Record<string, string> = {
  success: 'i-lucide-circle-check',
  error: 'i-lucide-circle-x',
  warning: 'i-lucide-triangle-alert',
  info: 'i-lucide-info',
  primary: 'i-lucide-bell'
}

type AppToastPayload = {
  color?: string
  icon?: string
  duration?: number
} & Record<string, unknown>

export function useAppToast() {
  const toast = useToast()

  function add(payload: AppToastPayload) {
    const color = String(payload.color || 'primary')

    return toast.add({
      duration: payload.duration ?? TOAST_DEFAULT_DURATION,
      icon: payload.icon ?? ICON_BY_COLOR[color] ?? ICON_BY_COLOR.primary,
      ...payload
    })
  }

  return {
    ...toast,
    add
  }
}
