export function getErrorMessage(error: unknown) {
  const message = error as { data?: { statusMessage?: string }, message?: string }
  return message.data?.statusMessage || message.message || 'Неизвестная ошибка'
}
