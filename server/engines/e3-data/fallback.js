/**
 * In-memory fallback dataset for when MySQL / XAMPP is offline.
 * Mirrors seed.sql exactly, allowing full live demo and testing without DB connection errors.
 */

const ROLES = [
  { id: 1, name: 'ADMIN', description: 'Runs the platform: users, roles, audit', parentRoleId: null, staffLogin: false },
  { id: 2, name: 'CUSTOMER', description: 'Shops, places orders, tracks deliveries', parentRoleId: null, staffLogin: false },
  { id: 3, name: 'EMPLOYEE', description: 'Base role for internal staff (abstract parent)', parentRoleId: null, staffLogin: false },
  { id: 4, name: 'FINANCE', description: 'Payments, refunds and financial reports', parentRoleId: 3, staffLogin: true },
  { id: 5, name: 'WAREHOUSE_STAFF', description: 'Packs and ships orders, keeps stock accurate', parentRoleId: 3, staffLogin: true },
  { id: 6, name: 'SELLER', description: 'Lists products and manages own inventory', parentRoleId: null, staffLogin: false },
  { id: 7, name: 'CEO', description: 'Future scope: oversight (no permissions yet)', parentRoleId: null, staffLogin: true },
];

const GRANTS = [
  // Admin
  { roleId: 1, perm: 'user:read' }, { roleId: 1, perm: 'user:assign_role' }, { roleId: 1, perm: 'user:deactivate' },
  { roleId: 1, perm: 'role:manage' }, { roleId: 1, perm: 'audit:read' }, { roleId: 1, perm: 'product:read' },
  { roleId: 1, perm: 'product:create' }, { roleId: 1, perm: 'product:update' }, { roleId: 1, perm: 'product:delete' },
  { roleId: 1, perm: 'product:approve' }, { roleId: 1, perm: 'stock:read' }, { roleId: 1, perm: 'stock:update' },
  { roleId: 1, perm: 'order:read' }, { roleId: 1, perm: 'order:update_status' }, { roleId: 1, perm: 'payment:read' },
  { roleId: 1, perm: 'refund:approve' }, { roleId: 1, perm: 'report:read' }, { roleId: 1, perm: 'category:manage' },
  // Customer
  { roleId: 2, perm: 'product:read' }, { roleId: 2, perm: 'order:create' }, { roleId: 2, perm: 'order:read_own' },
  { roleId: 2, perm: 'order:cancel_own' }, { roleId: 2, perm: 'payment:create' }, { roleId: 2, perm: 'payment:read_own' },
  { roleId: 2, perm: 'refund:request_own' }, { roleId: 2, perm: 'user:read_own' }, { roleId: 2, perm: 'user:update_own' },
  // Employee
  { roleId: 3, perm: 'product:read' }, { roleId: 3, perm: 'user:read_own' }, { roleId: 3, perm: 'user:update_own' },
  // Finance
  { roleId: 4, perm: 'order:read' }, { roleId: 4, perm: 'payment:read' }, { roleId: 4, perm: 'refund:approve' }, { roleId: 4, perm: 'report:read' },
  // Warehouse Staff
  { roleId: 5, perm: 'order:read' }, { roleId: 5, perm: 'order:update_status' }, { roleId: 5, perm: 'stock:read' }, { roleId: 5, perm: 'stock:update' },
  // Seller
  { roleId: 6, perm: 'product:read' }, { roleId: 6, perm: 'product:create' }, { roleId: 6, perm: 'product:update_own' },
  { roleId: 6, perm: 'product:delete_own' }, { roleId: 6, perm: 'stock:read' }, { roleId: 6, perm: 'shop:update_own' },
  { roleId: 6, perm: 'user:read_own' }, { roleId: 6, perm: 'user:update_own' },
];

const HASH = '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly'; // Password@123

const USERS = [
  { id: 1, name: 'Riya Admin', email: 'admin@team3.test', passwordHash: HASH, roleId: 1, role: 'ADMIN', isActive: true, tokenVersion: 0, failedLogins: 0, lockedUntil: null },
  { id: 2, name: 'Arjun Mehta', email: 'customer@team3.test', passwordHash: HASH, roleId: 2, role: 'CUSTOMER', isActive: true, tokenVersion: 0, failedLogins: 0, lockedUntil: null },
  { id: 3, name: 'Kavya Crafts', email: 'seller1@team3.test', passwordHash: HASH, roleId: 6, role: 'SELLER', isActive: true, tokenVersion: 0, failedLogins: 0, lockedUntil: null },
  { id: 4, name: 'Nilgiri Goods', email: 'seller2@team3.test', passwordHash: HASH, roleId: 6, role: 'SELLER', isActive: true, tokenVersion: 0, failedLogins: 0, lockedUntil: null },
  { id: 5, name: 'Priya Finance', email: 'finance@team3.test', passwordHash: HASH, roleId: 4, role: 'FINANCE', isActive: true, tokenVersion: 0, failedLogins: 0, lockedUntil: null },
  { id: 6, name: 'Rahul Warehouse', email: 'warehouse@team3.test', passwordHash: HASH, roleId: 5, role: 'WAREHOUSE_STAFF', isActive: true, tokenVersion: 0, failedLogins: 0, lockedUntil: null },
  { id: 7, name: 'Vikram CEO', email: 'ceo@team3.test', passwordHash: HASH, roleId: 7, role: 'CEO', isActive: true, tokenVersion: 0, failedLogins: 0, lockedUntil: null },
];

