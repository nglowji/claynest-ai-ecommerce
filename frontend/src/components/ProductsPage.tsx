import SiteImage from './SiteImage'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCategories } from '../catalog/api'
import { useCatalog } from '../catalog/useCatalog'
import { productView, type Category } from '../data/products'
import Icon from './Icon'
import ProductGrid, { type ProductActions } from './ProductGrid'

export default function ProductsPage(actions: ProductActions) {
  const [params, setParams] = useSearchParams()
  const input = useRef<HTMLInputElement>(null)
  const [sale, setSale] = useState(params.get('sale') === 'true')
  const [inStock, setInStock] = useState(params.get('inStock') === 'true')
  const saleParam = params.get('sale'); const stockParam = params.get('inStock')
  useEffect(() => { setSale(saleParam === 'true'); setInStock(stockParam === 'true') }, [saleParam, stockParam])
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryError, setCategoryError] = useState(false)
  const [categoryAttempt, setCategoryAttempt] = useState(0)
  useEffect(() => { let active = true; getCategories().then(v => { if (active) { setCategories(v); setCategoryError(false) } }).catch(() => { if (active) setCategoryError(true) }); return () => { active = false } }, [categoryAttempt])
  const apiParams = new URLSearchParams(params); apiParams.delete('search')
  const { data, loading, error, retry } = useCatalog(apiParams.toString())
  useEffect(() => { if (params.get('search') === '1') input.current?.focus() }, [params])
  function update(key: string, value: string) { const next = new URLSearchParams(params); value ? next.set(key, value) : next.delete(key); next.delete('page'); setParams(next, { replace: key === 'q' }) }
  const page = data?.page || Number(params.get('page') || 1)
  return <section className="catalog-page container" aria-labelledby="catalog-title">
    <nav className="breadcrumbs" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span>/</span><span>Sản phẩm</span></nav>
    <div className="catalog-editorial"><div className="catalog-heading"><p className="eyebrow">CỬA HÀNG NÀNG GỐM</p><h1 id="catalog-title">Tất cả <em>sản phẩm.</em></h1><p>Chọn một món gốm hợp ý.<br />Để những điều bình thường cũng trở nên đáng yêu.</p></div><figure><SiteImage src="/images/slow-living/lifestyle.jpg" alt="Gốm mộc trên bàn ăn sáng ngập nắng" /><figcaption>Gốm cho từng nếp nhà.</figcaption></figure></div>
    <div className="catalog-discovery"><div className="catalog-controls"><div className="search-panel"><Icon name="search" /><input ref={input} value={params.get('q') || ''} onChange={e => update('q', e.target.value)} placeholder="Tìm món gốm bạn yêu…" aria-label="Tìm kiếm sản phẩm" maxLength={180} /></div><label className="sort-control">Sắp xếp<select value={params.get('sort') || 'default'} onChange={e => update('sort', e.target.value)}><option value="default">Tên sản phẩm</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option><option value="newest">Mới nhất</option></select></label></div>
    <div className="category-tabs" role="group" aria-label="Lọc theo danh mục"><button className={!params.get('category') ? 'category-tab active' : 'category-tab'} onClick={() => update('category', '')}>Tất cả</button>{categories.map(c => <button key={c.id} className={[c.name,c.slug].includes(params.get('category') || '') ? 'category-tab active' : 'category-tab'} onClick={() => update('category', c.slug)}>{c.name}</button>)}</div>
    {categoryError && <p role="alert">Chưa tải được danh mục. <button onClick={() => setCategoryAttempt(n => n + 1)}>Thử lại danh mục</button></p>}
    <details className="catalog-refine"><summary>Tinh chỉnh lựa chọn <Icon name="plus" /></summary><div className="catalog-filter-fields"><label>Giá từ (VND)<input aria-label="Giá từ" type="number" min="0" step="1000" value={params.get('minPrice') || ''} onChange={e => update('minPrice', e.target.value)} /></label><label>Đến (VND)<input aria-label="Giá đến" type="number" min="0" step="1000" value={params.get('maxPrice') || ''} onChange={e => update('maxPrice', e.target.value)} /></label><label>Màu men<input value={params.get('glaze') || ''} onChange={e => update('glaze', e.target.value)} maxLength={120} /></label><label>Công dụng<input value={params.get('use') || ''} onChange={e => update('use', e.target.value)} maxLength={160} /></label></div></details>
    <div className="catalog-toolbar"><label className="sale-filter"><input type="checkbox" checked={sale} onChange={e => { setSale(e.target.checked); update('sale', e.target.checked ? 'true' : '') }} /> Chỉ xem ưu đãi</label><label className="sale-filter"><input type="checkbox" checked={inStock} onChange={e => { setInStock(e.target.checked); update('inStock', e.target.checked ? 'true' : '') }} /> Còn hàng</label><span role="status">{loading ? 'Đang tải sản phẩm…' : data ? `${data.totalCount} sản phẩm` : ''}</span><button className="clear-filters" onClick={() => setParams({})}>Xóa bộ lọc</button></div></div>
    {error && <div className="empty-state" role="alert"><p>{error}</p><button className="button primary" onClick={retry}>Thử lại</button><button onClick={() => setParams({})}>Xóa bộ lọc</button></div>}
    {!loading && data && <><ProductGrid items={data.items.map(p => productView(p))} {...actions} />{!data.totalCount && <div className="empty-state"><h2>Chưa tìm thấy món gốm phù hợp</h2><button onClick={() => setParams({})}>Xem tất cả sản phẩm</button></div>}<div className="catalog-pagination"><button disabled={page <= 1} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page - 1)); setParams(next) }}>Trang trước</button><span>Trang {page}</span><button disabled={page * data.pageSize >= data.totalCount} onClick={() => { const next = new URLSearchParams(params); next.set('page', String(page + 1)); setParams(next) }}>Trang sau</button></div></>}
  </section>
}
