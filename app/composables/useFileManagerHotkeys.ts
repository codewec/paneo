interface FileManagerHotkeysOptions {
  isEnabled?: () => boolean
  onTab: () => void
  onArrowDown: () => void
  onArrowUp: () => void
  onPageDown: () => void
  onPageUp: () => void
  onEnter: () => Promise<void>
  onF1: () => void
  onF3: () => Promise<void>
  onF4: () => Promise<void>
  onF5: () => Promise<void>
  onF6: () => Promise<void>
  onF7: () => void
  onF8: () => Promise<void>
  onInsert: () => void
  onT: () => void
}

function isTypingElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true
  }

  return target.isContentEditable
}

export function useFileManagerHotkeys(options: FileManagerHotkeysOptions) {
  async function handleGlobalKeydown(event: KeyboardEvent) {
    if (options.isEnabled && !options.isEnabled()) {
      return
    }

    if (isTypingElement(event.target)) {
      return
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      options.onTab()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      options.onArrowDown()
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      options.onArrowUp()
      return
    }

    if (event.key === 'PageDown') {
      event.preventDefault()
      options.onPageDown()
      return
    }

    if (event.key === 'PageUp') {
      event.preventDefault()
      options.onPageUp()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      await options.onEnter()
      return
    }

    if (event.key === 'F1') {
      event.preventDefault()
      options.onF1()
      return
    }

    if (event.key === 'F3') {
      event.preventDefault()
      await options.onF3()
      return
    }

    if (event.key === 'F4') {
      event.preventDefault()
      await options.onF4()
      return
    }

    if (event.key === 'F5') {
      event.preventDefault()
      await options.onF5()
      return
    }

    if (event.key === 'F6') {
      event.preventDefault()
      await options.onF6()
      return
    }

    if (event.key === 'F7') {
      event.preventDefault()
      options.onF7()
      return
    }

    if (event.key === 'F8') {
      event.preventDefault()
      await options.onF8()
      return
    }

    if (event.key === 'Insert') {
      event.preventDefault()
      options.onInsert()
      return
    }

    if (event.key.toLowerCase() === 't') {
      event.preventDefault()
      options.onT()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleGlobalKeydown)
  })
}
