import { memo, useMemo } from 'react'
import twemoji from 'twemoji'

const TAIWAN_FLAG_CODE = '1f1f9-1f1fc'

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
      base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
      callback: (icon) =>
        icon === TAIWAN_FLAG_CODE
          ? 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f1e8-1f1f3.svg'
          : `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${icon}.svg`,
    })
    return element.innerHTML
  }, [children])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
})
