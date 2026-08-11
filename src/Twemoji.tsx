import { memo, useMemo } from 'react'
import twemoji from 'twemoji'

export const Twemoji = memo(function Twemoji({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const html = useMemo(() => {
    const element = document.createElement('span')
    element.textContent = String(children || '')
    twemoji.parse(element, {
      folder: 'svg',
      ext: '.svg',
      base: '/twemoji/',
    })
    return element.innerHTML
  }, [children])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
})
