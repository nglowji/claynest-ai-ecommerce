import AdminActionButton from './AdminActionButton'
import { useEffect, useRef, useState } from 'react'
import { AuthError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import {
  type KnowledgeDocument,
  type KnowledgeRow,
  getKnowledge,
  listKnowledge,
  knowledgeCommand,
  topics,
  statuses,
} from '../features/knowledge/api'
import type { PageResult } from '../catalog/api'
import AdminIcon from './AdminIcon'

const blank = {
  title: '',
  content: '',
  sourceLabel: '',
  topic: 'care',
  productSlug: '',
  evidenceType: 'general',
  fileName: '',
}
const time = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
const actions: Record<string, string> = {
  save: 'Tạo phiên bản',
  approve: 'Duyệt công bố',
  revoke: 'Thu hồi',
  reindex: 'Yêu cầu lập lại chỉ mục',
}
export default function AdminKnowledgePage() {
  const auth = useAuth()
  const [list, setList] = useState<PageResult<KnowledgeRow> | null>(null)
  const [page, setPage] = useState(1)
  const [id, setId] = useState('')
  const [document, setDocument] = useState<KnowledgeDocument | null>(null)
  const [draft, setDraft] = useState(blank)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [retry, setRetry] = useState(false)
  const last = useRef<{ action: string; payload: Record<string, unknown> } | null>(null)
  const lock = useRef(false)
  const latest = document?.versions[0]
  function message(failure: unknown) {
    if (failure instanceof AuthError && failure.status === 401) auth.expire()
    return failure instanceof Error ? failure.message : 'Chưa kết nối được kho kiến thức.'
  }
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    listKnowledge(page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setList(data)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(message(e))
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [page, attempt])
  useEffect(() => {
    if (!id) {
      setDocument(null)
      return
    }
    const controller = new AbortController()
    setDocument(null)
    getKnowledge(id, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setDocument(data)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e))
      })
    return () => controller.abort()
  }, [id, attempt])
  useEffect(() => {
    if (busy || !latest || !['queued', 'running'].includes(latest.indexStatus)) return
    let active = true
    const timer = setInterval(
      () =>
        getKnowledge(id)
          .then((data) => {
            if (active) setDocument(data)
          })
          .catch(() => {}),
      2500,
    )
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [id, latest?.indexStatus, busy])
  async function run(action: string, payload?: Record<string, unknown>) {
    if (lock.current) return
    const command = payload
      ? { action, payload: { ...payload, requestId: crypto.randomUUID() } }
      : last.current
    if (!command) return
    lock.current = true
    setBusy(true)
    setError('')
    setNotice('')
    last.current = command
    try {
      const result = await knowledgeCommand(command.action, command.payload)
      setDocument(result)
      setId(result.id)
      setEditing(false)
      setConfirm(false)
      setRetry(false)
      last.current = null
      setNotice(
        command.action === 'save'
          ? 'Đã lưu phiên bản. Tài liệu sẽ được xử lý trước khi duyệt.'
          : 'Đã cập nhật tài liệu.',
      )
      setAttempt((v) => v + 1)
    } catch (failure) {
      setError(message(failure))
      setRetry(!(failure instanceof AuthError) || failure.status === 0 || failure.status >= 500)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  function create() {
    setId('')
    setDocument(null)
    setDraft(blank)
    setEditing(true)
    setError('')
    setNotice('')
    setRetry(false)
    last.current = null
  }
  function edit() {
    if (!latest || !document) return
    setDraft({
      title: document.title,
      content: latest.content,
      sourceLabel: latest.sourceLabel,
      topic: latest.topic,
      productSlug: latest.productSlug || '',
      evidenceType: latest.evidenceType,
      fileName: '',
    })
    setEditing(true)
    setRetry(false)
    last.current = null
  }
  async function upload(file?: File) {
    if (!file) return
    try {
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 64000)
        throw new Error('Chỉ nhận file .txt/.md UTF-8 tối đa 64 KB.')
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
      if (content.length > 20000 || content.includes('\0'))
        throw new Error('Tài liệu tối đa 20.000 ký tự, không chứa dữ liệu nhị phân.')
      setDraft((v) => ({ ...v, content, fileName: file.name }))
      setError('')
    } catch (failure) {
      setError(message(failure))
    }
  }
  const transition = (action: string, versionId: string) =>
    document &&
    void run(action, {
      documentId: document.id,
      versionId,
      revision: document.revision,
      confirmPublic: confirm,
    })
  return (
    <section className="admin-knowledge container">
      <header className="knowledge-heading">
        <div>
          <p className="dashboard-eyebrow">NỘI DUNG CHO TRỢ LÝ AI</p>
          <h1>Kho kiến thức</h1>
          <p>Tài liệu được duyệt là nguồn để Nàng tư vấn và dẫn chứng.</p>
        </div>
        <button className="knowledge-primary" disabled={busy || retry} onClick={create}>
          + Thêm tài liệu
        </button>
      </header>
      {notice && (
        <p className="knowledge-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="dashboard-error" role="alert">
          <span>{error}</span>
          {retry ? (
            <button disabled={busy} onClick={() => void run('')}>
              Thử lại thao tác
            </button>
          ) : (
            <button onClick={() => setAttempt((v) => v + 1)}>Tải lại</button>
          )}
        </div>
      )}
      <div className="knowledge-workspace">
        <section className="dashboard-panel knowledge-list">
          <div className="dashboard-panel-heading">
            <h2>Tài liệu của cửa hàng</h2>
            <span>{list?.totalCount ?? '—'} tài liệu</span>
          </div>
          {loading ? (
            <p className="dashboard-empty" role="status">
              Đang tải tài liệu…
            </p>
          ) : !list?.items.length ? (
            <div className="dashboard-empty">
              <AdminIcon name="orders" />
              <h3>Chưa có tài liệu</h3>
              <p>Thêm hướng dẫn, chính sách hoặc thông tin sản phẩm để bắt đầu.</p>
            </div>
          ) : (
            list.items.map((row) => (
              <button
                key={row.id}
                className={'knowledge-list-row' + (id === row.id ? ' selected' : '')}
                disabled={busy || retry}
                onClick={() => {
                  setId(row.id)
                  setEditing(false)
                  setConfirm(false)
                  setError('')
                }}
              >
                <strong>{row.title}</strong>
                <span>
                  {topics[row.topic]} · v{row.version}
                </span>
                <div>
                  <small className={'knowledge-state ' + row.indexStatus}>
                    {row.activeVersion === row.versionId && row.indexStatus === 'ready'
                      ? 'Đã công bố'
                      : statuses[row.indexStatus]}
                  </small>
                  {row.activeVersionNumber && (
                    <small className="knowledge-state approved">
                      Đang dùng v{row.activeVersionNumber}
                    </small>
                  )}
                </div>
              </button>
            ))
          )}
          {list && list.totalCount > 20 && (
            <div className="knowledge-pagination">
              <button disabled={page === 1 || busy} onClick={() => setPage((p) => p - 1)}>
                Trước
              </button>
              <span>
                {page} / {Math.ceil(list.totalCount / 20)}
              </span>
              <button
                disabled={page * 20 >= list.totalCount || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </button>
            </div>
          )}
        </section>
        <section className="dashboard-panel knowledge-detail">
          {editing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void run('save', {
                  ...draft,
                  fileName: draft.fileName || null,
                  productSlug: draft.productSlug || null,
                  documentId: id || null,
                  revision: document?.revision || null,
                })
              }}
            >
              <div className="dashboard-panel-heading">
                <div>
                  <h2>{document ? 'Tạo phiên bản mới' : 'Thêm tài liệu'}</h2>
                  <p>Nội dung mới chưa được AI sử dụng cho đến khi được duyệt.</p>
                </div>
              </div>
              <fieldset disabled={busy || retry || (!!id && !document)} className="knowledge-form">
                <label>
                  Tiêu đề
                  <input
                    required
                    minLength={3}
                    maxLength={180}
                    value={draft.title}
                    onChange={(e) => setDraft((v) => ({ ...v, title: e.target.value }))}
                  />
                </label>
                <label>
                  Nguồn / vị trí tài liệu
                  <input
                    required
                    minLength={3}
                    maxLength={300}
                    placeholder="Tên quy trình, người xác nhận, trang hoặc mục"
                    value={draft.sourceLabel}
                    onChange={(e) => setDraft((v) => ({ ...v, sourceLabel: e.target.value }))}
                  />
                </label>
                <div className="knowledge-form-grid">
                  <label>
                    Chủ đề
                    <select
                      value={draft.topic}
                      onChange={(e) =>
                        setDraft((v) => ({ ...v, topic: e.target.value, evidenceType: 'general' }))
                      }
                    >
                      {Object.entries(topics).map(([k, v]) => (
                        <option value={k} key={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Slug sản phẩm (nếu có)
                    <input
                      maxLength={140}
                      pattern="[a-z0-9-]+"
                      value={draft.productSlug}
                      onChange={(e) => setDraft((v) => ({ ...v, productSlug: e.target.value }))}
                      placeholder="Ví dụ: coc-suong-mai"
                    />
                  </label>
                </div>
                {draft.topic === 'safety' && (
                  <label>
                    Loại chứng cứ
                    <select
                      value={draft.evidenceType}
                      onChange={(e) => setDraft((v) => ({ ...v, evidenceType: e.target.value }))}
                    >
                      <option value="general">Thông tin thông thường</option>
                      <option value="safety_evidence">
                        Chứng cứ đã xác minh cho sản phẩm cụ thể
                      </option>
                    </select>
                  </label>
                )}
                <label>
                  Nạp file văn bản
                  <input
                    type="file"
                    accept=".txt,.md,text/plain,text/markdown"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                  <small>
                    .txt/.md UTF-8 · tối đa 64 KB, 20.000 ký tự. Không đưa mật khẩu hay dữ liệu
                    khách hàng vào tài liệu.
                  </small>
                </label>
                <label>
                  Nội dung
                  <textarea
                    aria-label="Nội dung"
                    required
                    minLength={20}
                    maxLength={20000}
                    rows={14}
                    value={draft.content}
                    onChange={(e) => setDraft((v) => ({ ...v, content: e.target.value }))}
                  />
                  <small>{draft.content.length.toLocaleString('vi-VN')} / 20.000 ký tự</small>
                </label>
                <div className="knowledge-actions">
                  <button className="knowledge-primary" type="submit">
                    {busy ? 'Đang lưu…' : 'Lưu & xử lý'}
                  </button>
                  <button type="button" onClick={() => setEditing(false)}>
                    Hủy
                  </button>
                </div>
              </fieldset>
            </form>
          ) : document && latest ? (
            <>
              <div className="dashboard-panel-heading">
                <div>
                  <h2>{document.title}</h2>
                  <p>
                    Phiên bản mới nhất: v{latest.number} ·{' '}
                    {document.activeVersion === latest.id && latest.indexStatus === 'ready'
                      ? 'Đã công bố'
                      : statuses[latest.indexStatus]}
                  </p>
                </div>
                <AdminActionButton
                  icon="edit"
                  label="Tạo phiên bản mới"
                  disabled={busy || retry}
                  onClick={edit}
                />
              </div>
              <div className="knowledge-detail-body">
                <div className="knowledge-metadata">
                  <span>
                    <b>Đang công bố</b>
                    {document.activeVersion
                      ? 'v' + document.versions.find((v) => v.id === document.activeVersion)?.number
                      : 'Chưa công bố'}
                  </span>
                  <span>
                    <b>Phạm vi</b>
                    {latest.productSlug || 'Toàn cửa hàng'}
                  </span>
                  <span>
                    <b>Phân đoạn</b>
                    {latest.chunkCount}
                  </span>
                </div>
                <div className="knowledge-job">
                  <AdminIcon name="refresh" />
                  <div>
                    <strong>
                      {document.activeVersion === latest.id && latest.indexStatus === 'ready'
                        ? 'Đã công bố'
                        : statuses[latest.indexStatus]}
                    </strong>
                    <p>
                      {latest.job ? `Lần xử lý: ${latest.job.attempts}. ` : ''}
                      {latest.indexStatus === 'failed'
                        ? 'Chưa lập được chỉ mục. Kiểm tra kết nối Gemini và thử xử lý lại.'
                        : latest.indexStatus === 'ready'
                          ? document.activeVersion === latest.id
                            ? 'Phiên bản này đang được AI dùng làm nguồn tư vấn.'
                            : 'Nội dung đã được xử lý. Hãy xem kỹ trước khi công bố.'
                          : 'Tác vụ nền đang xử lý. Trang tự cập nhật trạng thái.'}
                    </p>
                  </div>
                </div>
                <p className="knowledge-source-label">
                  <b>Nguồn:</b> {latest.sourceLabel}
                </p>
                <pre className="knowledge-preview">{latest.content}</pre>
                <div className="knowledge-review">
                  {latest.topic === 'safety' && latest.evidenceType !== 'safety_evidence' && (
                    <p className="dashboard-error">
                      Tài liệu an toàn chỉ được công bố khi là chứng cứ đã xác minh, gắn một sản
                      phẩm cụ thể. Hãy tạo phiên bản mới để bổ sung.
                    </p>
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={confirm}
                      disabled={busy || retry}
                      onChange={(e) => setConfirm(e.target.checked)}
                    />
                    Tôi đã kiểm tra nguồn, phạm vi và đồng ý công bố nội dung này cho khách hàng.
                  </label>
                  <div className="knowledge-actions">
                    <button
                      className="knowledge-primary"
                      disabled={
                        busy ||
                        retry ||
                        !confirm ||
                        latest.indexStatus !== 'ready' ||
                        (latest.topic === 'safety' &&
                          (latest.evidenceType !== 'safety_evidence' || !latest.productSlug)) ||
                        document.activeVersion === latest.id
                      }
                      onClick={() => transition('approve', latest.id)}
                    >
                      Duyệt công bố
                    </button>
                    {document.activeVersion && (
                      <button
                        className="knowledge-danger"
                        disabled={busy || retry}
                        onClick={() => transition('revoke', document.activeVersion!)}
                      >
                        Thu hồi nguồn đang dùng
                      </button>
                    )}
                    <button
                      disabled={busy || retry || ['queued', 'running'].includes(latest.indexStatus)}
                      onClick={() => transition('reindex', latest.id)}
                    >
                      Xử lý lại
                    </button>
                  </div>
                  <small>
                    Thu hồi sẽ chặn nguồn khỏi kết quả AI và trang dẫn nguồn. Phiên bản cũ được giữ
                    để đối chiếu.
                  </small>
                </div>
                <details className="knowledge-history">
                  <summary>Phiên bản & lịch sử</summary>
                  {document.versions.map((version) => (
                    <details key={version.id}>
                      <summary>
                        v{version.number} · {time(version.createdAt)} ·{' '}
                        {statuses[version.indexStatus]}
                      </summary>
                      <p>Nguồn: {version.sourceLabel}</p>
                      <pre>{version.content}</pre>
                    </details>
                  ))}
                  <ul>
                    {document.history.map((entry, index) => (
                      <li key={index}>
                        {actions[entry.action] || entry.action} · {time(entry.createdAt)}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </>
          ) : (
            <div className="dashboard-empty">
              <AdminIcon name="orders" />
              <h3>Chọn một tài liệu</h3>
              <p>Xem nội dung, trạng thái xử lý và lịch sử phê duyệt tại đây.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