const CATEGORIES = [
  { id: 1, slug: 'electronics', name: 'Electronics', parentId: null },
  { id: 2, slug: 'audio', name: 'Audio', parentId: 1 },
  { id: 3, slug: 'mobile', name: 'Mobile accessories', parentId: 1 },
  { id: 4, slug: 'home', name: 'Home & Living', parentId: null },
  { id: 5, slug: 'furniture', name: 'Furniture', parentId: 4 },
  { id: 6, slug: 'decor', name: 'Decor', parentId: 4 },
  { id: 7, slug: 'beauty', name: 'Beauty', parentId: null },
  { id: 8, slug: 'skincare', name: 'Skincare', parentId: 7 },
  { id: 9, slug: 'makeup', name: 'Makeup', parentId: 7 },
];

const PRODUCTS = [
  { id: 1, sellerId: 3, sellerName: 'Kavya Crafts', name: 'Jacquard Case', description: 'Soft-touch silicone phone case in warm tan, raised edges for the camera.', price: 4000, mrp: 4999, rating: 4.5, reviews: 1240, stock: 60, image: 'jacquard-case', imageUrl: '/img/products/jacquard-case.png', featured: 1, status: 'APPROVED', categories: ['electronics', 'mobile'] },
  { id: 2, sellerId: 3, sellerName: 'Kavya Crafts', name: 'ANC Zony XM5', description: 'Over-ear wireless headphones with adaptive noise cancelling and 30 h battery.', price: 55000, mrp: 64990, rating: 4.7, reviews: 3301, stock: 14, image: 'anc-zony-xm5', imageUrl: '/img/products/anc-zony-xm5.png', featured: 1, status: 'APPROVED', categories: ['electronics', 'audio'] },
  { id: 3, sellerId: 4, sellerName: 'Nilgiri Goods', name: 'True Wireless Bud', description: 'Compact earbuds with charging case, 24 h total playback.', price: 7000, mrp: 9999, rating: 4.3, reviews: 2876, stock: 40, image: 'true-wireless-bud', imageUrl: '/img/products/true-wireless-bud.png', featured: 1, status: 'APPROVED', categories: ['electronics', 'audio', 'mobile'] },
  { id: 4, sellerId: 4, sellerName: 'Nilgiri Goods', name: 'Woofer', description: 'Bookshelf speaker in matte black, deep bass from a 6.5 inch driver.', price: 79999, mrp: 89999, rating: 4.4, reviews: 640, stock: 9, image: 'woofer', imageUrl: '/img/products/woofer.png', featured: 0, status: 'APPROVED', categories: ['electronics', 'audio'] },
  { id: 5, sellerId: 3, sellerName: 'Kavya Crafts', name: 'Cleopatric Chair', description: 'Rust-brown lounge chair with tapered walnut legs.', price: 45000, mrp: 52000, rating: 4.6, reviews: 412, stock: 6, image: 'cleopatric-chair', imageUrl: '/img/products/cleopatric-chair.png', featured: 0, status: 'APPROVED', categories: ['home', 'furniture'] },
  { id: 6, sellerId: 4, sellerName: 'Nilgiri Goods', name: 'Borivili Chase', description: 'Tufted boucle armchair with a curved shell and wooden legs.', price: 55000, mrp: 55000, rating: 4.5, reviews: 288, stock: 4, image: 'borivili-chase', imageUrl: '/img/products/borivili-chase.png', featured: 1, status: 'APPROVED', categories: ['home', 'furniture'] },
];

