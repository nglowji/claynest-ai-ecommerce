import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { KnowledgeFeedback } from './KnowledgeSourcePage'
import { catalogRequest } from '../catalog/api'
import { money } from '../data/products'

type Fact = { variantId: string; name: string; slug: string; variantName: string; priceVnd: number; stockQty: number; glaze: string; material: string; heightCm: number | null; capacityMl: number | null; image: string }
type Source = { title: string; version: string; section: string; url: string }
type Answer = { sources?: Source[]; message: string; products: { product: Fact; reason: string }[]; actions: { label: string; url: string }[] }
type Entry = { id: number; role: 'user' | 'assistant'; content: string; answer?: Answer }
type Payload = { message: string; history: { role: string; content: string }[]; filters: { maxPrice: number | null; inStock: boolean } }
export default function ChatAssistant() {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const request = useRef<AbortController | null>(null)
  const last = useRef<Payload | null>(null)
  const sequence = useRef(0)
  const [open,setOpen] = useState(false)
  const [messages,setMessages] = useState<Entry[]>([])
  const [text,setText] = useState('')
  const [maxPrice,setMaxPrice] = useState('')
  const [inStock,setInStock] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  useEffect(() => {
    if (open) { dialog.current?.showModal(); input.current?.focus() } else dialog.current?.close()
  },[open])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) },[messages,busy,error])
  useEffect(() => () => request.current?.abort(),[])
  function stop() { request.current?.abort(); request.current = null; setBusy(false); setNotice('Đã dừng tư vấn.'); setError('') }
  function close() { stop(); setOpen(false) }
  async function run(payload: Payload) {
    if (request.current) return
    const controller = new AbortController(); request.current = controller; last.current = payload
    setBusy(true); setError(''); setNotice('')
    try {
      const answer = await catalogRequest<Answer>('chat',{ method: 'POST', body: JSON.stringify(payload), signal: controller.signal })
      if (!controller.signal.aborted) setMessages(current => [...current,{ id: ++sequence.current,role: 'assistant' as const,content: answer.message,answer }].slice(-16))
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Chưa kết nối được tư vấn. Bạn thử lại nhé.')
    } finally { if (request.current === controller) { request.current = null; setBusy(false) } }
  }
  function submit(event: React.FormEvent) {
    event.preventDefault(); const message = text.trim(); if (!message || busy || request.current) return
    const payload = { message, history: messages.slice(-6).map(({ role,content }) => ({ role,content })), filters: { maxPrice: maxPrice ? Number(maxPrice) : null,inStock } }
    setMessages(current => [...current,{ id: ++sequence.current,role: 'user' as const,content: message }].slice(-16)); setText(''); void run(payload)
  }
  function restart() { stop(); setMessages([]); last.current = null; setError(''); setNotice('Cuộc trò chuyện mới đã sẵn sàng.'); input.current?.focus() }
  return <><button className="chat-launcher" onClick={() => { setNotice(''); setOpen(true) }} aria-label="Mở tư vấn chọn gốm" aria-haspopup="dialog"><Icon name="leaf" /><span>Hỏi Nàng</span></button>
    <dialog className="chat-dialog" ref={dialog} aria-labelledby="chat-title" onCancel={event => { event.preventDefault(); close() }} onClose={() => { request.current?.abort(); request.current = null; setBusy(false); setOpen(false) }}>
      <header className="chat-header"><span className="chat-avatar"><Icon name="leaf" /></span><div><h2 id="chat-title">Nàng nghe bạn.</h2><p>Cùng chọn một món gốm hợp ý.</p></div><button className="icon-button" aria-label="Đóng tư vấn" onClick={close}><Icon name="close" /></button></header>
      <div className="chat-conversation" aria-live="polite" aria-relevant="additions text"><div className="chat-welcome"><p>Một chiếc cốc cho buổi sáng, một chiếc bình cho góc nhà. Bạn đang tìm món gì?</p><div>{['Cốc dưới 300k','Đặt hàng như thế nào?','Phí giao hàng thế nào?'].map(prompt => <button key={prompt} disabled={busy} onClick={() => { setText(prompt); input.current?.focus() }}>{prompt}</button>)}</div></div>
      {messages.map(entry => <article className={'chat-entry ' + entry.role} key={entry.id}><span>{entry.role === 'user' ? 'Bạn' : 'Nàng'}</span><p>{entry.content}</p>{entry.answer?.products.map(({ product,reason }) => <Link className="chat-product" to={'/products/' + product.slug + '?variant=' + product.variantId} key={product.variantId} onClick={close}><img src={product.image} alt={product.name} /><div><strong>{product.name}</strong><b>{money(product.priceVnd)}</b><small>{product.glaze}{product.capacityMl ? ` · ${product.capacityMl} ml` : ''}{product.heightCm ? ` · Cao ${product.heightCm} cm` : ''}</small><small>{product.stockQty ? `Còn ${product.stockQty} sản phẩm` : 'Tạm hết hàng'}</small><p>{reason}</p></div><Icon name="arrow" /></Link>)}{entry.answer?.sources?.length ? <div className="chat-sources" aria-label="Nguồn thông tin">{entry.answer.sources.map(source => <Link key={source.url + source.section} to={source.url} onClick={close}>Nguồn: {source.title} · {source.section}<small>Phiên bản {source.version}</small></Link>)}</div> : null}{entry.answer?.sources?.find(source => source.url.startsWith('/knowledge/')) && <KnowledgeFeedback chunkId={entry.answer.sources.find(source => source.url.startsWith('/knowledge/'))!.url.split('/')[2].split('?')[0]} />}{entry.answer?.actions.map(action => <Link className="chat-action" key={action.url} to={action.url} onClick={close}>{action.label} <Icon name="arrow" /></Link>)}</article>)}
      {busy && <p className="chat-working" role="status">Nàng đang xem những món gốm phù hợp…</p>}{notice && <p className="chat-notice" role="status">{notice}</p>}{error && <div className="chat-error" role="alert"><p>{error}</p><button disabled={busy} onClick={() => last.current && void run(last.current)}>Thử lại tư vấn</button><Link to="/products" onClick={close}>Ghé cửa hàng</Link></div>}<div ref={end} /></div>
      <form className="chat-composer" onSubmit={submit}><details className="chat-preferences"><summary>Chọn theo ngân sách</summary><label>Ngân sách tối đa (VND)<input aria-label="Ngân sách tư vấn tối đa" disabled={busy} type="number" min="0" max="1000000000" step="10000" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Ví dụ 300000" /></label><label className="chat-stock-filter"><input type="checkbox" disabled={busy} checked={inStock} onChange={e => setInStock(e.target.checked)} /> Chỉ gợi ý món còn hàng</label></details><div className="chat-compose-row"><textarea ref={input} aria-label="Lời nhắn cho Nàng" maxLength={1200} rows={2} disabled={busy} placeholder="Kể Nàng nghe bạn đang tìm gì…" value={text} onChange={e => setText(e.target.value)} /><button className="chat-send" type={busy ? 'button' : 'submit'} aria-label={busy ? 'Dừng tư vấn' : 'Gửi lời nhắn'} onClick={busy ? stop : undefined} disabled={!busy && !text.trim()}><Icon name={busy ? 'close' : 'arrow'} /></button></div><div className="chat-footnote"><span>Thông tin sản phẩm được kiểm tra khi trả lời.</span><button type="button" onClick={restart}>Bắt đầu lại</button></div></form>
    </dialog></>
}
