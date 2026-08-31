// ============================================
// 📱 app.js - نسخه ۵.۱ - کد کامل
// ============================================

class HesabdarApp {
  constructor() {
    this.notes = [];
    this.transactions = [];
    this.invoices = [];
    this.customers = [];
    this.products = [];
    this.dashboardLayout = [];
    this.init();
  }

  init() {
    this.loadData();
    this.setupEventListeners();
    this.renderDashboard();
    this.setupDragDrop();
    console.log('✅ نسخه ۵.۱ بارگذاری شد');
  }

  // ============================================
  // 📊 داشبورد شخصی‌سازی شده
  // ============================================

  renderDashboard() {
    const app = document.getElementById('app');
    if (!app) {
      console.error('❌ عنصر app یافت نشد');
      return;
    }

    app.innerHTML = `
      <div class="dashboard-container">
        <div class="dashboard-header">
          <div class="header-left">
            <h1>📊 حسابدار ۵.۱</h1>
            <p class="subtitle">داشبورد شخصی‌سازی شده</p>
          </div>
          <div class="dashboard-controls">
            <button class="btn-customize" onclick="app.openCustomizeModal()">
              ⚙️ شخصی‌سازی
            </button>
            <button class="btn-reset" onclick="app.resetDashboard()">
              🔄 بازگردانی
            </button>
          </div>
        </div>
        
        <div class="dashboard-grid" id="dashboardGrid">
          <!-- ویجت‌ها اینجا قرار می‌گیرند -->
        </div>
      </div>
    `;

    this.loadDashboardLayout();
    this.renderWidgets();
  }

  // ============================================
  // 🎨 مدیریت ویجت‌ها
  // ============================================

  availableWidgets = {
    summary: {
      id: 'summary',
      title: '💰 خلاصه مالی',
      icon: '💰',
      size: 'medium',
      render: () => this.renderSummaryWidget()
    },
    chart: {
      id: 'chart',
      title: '📈 نمودار فروش',
      icon: '📈',
      size: 'large',
      render: () => this.renderChartWidget()
    },
    recentInvoices: {
      id: 'recentInvoices',
      title: '📋 فاکتورهای اخیر',
      icon: '📋',
      size: 'large',
      render: () => this.renderRecentInvoicesWidget()
    },
    topCustomers: {
      id: 'topCustomers',
      title: '👥 مشتری‌های برتر',
      icon: '👥',
      size: 'medium',
      render: () => this.renderTopCustomersWidget()
    },
    topProducts: {
      id: 'topProducts',
      title: '🏆 محصول‌های پرفروش',
      icon: '🏆',
      size: 'medium',
      render: () => this.renderTopProductsWidget()
    },
    calendar: {
      id: 'calendar',
      title: '📅 تقویم',
      icon: '📅',
      size: 'medium',
      render: () => this.renderCalendarWidget()
    },
    clock: {
      id: 'clock',
      title: '⏰ ساعت',
      icon: '⏰',
      size: 'small',
      render: () => this.renderClockWidget()
    },
    goals: {
      id: 'goals',
      title: '🎯 اهداف',
      icon: '🎯',
      size: 'medium',
      render: () => this.renderGoalsWidget()
    },
    stats: {
      id: 'stats',
      title: '📊 آمار',
      icon: '📊',
      size: 'medium',
      render: () => this.renderStatsWidget()
    },
    notifications: {
      id: 'notifications',
      title: '🔔 اطلاع‌رسانی‌ها',
      icon: '🔔',
      size: 'medium',
      render: () => this.renderNotificationsWidget()
    },
    notes: {
      id: 'notes',
      title: '📝 یادداشت‌ها',
      icon: '📝',
      size: 'medium',
      render: () => this.renderNotesWidget()
    },
    quickContacts: {
      id: 'quickContacts',
      title: '📞 مخاطبین سریع',
      icon: '📞',
      size: 'small',
      render: () => this.renderQuickContactsWidget()
    }
  };

  renderWidgets() {
    const grid = document.getElementById('dashboardGrid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (this.dashboardLayout.length === 0) {
      this.dashboardLayout = Object.keys(this.availableWidgets);
      this.saveDashboardLayout();
    }

    this.dashboardLayout.forEach(widgetId => {
      const widget = this.availableWidgets[widgetId];
      if (widget) {
        const widgetElement = this.createWidgetElement(widget);
        grid.appendChild(widgetElement);
      }
    });
  }

