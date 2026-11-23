import type { ImgHTMLAttributes } from 'react'
import { imageVersions } from '../generated/imageVersions'

export default function SiteImage({ src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const version = src ? imageVersions[src] : undefined
  return <img {...props} src={version ? `${src}?v=${version}` : src} />
}
