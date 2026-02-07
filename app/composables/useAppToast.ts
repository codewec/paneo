const TOAST_DEFAULT_DURATION = 3500

type ToastAddPayload = Parameters<ReturnType<typeof useToast>['add']>[0]
type ToastColor = NonNullable<ToastAddPayload['color']>

const ICON_BY_COLOR: Partial<Record<ToastColor, string>> = {
  success: 'i-lucide-circle-check',
  error: 'i-lucide-circle-x',
  warning: 'i-lucide-triangle-alert',
  info: 'i-lucide-info',
  primary: 'i-lucide-bell'
}

export function useAppToast() {
  const toast = useToast()

  function add(payload: ToastAddPayload) {
    const color = (payload.color ?? 'primary') as ToastColor

    return toast.add({
      ...payload,
      duration: payload.duration ?? TOAST_DEFAULT_DURATION,
      icon: payload.icon ?? ICON_BY_COLOR[color] ?? ICON_BY_COLOR.primary
    })
  }

  return {
    ...toast,
    add
  }
}
