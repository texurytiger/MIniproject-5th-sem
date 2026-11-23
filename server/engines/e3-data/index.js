/**
 * E3 · DBMS — the only module that runs SQL.
 * Other engines call these functions; they never import the pool or write queries themselves.
 */
const pool = require('../../core/db');

const userCols = `u.id, u.name, u.email, u.role_id AS roleId, r.name AS role, u.is_active AS isActive,
  u.token_version AS tokenVersion, u.failed_logins AS failedLogins, u.locked_until AS lockedUntil,
  (u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS isLocked, u.created_at AS createdAt`;
const shapeUser = (u) => u && { ...u, isActive: !!u.isActive, isLocked: !!u.isLocked };

const users = {
  async byId(id) {
    const [rows] = await pool.query(`SELECT ${userCols} FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, [id]);
    return shapeUser(rows[0]);
  },
  async byEmailWithHash(email) {
    const [rows] = await pool.query(`SELECT ${userCols}, u.password_hash AS passwordHash FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ?`, [email]);
    return shapeUser(rows[0]);
  },
  async hashById(id) {
    const [rows] = await pool.query('SELECT password_hash AS h FROM users WHERE id = ?', [id]);
    return rows[0] && rows[0].h;
  },
  async list() {
    const [rows] = await pool.query(`SELECT ${userCols} FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id`);
    return rows.map(shapeUser);
  },
  async create({ name, email, passwordHash, roleId }) {
    const [r] = await pool.query('INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)', [name, email, passwordHash, roleId]);
    return r.insertId;
  },
  setRole: (id, roleId) => pool.query('UPDATE users SET role_id = ? WHERE id = ?', [roleId, id]),
  setActive: (id, active) => pool.query('UPDATE users SET is_active = ?, token_version = token_version + 1 WHERE id = ?', [active ? 1 : 0, id]),
  bumpTokenVersion: (id) => pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id]),
  setPassword: (id, hash) => pool.query('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, id]),
  updateName: (id, name) => pool.query('UPDATE users SET name = ? WHERE id = ?', [name, id]),
  /** Wrong password from an unknown device: count it, and lock for new devices on the Nth one. */
  recordFailure: (id, lockAfter, lockMinutes) => pool.query(
    `UPDATE users SET failed_logins = failed_logins + 1,
       locked_until = IF(failed_logins >= ?, NOW() + INTERVAL ? MINUTE, locked_until)  -- MySQL applies SET left to right: failed_logins is already +1 here
     WHERE id = ?`, [lockAfter, lockMinutes, id]),
  clearFailures: (id) => pool.query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [id]),
  countByRole: async () => {
    const [rows] = await pool.query('SELECT role_id AS roleId, COUNT(*) AS n FROM users GROUP BY role_id');
    return new Map(rows.map((r) => [r.roleId, r.n]));
  },
};

const roles = {
  async all() {
    const [rows] = await pool.query('SELECT id, name, description, parent_role_id AS parentRoleId, staff_login AS staffLogin FROM roles ORDER BY id');
    return rows.map((r) => ({ ...r, staffLogin: !!r.staffLogin }));
  },
  async grants() {
    const [rows] = await pool.query(
      `SELECT rp.role_id AS roleId, CONCAT(p.resource, ':', p.action) AS perm
         FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id`);
    return rows;
  },
  async create({ name, description, parentRoleId }) {
    const [r] = await pool.query('INSERT INTO roles (name, description, parent_role_id) VALUES (?, ?, ?)', [name, description || '', parentRoleId]);
    return r.insertId;
  },
  setParent: (id, parentRoleId) => pool.query('UPDATE roles SET parent_role_id = ? WHERE id = ?', [parentRoleId, id]),
  /** Grant and revoke in one transaction: all or nothing. */
  async changePermissions(roleId, grant, revoke) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (grant.length) await conn.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES ?', [grant.map((p) => [roleId, p])]);
      if (revoke.length) await conn.query('DELETE FROM role_permissions WHERE role_id = ? AND permission_id IN (?)', [roleId, revoke]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },
};

const permissions = {
  async all() {
    const [rows] = await pool.query('SELECT id, resource, action, description FROM permissions ORDER BY resource, action');
    return rows;
  },
};

const audit = {
  /** Insert-only: there is no update or delete function on purpose. */
  insert: (e) => pool.query(
    'INSERT INTO audit_log (user_id, email, resource, action, owner_id, decision, reason, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [e.userId ?? null, e.email ?? null, e.resource, e.action, e.ownerId ?? null, e.decision, e.reason, e.ip ?? null]),
  async page({ page, pageSize, decision, resource, userId }) {
    const where = []; const args = [];
    if (decision) { where.push('decision = ?'); args.push(decision); }
    if (resource) { where.push('resource = ?'); args.push(resource); }
    if (userId) { where.push('user_id = ?'); args.push(userId); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_log ${w}`, args);
    const [rows] = await pool.query(
      `SELECT id, user_id AS userId, email, resource, action, owner_id AS ownerId, decision, reason, ip, created_at AS createdAt
         FROM audit_log ${w} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, pageSize, (page - 1) * pageSize]);
    return { entries: rows, total };
  },
};

const productCols = `p.id, p.seller_id AS sellerId, s.name AS sellerName, sh.slug AS shopSlug, sh.name AS shopName,
  p.name, p.description, p.price, p.mrp, p.rating, p.reviews, p.stock, p.image, p.image_url AS imageUrl, p.featured, p.status,
  p.created_at AS createdAt,
  (SELECT GROUP_CONCAT(c.slug ORDER BY c.parent_id IS NOT NULL, c.id SEPARATOR ',') FROM product_categories pc
     JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = p.id) AS categorySlugs,
  (SELECT GROUP_CONCAT(c.name ORDER BY c.parent_id IS NOT NULL, c.id SEPARATOR '|') FROM product_categories pc
     JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = p.id) AS categoryNames`;
const productFrom = 'FROM products p JOIN users s ON s.id = p.seller_id LEFT JOIN shops sh ON sh.seller_id = p.seller_id';

/** Turn the GROUP_CONCAT strings into arrays; keep `category`/`categoryName` (first one) for older pages. */
function shapeProduct(r) {
  if (!r) return r;
  const categories = r.categorySlugs ? r.categorySlugs.split(',') : [];
  const categoryNames = r.categoryNames ? r.categoryNames.split('|') : [];
  const { categorySlugs, ...rest } = r;
  return { ...rest, featured: !!r.featured, categories, categoryNames, category: categories[0] || null, categoryName: categoryNames[0] || null };
}
const shapeAll = (rows) => rows.map(shapeProduct);

const SORTS = {
  featured: 'p.reviews DESC, p.id',
  price_asc: 'p.price ASC, p.id',
  price_desc: 'p.price DESC, p.id',
  rating: 'p.rating DESC, p.reviews DESC',
  newest: 'p.created_at DESC, p.id DESC',
};

const catalog = {
  /** Every category with its parent and how many APPROVED products sit directly in it. */
  async categories() {
    const [rows] = await pool.query(
      `SELECT c.id, c.slug, c.name, c.parent_id AS parentId, COUNT(DISTINCT p.id) AS products
         FROM categories c
         LEFT JOIN product_categories pc ON pc.category_id = c.id
         LEFT JOIN products p ON p.id = pc.product_id AND p.status = 'APPROVED'
        GROUP BY c.id ORDER BY c.parent_id IS NOT NULL, c.name`);
    return rows;
  },
  /**
   * Storefront: APPROVED only. categoryIds = the chosen category plus all its sub-categories (worked out by the caller).
   * q uses the FULLTEXT index, with a LIKE fallback.
   */
  async storefront({ categoryIds, q, limit, sort, minPrice, maxPrice, minRating }) {
    const where = ["p.status = 'APPROVED'"]; const args = [];
    if (categoryIds && categoryIds.length) {
      where.push('EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id AND pc.category_id IN (?))');
      args.push(categoryIds);
    }
    if (q) {
      // FULLTEXT boolean mode treats + - " * ( ) ~ < > @ as operators, so a query like "' OR 1=1 --" is a syntax error.
      // Keep only letters, digits and spaces for MATCH; LIKE gets the original text as a normal parameter.
      const words = q.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).map((w) => `${w}*`).join(' ');
      if (words) { where.push('(MATCH(p.name, p.description) AGAINST (? IN BOOLEAN MODE) OR p.name LIKE ?)'); args.push(words, `%${q}%`); }
      else { where.push('p.name LIKE ?'); args.push(`%${q}%`); }
    }
    if (minPrice != null) { where.push('p.price >= ?'); args.push(minPrice); }
    if (maxPrice != null) { where.push('p.price <= ?'); args.push(maxPrice); }
    if (minRating != null) { where.push('p.rating >= ?'); args.push(minRating); }
    const order = SORTS[sort] || SORTS.featured;
    const [rows] = await pool.query(`SELECT ${productCols} ${productFrom} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ?`, [...args, limit]);
    return shapeAll(rows);
  },
  async priceRange() {
    const [[r]] = await pool.query("SELECT MIN(price) AS min, MAX(price) AS max FROM products WHERE status = 'APPROVED'");
    return { min: Number(r.min || 0), max: Number(r.max || 0) };
  },
  async byId(id) {
    const [rows] = await pool.query(`SELECT ${productCols} ${productFrom} WHERE p.id = ?`, [id]);
    return shapeProduct(rows[0]);
  },
  async bySeller(sellerId) {
    const [rows] = await pool.query(`SELECT ${productCols} ${productFrom} WHERE p.seller_id = ? ORDER BY p.id`, [sellerId]);
    return shapeAll(rows);
  },
  async all() {
    const [rows] = await pool.query(`SELECT ${productCols} ${productFrom} ORDER BY p.id`);
    return shapeAll(rows);
  },
  /** Price/stock edit. Stock 0 flips an APPROVED product to SOLD_OUT and back on restock. */
  async updatePriceStock(id, { price, stock }) {
    await pool.query(
      `UPDATE products SET price = COALESCE(?, price), stock = COALESCE(?, stock),
         status = CASE WHEN status = 'PENDING' THEN 'PENDING' WHEN COALESCE(?, stock) = 0 THEN 'SOLD_OUT' ELSE 'APPROVED' END
       WHERE id = ?`, [price, stock, stock, id]);
  },
  approve: (id) => pool.query("UPDATE products SET status = IF(stock = 0, 'SOLD_OUT', 'APPROVED') WHERE id = ? AND status = 'PENDING'", [id]),
  /** Create a new catalog item with its categories in ONE transaction. */
  async create({ sellerId, name, description, price, mrp, stock, image, imageUrl, categoryIds }) {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      const [res] = await c.query(
        `INSERT INTO products (seller_id, name, description, price, mrp, stock, image, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED')`,
        [sellerId, name, description || '', price, mrp != null ? mrp : price, stock || 0, image || 'book', imageUrl || null]
      );
      const productId = res.insertId;
      if (categoryIds && categoryIds.length) {
        await c.query(
          'INSERT INTO product_categories (product_id, category_id) VALUES ?',
          [categoryIds.map((cid) => [productId, cid])]
        );
      }
      await c.commit();
      return productId;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  },
  /** Replace a product's categories in ONE transaction (all or nothing). */
  async setCategories(productId, categoryIds) {
    const c = await pool.getConnection();
    try {
      await c.beginTransaction();
      await c.query('DELETE FROM product_categories WHERE product_id = ?', [productId]);
      if (categoryIds.length) await c.query('INSERT INTO product_categories (product_id, category_id) VALUES ?', [categoryIds.map((cid) => [productId, cid])]);
      await c.commit();
    } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
  },
  setFeatured: (productId, featured) => pool.query('UPDATE products SET featured = ? WHERE id = ?', [featured ? 1 : 0, productId]),
  async statusCounts(sellerId = null) {
    const [rows] = await pool.query(
      `SELECT status, COUNT(*) AS n FROM products ${sellerId ? 'WHERE seller_id = ?' : ''} GROUP BY status`, sellerId ? [sellerId] : []);
    return Object.fromEntries(['APPROVED', 'PENDING', 'SOLD_OUT'].map((s) => [s, Number((rows.find((r) => r.status === s) || {}).n || 0)]));
  },
  async lowStockCount(threshold) {
    const [[r]] = await pool.query("SELECT COUNT(*) AS n FROM products WHERE stock <= ? AND status <> 'PENDING'", [threshold]);
    return Number(r.n);
  },
};

/** Category tree (admin-managed). The parent link may point at any category; E1-style cycle checks run before saving. */
const categories = {
  async all() {
    const [rows] = await pool.query('SELECT id, slug, name, parent_id AS parentId FROM categories ORDER BY id');
    return rows;
  },
  async create({ slug, name, parentId }) {
    const [r] = await pool.query('INSERT INTO categories (slug, name, parent_id) VALUES (?, ?, ?)', [slug, name, parentId || null]);
    return r.insertId;
  },
  update: (id, { name, parentId }) => pool.query('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?', [name, parentId || null, id]),
  async usage(id) {
    const [[r]] = await pool.query(
      `SELECT (SELECT COUNT(*) FROM product_categories WHERE category_id = ?) AS products,
              (SELECT COUNT(*) FROM categories WHERE parent_id = ?) AS children`, [id, id]);
    return { products: Number(r.products), children: Number(r.children) };
  },
  remove: (id) => pool.query('DELETE FROM categories WHERE id = ?', [id]),
};

/** One shop page per seller. */
const shopCols = `seller_id AS sellerId, slug, name, about, return_policy AS returnPolicy, logo_url AS logoUrl,
  banner_url AS bannerUrl, updated_at AS updatedAt`;
const shops = {
  async bySeller(sellerId) {
    const [rows] = await pool.query(`SELECT ${shopCols} FROM shops WHERE seller_id = ?`, [sellerId]);
    return rows[0] || null;
  },
  async bySlug(slug) {
    const [rows] = await pool.query(`SELECT ${shopCols} FROM shops WHERE slug = ?`, [slug]);
    return rows[0] || null;
  },
  async slugTaken(slug, exceptSellerId) {
    const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM shops WHERE slug = ? AND seller_id <> ?', [slug, exceptSellerId]);
    return Number(r.n) > 0;
  },
  upsert: (sellerId, { slug, name, about, returnPolicy }) => pool.query(
    `INSERT INTO shops (seller_id, slug, name, about, return_policy) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE slug = VALUES(slug), name = VALUES(name), about = VALUES(about), return_policy = VALUES(return_policy)`,
    [sellerId, slug, name, about, returnPolicy]),
  /** field is chosen by the route from a fixed list, never from user input. */
  setImage: (sellerId, field, url) => pool.query(
    `UPDATE shops SET ${field === 'logo' ? 'logo_url' : 'banner_url'} = ? WHERE seller_id = ?`, [url, sellerId]),
};

/** Numbers for the admin overview. */
const stats = {
  async decisionsByDay(days) {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, decision, COUNT(*) AS n FROM audit_log
        WHERE created_at >= CURDATE() - INTERVAL ? DAY GROUP BY day, decision ORDER BY day`, [days - 1]);
    return rows.map((r) => ({ ...r, n: Number(r.n) }));
  },
  async topDenials(limit) {
    const [rows] = await pool.query(
      `SELECT reason, COUNT(*) AS n FROM audit_log WHERE decision = 'DENY' GROUP BY reason ORDER BY n DESC LIMIT ?`, [limit]);
    return rows.map((r) => ({ ...r, n: Number(r.n) }));
  },
};

module.exports = { users, roles, permissions, audit, catalog, categories, shops, stats, ping: () => pool.query('SELECT 1') };