  createWidgetElement(widget) {
    const div = document.createElement('div');
    div.className = `widget widget-${widget.size}`;
    div.id = `widget-${widget.id}`;
    div.draggable = true;
    
    div.innerHTML = `
      <div class="widget-header">
        <h3>${widget.title}</h3>
        <div class="widget-actions">
          <button class="btn-widget-remove" onclick="app.removeWidget('${widget.id}', event)">
            ✕
          </button>
        </div>
      </div>
      <div class="widget-content">
        ${widget.render()}
      </div>
    `;

    // ✅ رفع: event.stopPropagation()
    div.addEventListener('click', (e) => {
      if (e.target.closest('.btn-widget-remove')) {
        e.stopPropagation();
      }
    });

    // Drag & Drop
    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('widgetId', widget.id);
      div.classList.add('dragging');
    });

    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
    });

    div.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      div.classList.add('drag-over');
    });

    div.addEventListener('dragleave', () => {
      div.classList.remove('drag-over');
    });

    div.addEventListener('drop', (e) => {
      e.preventDefault();
      div.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('widgetId');
      this.reorderWidgets(draggedId, widget.id);
    });

    return div;
  }

  // ============================================
  // 🎮 مدیریت شخصی‌سازی
  // ============================================

  openCustomizeModal() {
    // بستن modal قبلی
    const existingModal = document.querySelector('.modal-customize');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'modal-customize';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>⚙️ شخصی‌سازی داشبورد</h2>
          <button class="btn-close" onclick="app.closeModal()">✕</button>
        </div>
        
        <div class="modal-body">
          <h3>ویجت‌های موجود:</h3>
          <p class="modal-subtitle">ویجت‌های مورد نظر را انتخاب کنید</p>
          <div class="widgets-list">
            ${this.renderWidgetsList()}
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-primary" onclick="app.saveAndCloseModal()">
            ✓ ذخیره
          </button>
          <button class="btn btn-secondary" onclick="app.closeModal()">
            ✕ بستن
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    
    // بستن با کلیک خارج از modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        app.closeModal();
      }
    });

    // بستن با Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        app.closeModal();
      }
    });
  }

  renderWidgetsList() {
    return Object.entries(this.availableWidgets).map(([id, widget]) => {
      const isActive = this.dashboardLayout.includes(id);
      return `
        <div class="widget-list-item">
          <input 
            type="checkbox" 
            id="widget-${id}" 
            ${isActive ? 'checked' : ''}
            onchange="app.toggleWidget('${id}', this.checked)"
          >
          <label for="widget-${id}">
            <span class="widget-icon">${widget.icon}</span>
            <span class="widget-name">${widget.title}</span>
          </label>
        </div>
      `;
    }).join('');
  }

  toggleWidget(widgetId, isChecked) {
    if (isChecked) {
      if (!this.dashboardLayout.includes(widgetId)) {
        this.dashboardLayout.push(widgetId);
      }
    } else {
      this.dashboardLayout = this.dashboardLayout.filter(id => id !== widgetId);
    }
  }

  removeWidget(widgetId, event) {
    event.stopPropagation();
    if (confirm('آیا این ویجت را حذف می‌کنید؟')) {
      this.dashboardLayout = this.dashboardLayout.filter(id => id !== widgetId);
      this.saveDashboardLayout();
      this.renderWidgets();
    }
  }

  reorderWidgets(fromId, toId) {
    const fromIndex = this.dashboardLayout.indexOf(fromId);
    const toIndex = this.dashboardLayout.indexOf(toId);

    if (fromIndex > -1 && toIndex > -1 && fromIndex !== toIndex) {
      [this.dashboardLayout[fromIndex], this.dashboardLayout[toIndex]] = 
      [this.dashboardLayout[toIndex], this.dashboardLayout[fromIndex]];
      this.saveDashboardLayout();
      this.renderWidgets();
    }
  }

  resetDashboard() {
    if (confirm('آیا مطمئن هستید؟ تمام تنظیمات بازگردانی می‌شود.')) {
      this.dashboardLayout = Object.keys(this.availableWidgets);
      this.saveDashboardLayout();
      this.renderWidgets();
    }
  }

  closeModal() {
    const modal = document.querySelector('.modal-customize');
    if (modal) {
      modal.remove();
    }
  }

  saveAndCloseModal() {
    this.saveDashboardLayout();
    this.renderWidgets();
    this.closeModal();
  }

  // ============================================
  // 📊 ویجت‌های مختلف
  // ============================================

  renderSummaryWidget() {
    const totalIncome = this.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const totalExpense = this.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const profit = totalIncome - totalExpense;

    return `
      <div class="summary-grid">
        <div class="summary-item income">
          <span class="label">درآمد</span>
          <span class="value">${totalIncome.toLocaleString('fa-IR')}</span>
        </div>
        <div class="summary-item expense">
          <span class="label">هزینه</span>
          <span class="value">${totalExpense.toLocaleString('fa-IR')}</span>
        </div>
        <div class="summary-item profit">
          <span class="label">سود</span>
          <span class="value">${profit.toLocaleString('fa-IR')}</span>
        </div>
      </div>
    `;
  }

  renderChartWidget() {
    return `
      <div class="chart-container">
        <p style="text-align: center; color: #999;">📈 نمودار فروش</p>
        <div style="height: 200px; background: #f5f5f5; border-radius: 5px;"></div>
      </div>
    `;
  }

  renderRecentInvoicesWidget() {
    const recent = this.invoices.slice(-5).reverse();
    if (recent.length === 0) {
      return '<p style="text-align: center; color: #999;">فاکتوری موجود نیست</p>';
    }
    return `
      <div class="recent-list">
        ${recent.map(inv => `
          <div class="recent-item">
            <span class="invoice-number">${inv.number || 'N/A'}</span>
            <span class="invoice-customer">${inv.customer || 'نامشخص'}</span>
            <span class="invoice-amount">${(inv.amount || 0).toLocaleString('fa-IR')}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderTopCustomersWidget() {
    return `
      <div class="top-list">
        <p style="text-align: center; color: #999;">👥 بهترین مشتری‌ها</p>
        <div style="padding: 20px; text-align: center; color: #ccc;">
          داده‌ای موجود نیست
        </div>
      </div>
    `;
  }

  renderTopProductsWidget() {
    return `
      <div class="top-list">
        <p style="text-align: center; color: #999;">🏆 محصول‌های پرفروش</p>
        <div style="padding: 20px; text-align: center; color: #ccc;">
          داده‌ای موجود نیست
        </div>
      </div>
    `;
  }

  renderCalendarWidget() {
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = today.toLocaleDateString('fa-IR', options);
    return `
      <div class="calendar">
        <p style="font-size: 16px; font-weight: bold; text-align: center;">
          ${dateStr}
        </p>
      </div>
    `;
  }

  renderClockWidget() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fa-IR');
    return `
      <div class="clock">
        <p style="font-size: 24px; font-weight: bold; text-align: center;">
          ${timeStr}
        </p>
      </div>
    `;
  }

  renderGoalsWidget() {
    return `
      <div class="goals-list">
        <p style="text-align: center; color: #999;">🎯 اهداف ماهانه</p>
        <div style="padding: 20px; text-align: center; color: #ccc;">
          هدفی تعریف نشده است
        </div>
      </div>
    `;
  }

  renderStatsWidget() {
    return `
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">فاکتورها</span>
          <span class="stat-value">${this.invoices.length}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">مشتری‌ها</span>
          <span class="stat-value">${this.customers.length}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">محصول‌ها</span>
          <span class="stat-value">${this.products.length}</span>
        </div>
      </div>
    `;
  }

  renderNotificationsWidget() {
    return `
      <div class="notifications-list">
        <p style="text-align: center; color: #999;">🔔 اطلاع‌رسانی‌ها</p>
        <div style="padding: 20px; text-align: center; color: #ccc;">
          اطلاع‌رسانی جدیدی نیست
        </div>
      </div>
    `;
  }

  renderNotesWidget() {
    if (this.notes.length === 0) {
      return '<p style="text-align: center; color: #999;">یادداشتی موجود نیست</p>';
    }
    return `
      <div class="notes-list">
        ${this.notes.slice(-3).map(note => `
          <div class="note-item">
            ${note.text}
          </div>
        `).join('')}
      </div>
    `;
  }

  renderQuickContactsWidget() {
    return `
      <div class="contacts-list">
        <p style="text-align: center; color: #999;">📞 مخاطبین</p>
        <div style="padding: 20px; text-align: center; color: #ccc;">
          مخاطبی موجود نیست
        </div>
      </div>
    `;
  }

  // ============================================
  // 💾 ذخیره‌سازی
  // ============================================

  saveDashboardLayout() {
    try {
      localStorage.setItem('dashboardLayout', JSON.stringify(this.dashboardLayout));
    } catch (e) {
      console.error('خطا در ذخیره:', e);
    }
  }

  loadDashboardLayout() {
    try {
      const saved = localStorage.getItem('dashboardLayout');
      if (saved) {
        this.dashboardLayout = JSON.parse(saved);
      } else {
        this.dashboardLayout = Object.keys(this.availableWidgets);
      }
    } catch (e) {
      console.error('خطا در بارگذاری:', e);
      this.dashboardLayout = Object.keys(this.availableWidgets);
    }
  }

  saveData() {
    try {
      localStorage.setItem('hesabdar_notes', JSON.stringify(this.notes));
      localStorage.setItem('hesabdar_transactions', JSON.stringify(this.transactions));
      localStorage.setItem('hesabdar_invoices', JSON.stringify(this.invoices));
    } catch (e) {
      console.error('خطا در ذخیره:', e);
    }
  }

  loadData() {
    try {
      this.notes = JSON.parse(localStorage.getItem('hesabdar_notes') || '[]');
      this.transactions = JSON.parse(localStorage.getItem('hesabdar_transactions') || '[]');
      this.invoices = JSON.parse(localStorage.getItem('hesabdar_invoices') || '[]');
      this.customers = JSON.parse(localStorage.getItem('hesabdar_customers') || '[]');
      this.products = JSON.parse(localStorage.getItem('hesabdar_products') || '[]');
    } catch (e) {
      console.error('خطا در بارگذاری:', e);
    }
  }

  setupEventListeners() {
    // Event listeners
  }

  setupDragDrop() {
    // Drag & Drop setup
  }
}

// شروع اپلیکیشن
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new HesabdarApp();
});

// مدیریت خطاها
window.addEventListener('error', (e) => {
  console.error('❌ خطا:', e.message);
});
