import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BrowserRouter } from 'react-router-dom'
import './styles.css'
import './styles/admin-dashboard.css'
import './styles/admin-assistant.css'
import './styles/admin-system.css'
import './styles/admin-operations.css'
import './styles/admin-reports.css'
import './styles/product-detail.css'
import './styles/purchases.css'
import './styles/checkout-orders.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