const INITIAL_ORDERS = [
  {
    id: 1, customerId: 2, customerName: 'Arjun Mehta', customerEmail: 'customer@team3.test', status: 'PAID',
    subtotal: 59000, shippingFee: 0, total: 59000, shippingName: 'Arjun Mehta',
    shippingAddress: 'Flat 402, Royal Palms, 12th Main, Indiranagar, Bengaluru', shippingPincode: '560038', shippingPhone: '9876543210',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), updatedAt: new Date().toISOString(),
    items: [
      { productId: 1, name: 'Jacquard Case', unitPrice: 4000, quantity: 1, lineTotal: 4000, image: 'jacquard-case', stock: 60 },
      { productId: 2, name: 'ANC Zony XM5', unitPrice: 55000, quantity: 1, lineTotal: 55000, image: 'anc-zony-xm5', stock: 14 },
    ]
  },
  {
    id: 2, customerId: 2, customerName: 'Arjun Mehta', customerEmail: 'customer@team3.test', status: 'PAID',
    subtotal: 14000, shippingFee: 150, total: 14150, shippingName: 'Arjun Mehta',
    shippingAddress: 'Villa 12, Palm Meadows, Whitefield, Bengaluru', shippingPincode: '560066', shippingPhone: '9876543210',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(), updatedAt: new Date().toISOString(),
    items: [
      { productId: 3, name: 'True Wireless Bud', unitPrice: 7000, quantity: 2, lineTotal: 14000, image: 'true-wireless-bud', stock: 40 },
    ]
  },
  {
    id: 3, customerId: 2, customerName: 'Pooja Sharma', customerEmail: 'pooja@team3.test', status: 'PACKED',
    subtotal: 4000, shippingFee: 100, total: 4100, shippingName: 'Pooja Sharma',
    shippingAddress: 'Plot 88, Road No. 36, Jubilee Hills, Hyderabad', shippingPincode: '500033', shippingPhone: '9812345678',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(), updatedAt: new Date().toISOString(),
    items: [
      { productId: 1, name: 'Jacquard Case', unitPrice: 4000, quantity: 1, lineTotal: 4000, image: 'jacquard-case', stock: 60 },
    ]
  },
  {
    id: 4, customerId: 2, customerName: 'Rohan Verma', customerEmail: 'rohan@team3.test', status: 'SHIPPED',
    subtotal: 55000, shippingFee: 0, total: 55000, shippingName: 'Rohan Verma',
    shippingAddress: 'Sector 14, DLF Phase 2, Gurugram, Haryana', shippingPincode: '122002', shippingPhone: '9988776655',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(), updatedAt: new Date().toISOString(),
    items: [
      { productId: 2, name: 'ANC Zony XM5', unitPrice: 55000, quantity: 1, lineTotal: 55000, image: 'anc-zony-xm5', stock: 14 },
    ]
  },
  {
    id: 5, customerId: 2, customerName: 'Neha Kapoor', customerEmail: 'neha@team3.test', status: 'PAID',
    subtotal: 110000, shippingFee: 0, total: 110000, shippingName: 'Neha Kapoor',
    shippingAddress: 'B-104, Sea Mist Apts, Bandra West, Mumbai', shippingPincode: '400050', shippingPhone: '9820011223',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(), updatedAt: new Date().toISOString(),
    items: [
      { productId: 6, name: 'Borivili Chase', unitPrice: 55000, quantity: 2, lineTotal: 110000, image: 'borivili-chase', stock: 4 },
    ]
  }
];

let ORDERS = JSON.parse(JSON.stringify(INITIAL_ORDERS));

const fallback = {
  roles: {
    async all() { return ROLES; },
    async grants() { return GRANTS; },
  },
  users: {
    async byEmail(email) {
      return USERS.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
    },
    async byEmailWithHash(email) {
      return USERS.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
    },
    async byId(id) {
      return USERS.find((u) => u.id === Number(id)) || null;
    },
    clearFailures() {},
    recordFailure() {},
    async all() { return USERS; },
    async countByRole() {
      const m = new Map();
      USERS.forEach((u) => m.set(u.roleId, (m.get(u.roleId) || 0) + 1));
      return m;
    },
    recordLoginFailure() {},
    resetLoginFailures() {},
    async usage() { return { products: 0, orders: 0 }; },
    async remove() { return true; },
  },
  sellers: {
    async list() { return []; },
    async countByStatus() { return { PENDING: 0, APPROVED: 2, REJECTED: 0 }; },
    async review() { return true; },
    async reapply() { return true; },
  },
  catalog: {
    async all() { return PRODUCTS; },
    async byId(id) { return PRODUCTS.find((p) => p.id === Number(id)) || null; },
    async categories() { return CATEGORIES; },
    async statusCounts() { return { APPROVED: 5, SOLD_OUT: 1, PENDING: 0 }; },
    async lowStockCount() { return 2; },
    async updatePriceStock(id, { price, stock }) {
      const p = PRODUCTS.find((x) => x.id === Number(id));
      if (p) {
        if (stock !== null && stock !== undefined) p.stock = stock;
        if (price !== null && price !== undefined) p.price = price;
      }
      return p;
    },
  },
  categories: {
    async all() { return CATEGORIES; },
    async usage() { return { products: 1, children: 0 }; },
  },
  shops: {
    async bySeller() { return null; },
    async bySlug() { return null; },
  },
  stats: {
    async decisionsByDay() { return []; },
    async topDenials() { return []; },
  },
  audit: {
    insert() {},
    async page() { return { rows: [], total: 0 }; },
  },
  orders: {
    reset() {
      ORDERS = JSON.parse(JSON.stringify(INITIAL_ORDERS));
      return ORDERS;
    },
    async allForOps() {
      return ORDERS;
    },
    async byId(id) {
      return ORDERS.find((o) => o.id === Number(id)) || null;
    },
    async updateStatus(id, newStatus, changedByUserId, note = '') {
      const o = ORDERS.find((x) => x.id === Number(id));
      if (!o) return null;
      o.status = newStatus;
      o.updatedAt = new Date().toISOString();
      return { ...o };
    },
  },
};

module.exports = fallback;
