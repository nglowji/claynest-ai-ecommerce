import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { catalogRequest } from '../catalog/api'
import type { Excerpt } from '../features/knowledge/api'

export function KnowledgeFeedback({ chunkId }: { chunkId: string }) {
  const [busy,setBusy]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState('')
  const last=useRef<{ requestId: string; chunkId: string; useful: boolean } | null>(null)
  async function send(useful: boolean) {
    if (busy || saved) return
    const payload=last.current?.useful===useful ? last.current : { requestId:crypto.randomUUID(),chunkId,useful }
    last.current=payload; setBusy(true); setError('')
    try { await catalogRequest('knowledge/feedback',{ method:'POST',body:JSON.stringify(payload) }); setSaved(true) }
    catch { setError('Chưa lưu được phản hồi. Bạn thử lại nhé.') }
    finally { setBusy(false) }
  }
  return <div className="knowledge-feedback">{saved ? <p role="status">Cảm ơn bạn đã góp ý cho Nàng.</p> : <><span>Thông tin này có hữu ích?</span><button disabled={busy} onClick={()=>void send(true)}>Hữu ích</button><button disabled={busy} onClick={()=>void send(false)}>Chưa hữu ích</button>{error && <p role="alert">{error}</p>}</>}</div>
}
export default function KnowledgeSourcePage() {
  const { id }=useParams(); const [params]=useSearchParams(); const product=params.get('product')
  const [source,setSource]=useState<Excerpt | null>(null)
  const [error,setError]=useState(''); const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    const controller=new AbortController(); setSource(null); setError('')
    catalogRequest<Excerpt>('knowledge/sources/'+id+(product ? '?product='+encodeURIComponent(product) : ''),{ signal:controller.signal }).then(data=>{ if (!controller.signal.aborted) setSource(data) }).catch(()=>{ if (!controller.signal.aborted) setError('Nguồn này chưa được công bố, đã được thu hồi hoặc hiện chưa truy cập được.') })
    return ()=>controller.abort()
  },[id,product,attempt])
  return <section className="container knowledge-source-page"><Link to="/products">← Về cửa hàng</Link>{error ? <div role="alert"><h1>Nguồn chưa khả dụng</h1><p>{error}</p><button onClick={()=>setAttempt(v=>v+1)}>Thử lại</button></div> : source ? <article><p className="eyebrow">NGUỒN KIẾN THỨC CỦA NÀNG</p><h1>{source.title}</h1><p>Phiên bản {source.version} · {source.section}</p><p className="knowledge-source-label">Nguồn gốc: {source.sourceLabel}</p><blockquote>{source.content}</blockquote><KnowledgeFeedback chunkId={source.chunkId} /></article> : <p role="status">Đang kiểm tra nguồn được công bố…</p>}</section>
}
