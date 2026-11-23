import AdminActionButton from './AdminActionButton'
import AdminProductCell from './AdminProductCell'
import AdminEditorDialog from './AdminEditorDialog'
import SiteImage from './SiteImage'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { catalogRequest, getCategories, getProducts, type PageResult } from '../catalog/api'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../auth/api'
import {
  money,
  type CatalogProduct,
  type Category,
  type Image,
  type Variant,
} from '../data/products'

type VariantDraft = Omit<Variant, 'id' | 'discountPercent' | 'stockQty'> & {
  id?: string | null
  stockQty?: number
}
type Draft = {
  categoryId: string
  name: string
  slug: string
  description: string
  craftStory: string
  material: string
  handmadeNote: string
  label: string
  published: boolean
  revision?: string
  variants: VariantDraft[]
  images: Image[]
}
const variant = (): VariantDraft => ({
  sku: '',
  name: 'Tiêu chuẩn',
  glaze: '',
  intendedUse: '',
  capacityMl: null,
  widthCm: null,
  heightCm: null,
  weightG: null,
  priceVnd: 100000,
  originalPriceVnd: null,
  active: true,
  careNote: '',
  careSource: '',
  careVerified: false,
})
const blank = (categoryId = ''): Draft => ({
  categoryId,
  name: '',
  slug: '',
  description: '',
  craftStory: '',
  material: 'Gốm thủ công',
  handmadeNote: 'Màu men và kích thước có thể khác giữa các sản phẩm thủ công.',
  label: '',
  published: false,
  variants: [variant()],
  images: [],
})
const slugify = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export default function AdminCatalogPage() {
  const auth = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [list, setList] = useState<PageResult<CatalogProduct> | null>(null)
  const [params] = useSearchParams()
  const queryParam = params.get('q') || ''
  const [q, setQ] = useState(queryParam)
  useEffect(() => {
    setQ(queryParam)
    setPage(1)
  }, [queryParam])
  const [page, setPage] = useState(1)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    active: true,
    revision: '',
  })
  function failure(e: unknown) {
    if (e instanceof AuthError && e.status === 401) {
      auth.expire()
      return
    }
    if (e instanceof AuthError && e.status === 403) {
      void auth.refresh()
      return
    }
    setError(e instanceof Error ? e.message : 'Chưa thực hiện được. Vui lòng thử lại.')
  }
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const timer = window.setTimeout(
      () =>
        Promise.all([
          getCategories(true),
          getProducts(
            new URLSearchParams({ q, page: String(page), pageSize: '12', sort: 'newest' }),
            true,
          ),
        ])
          .then(([c, p]) => {
            if (active) {
              setCategories(c)
              setList(p)
            }
          })
          .catch((e) => {
            if (active) failure(e)
          })
          .finally(() => {
            if (active) setLoading(false)
          }),
      200,
    )
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [q, page, attempt])
  function edit(product: CatalogProduct) {
    setEditingId(product.id)
    setDraft({
      ...product,
      variants: product.variants.map((v) => ({ ...v })),
      images: product.images.map((i) => ({ ...i })),
    })
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = { ...draft, variants: draft.variants.map(({ stockQty: _stock, ...v }) => v) }
      const saved = await catalogRequest<CatalogProduct>(
        'admin/catalog/products' + (editingId ? '/' + editingId : ''),
        { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(body) },
      )
      edit(saved)
      setNotice(
        'Đã lưu sản phẩm. ' +
          (saved.published ? 'Đang được giới thiệu trên cửa hàng.' : 'Đang ở trạng thái bản nháp.'),
      )
      setAttempt((n) => n + 1)
    } catch (e) {
      failure(e)
    } finally {
      setBusy(false)
    }
  }
  async function upload(file: File | undefined) {
    if (!file || !draft || busy) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      const result = await catalogRequest<{ url: string }>('admin/catalog/images', {
        method: 'POST',
        body: form,
      })
      setDraft((current) =>
        current
          ? {
              ...current,
              images: [
                ...current.images,
                { url: result.url, alt: current.name || 'Ảnh gốm thủ công' },
              ],
            }
          : null,
      )
      setNotice('Đã tải ảnh. Bấm Lưu sản phẩm để gắn ảnh vào catalog.')
    } catch (e) {
      failure(e)
    } finally {
      setBusy(false)
    }
  }
  async function archive(product: CatalogProduct) {
    if (!window.confirm(`Lưu trữ “${product.name}”? Sản phẩm sẽ ngừng hiển thị trên cửa hàng.`))
      return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await catalogRequest(
        'admin/catalog/products/' + product.id + '?revision=' + product.revision,
        { method: 'DELETE' },
      )
      setNotice('Đã lưu trữ sản phẩm.')
      setAttempt((n) => n + 1)
      if (editingId === product.id) setDraft(null)
    } catch (e) {
      failure(e)
    } finally {
      setBusy(false)
    }
  }
  async function saveCategory(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await catalogRequest('admin/catalog/categories' + (categoryId ? '/' + categoryId : ''), {
        method: categoryId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...categoryForm, revision: categoryForm.revision || null }),
      })
      setCategoryId('')
      setCategoryForm({ name: '', slug: '', active: true, revision: '' })
      setNotice('Đã lưu danh mục.')
      setAttempt((n) => n + 1)
    } catch (e) {
      failure(e)
    } finally {
      setBusy(false)
    }
  }
  function patchVariant(index: number, value: Partial<VariantDraft>) {
    setDraft((d) =>
      d
        ? { ...d, variants: d.variants.map((v, i) => (i === index ? { ...v, ...value } : v)) }
        : null,
    )
  }
  return (
    <section className="admin-page container catalog-admin">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">CATALOG / NÀNG GỐM</p>
          <h1>Sản phẩm & danh mục</h1>
          <p className="admin-page-description">
            Quản lý danh sách, giá bán, biến thể và nội dung sản phẩm.
          </p>
        </div>
        <button
          className="button primary"
          disabled={busy || !categories.length}
          onClick={() => {
            setEditingId(null)
            setDraft(blank(categories.find((c) => c.active)?.id))
            setError('')
            setNotice('')
          }}
        >
          Tạo sản phẩm
        </button>
      </div>
      {error && !draft && (
        <p className="auth-error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            Tải lại danh sách
          </button>
        </p>
      )}
      {notice && !draft && (
        <p className="auth-success" role="status">
          {notice}
        </p>
      )}
      {draft && (
        <AdminEditorDialog busy={busy} error={error} notice={notice} onClose={() => setDraft(null)}>
          <form className="catalog-editor" onSubmit={save}>
            <fieldset disabled={busy}>
              <div className="editor-heading">
                <h2 id="catalog-editor-title">
                  {editingId ? 'Chỉnh sửa sản phẩm' : 'Sản phẩm mới'}
                </h2>
                <button type="button" onClick={() => setDraft(null)}>
                  Đóng form
                </button>
              </div>
              <div className="editor-fields">
                <label>
                  Tên sản phẩm
                  <input
                    value={draft.name}
                    required
                    maxLength={180}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        name: e.target.value,
                        ...(!editingId ? { slug: slugify(e.target.value) } : {}),
                      })
                    }
                  />
                </label>
                <label>
                  Slug
                  <input
                    value={draft.slug}
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    maxLength={140}
                    onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  />
                </label>
                <label>
                  Danh mục
                  <select
                    value={draft.categoryId}
                    required
                    onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {!c.active ? ' (đã ẩn)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Chất liệu
                  <input
                    value={draft.material}
                    required
                    maxLength={160}
                    onChange={(e) => setDraft({ ...draft, material: e.target.value })}
                  />
                </label>
                <label>
                  Nhãn hiển thị
                  <input
                    value={draft.label}
                    maxLength={32}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="HOT SALE, MỚI…"
                  />
                </label>
              </div>
              {(
                [
                  ['description', 'Mô tả'],
                  ['craftStory', 'Câu chuyện'],
                  ['handmadeNote', 'Lưu ý thủ công'],
                ] as const
              ).map(([key, title]) => (
                <label key={key}>
                  {title}
                  <textarea
                    value={draft[key]}
                    required={key === 'description'}
                    maxLength={key === 'handmadeNote' ? 1000 : 6000}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    rows={3}
                  />
                </label>
              ))}
              <div className="editor-heading">
                <h3>Biến thể / SKU</h3>
                <button
                  type="button"
                  disabled={draft.variants.length >= 30}
                  onClick={() => setDraft({ ...draft, variants: [...draft.variants, variant()] })}
                >
                  + Thêm biến thể
                </button>
              </div>
              <p className="detail-note">
                Tồn kho chỉ đọc; chức năng nhập và điều chỉnh sẽ có trong mục quản lý kho. Không xóa
                SKU đã lưu: hãy tắt hoạt động.
              </p>
              {draft.variants.map((v, index) => (
                <div className="variant-editor" key={v.id || index}>
                  <h4>
                    Biến thể {index + 1}
                    {v.stockQty !== undefined ? ` · Tồn: ${v.stockQty}` : ''}
                  </h4>
                  <div className="editor-fields">
                    {(
                      [
                        ['sku', 'SKU', 64],
                        ['name', 'Tên biến thể', 120],
                        ['glaze', 'Màu men', 120],
                        ['intendedUse', 'Công dụng', 160],
                      ] as const
                    ).map(([key, title, max]) => (
                      <label key={key}>
                        {title}
                        <input
                          value={v[key]}
                          required={key === 'sku' || key === 'name'}
                          maxLength={max}
                          onChange={(e) => patchVariant(index, { [key]: e.target.value })}
                        />
                      </label>
                    ))}
                    {(
                      [
                        ['priceVnd', 'Giá bán (VND)'],
                        ['originalPriceVnd', 'Giá niêm yết (VND)'],
                        ['capacityMl', 'Dung tích (ml)'],
                        ['widthCm', 'Rộng (cm)'],
                        ['heightCm', 'Cao (cm)'],
                        ['weightG', 'Khối lượng (g)'],
                      ] as const
                    ).map(([key, title]) => (
                      <label key={key}>
                        {title}
                        <input
                          type="number"
                          min={key === 'widthCm' || key === 'heightCm' ? '0.01' : '1'}
                          step={key === 'widthCm' || key === 'heightCm' ? '0.01' : '1'}
                          value={v[key] ?? ''}
                          required={key === 'priceVnd'}
                          onChange={(e) =>
                            patchVariant(index, {
                              [key]: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label className="editor-check">
                    <input
                      type="checkbox"
                      checked={v.active}
                      onChange={(e) => patchVariant(index, { active: e.target.checked })}
                    />
                    Hoạt động
                  </label>
                  <details>
                    <summary>Hướng dẫn chăm sóc & chứng cứ</summary>
                    <label>
                      Nội dung chăm sóc
                      <textarea
                        value={v.careNote}
                        maxLength={2000}
                        onChange={(e) => patchVariant(index, { careNote: e.target.value })}
                      />
                    </label>
                    <label>
                      Nguồn chứng cứ
                      <input
                        value={v.careSource}
                        maxLength={1000}
                        onChange={(e) => patchVariant(index, { careSource: e.target.value })}
                      />
                    </label>
                    <label className="editor-check">
                      <input
                        type="checkbox"
                        checked={v.careVerified}
                        onChange={(e) => patchVariant(index, { careVerified: e.target.checked })}
                      />
                      Tôi đã kiểm chứng nội dung cho đúng biến thể này
                    </label>
                  </details>
                  {!v.id && draft.variants.length > 1 && (
                    <AdminActionButton
                      icon="trash"
                      label={'Bỏ biến thể mới ' + (index + 1)}
                      danger
                      onClick={() =>
                        setDraft({
                          ...draft,
                          variants: draft.variants.filter((_, i) => i !== index),
                        })
                      }
                    />
                  )}
                </div>
              ))}
              <div className="editor-heading">
                <h3>Ảnh sản phẩm ({draft.images.length}/12)</h3>
                <label className="upload-label">
                  Tải PNG/JPEG ≤ 5 MB
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    disabled={draft.images.length >= 12}
                    onChange={(e) => {
                      void upload(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              <p className="detail-note">
                Ảnh đầu tiên là ảnh đại diện. Chọn ảnh hoặc tải mới; sau đó lưu sản phẩm.
              </p>
              {draft.images.map((image, index) => (
                <div className="image-editor" key={index}>
                  <SiteImage src={image.url} alt={image.alt} />
                  <label>
                    Đường dẫn ảnh
                    <input
                      value={image.url}
                      required
                      maxLength={500}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          images: draft.images.map((i, n) =>
                            n === index ? { ...i, url: e.target.value } : i,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Mô tả ảnh
                    <input
                      value={image.alt}
                      required
                      maxLength={240}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          images: draft.images.map((i, n) =>
                            n === index ? { ...i, alt: e.target.value } : i,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!index}
                    onClick={() => {
                      const images = [...draft.images]
                      ;[images[index - 1], images[index]] = [images[index], images[index - 1]]
                      setDraft({ ...draft, images })
                    }}
                  >
                    Lên trước
                  </button>
                  <AdminActionButton
                    icon="trash"
                    label={'Gỡ ảnh ' + (index + 1)}
                    danger
                    onClick={() =>
                      setDraft({ ...draft, images: draft.images.filter((_, n) => n !== index) })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={draft.images.length >= 12}
                onClick={() =>
                  setDraft({
                    ...draft,
                    images: [
                      ...draft.images,
                      { url: '/images/slow-living/bowl.jpg', alt: draft.name || 'Ảnh gốm' },
                    ],
                  })
                }
              >
                + Dùng ảnh có sẵn
              </button>
              <label className="editor-check">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
                />
                Xuất bản lên cửa hàng
              </label>
              <div className="editor-actions">
                <button className="button primary" type="submit">
                  {busy ? 'Đang lưu…' : 'Lưu sản phẩm'}
                </button>
                {editingId && draft.published && (
                  <Link
                    className="text-link"
                    to={'/products/' + draft.slug}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Xem trên cửa hàng ↗
                  </Link>
                )}
              </div>
              <details className="draft-preview">
                <summary>Xem trước nội dung</summary>
                {draft.images[0] && (
                  <SiteImage src={draft.images[0].url} alt={draft.images[0].alt} />
                )}
                <h3>{draft.name}</h3>
                <p>{draft.description}</p>
                <p>{money(draft.variants[0]?.priceVnd || 0)}</p>
              </details>
            </fieldset>
          </form>
        </AdminEditorDialog>
      )}
      <section className="admin-list-section">
        <h2>Danh sách sản phẩm</h2>
        <label className="auth-field">
          Tìm tên hoặc SKU
          <input
            value={q}
            maxLength={180}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </label>
        {loading && <p role="status">Đang tải catalog…</p>}
        {!loading && list && (
          <>
            <div className="table-scroll">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Danh mục</th>
                    <th>Giá từ</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <AdminProductCell product={p} />
                      </td>
                      <td>{p.category}</td>
                      <td>
                        {p.variants.some((v) => v.active)
                          ? money(
                              Math.min(
                                ...p.variants.filter((v) => v.active).map((v) => v.priceVnd),
                              ),
                            )
                          : 'Chưa có giá'}
                      </td>
                      <td>
                        <span
                          className={
                            'admin-product-state ' +
                            (p.archived ? 'archived' : p.published ? 'published' : 'draft')
                          }
                        >
                          {p.archived ? 'Đã lưu trữ' : p.published ? 'Đã xuất bản' : 'Bản nháp'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <AdminActionButton
                            icon="edit"
                            label={'Sửa sản phẩm ' + p.name}
                            disabled={busy || p.archived}
                            onClick={() => edit(p)}
                          />
                          <AdminActionButton
                            icon="archive"
                            label={'Lưu trữ sản phẩm ' + p.name}
                            danger
                            disabled={busy || p.archived}
                            onClick={() => void archive(p)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!list.totalCount && <p>Chưa có sản phẩm.</p>}
            <div className="catalog-pagination">
              <button disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
                Trang trước
              </button>
              <span>
                Trang {page} · {list.totalCount} sản phẩm
              </span>
              <button
                disabled={page * list.pageSize >= list.totalCount}
                onClick={() => setPage((n) => n + 1)}
              >
                Trang sau
              </button>
            </div>
          </>
        )}
      </section>
      <section className="category-editor">
        <h2>Danh mục</h2>
        <p className="detail-note">
          Ẩn danh mục sẽ ẩn các sản phẩm thuộc danh mục đó trên cửa hàng.
        </p>
        <div className="category-tabs">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCategoryId(c.id)
                setCategoryForm({
                  name: c.name,
                  slug: c.slug,
                  active: c.active,
                  revision: c.revision,
                })
              }}
            >
              {c.name}
              {!c.active ? ' (ẩn)' : ''}
            </button>
          ))}
          <button
            onClick={() => {
              setCategoryId('')
              setCategoryForm({ name: '', slug: '', active: true, revision: '' })
            }}
          >
            + Danh mục mới
          </button>
        </div>
        <form onSubmit={saveCategory}>
          <fieldset disabled={busy}>
            <div className="editor-fields">
              <label>
                Tên danh mục
                <input
                  required
                  maxLength={100}
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      name: e.target.value,
                      ...(!categoryId ? { slug: slugify(e.target.value) } : {}),
                    })
                  }
                />
              </label>
              <label>
                Slug danh mục
                <input
                  required
                  maxLength={140}
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                />
              </label>
            </div>
            <label className="editor-check">
              <input
                type="checkbox"
                checked={categoryForm.active}
                onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })}
              />
              Hiển thị danh mục
            </label>
            <button className="button primary" type="submit">
              Lưu danh mục
            </button>
          </fieldset>
        </form>
      </section>
    </section>
  )
}
