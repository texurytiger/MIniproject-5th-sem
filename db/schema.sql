-- Team 3 Store · schema (MySQL 8 / MariaDB 10.4+ via XAMPP)
-- E3 owns these tables. E1 (authorization) reads roles/permissions and writes audit_log.
-- Run with: npm run db:reset   (drops and recreates everything, then loads seed.sql)

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS invoices, refunds, transactions, order_status_history, order_items, orders,
  product_availability, stock, product_images,
  audit_log, product_categories, shops, products, categories, role_permissions, users, permissions, roles;
SET FOREIGN_KEY_CHECKS = 1;

-- Role tree: parent_role_id points UP. A child inherits every permission of its ancestors.
CREATE TABLE roles (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  name           VARCHAR(40)  NOT NULL UNIQUE,
  description    VARCHAR(160) NOT NULL DEFAULT '',
  parent_role_id INT NULL,
  staff_login    TINYINT(1)   NOT NULL DEFAULT 0,   -- 1 = can be picked on a staff sign-in page
  CONSTRAINT fk_role_parent FOREIGN KEY (parent_role_id) REFERENCES roles(id) ON DELETE SET NULL
);

-- "resource:action". An action ending in _own is limited to rows the user owns (FR-10).
CREATE TABLE permissions (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  resource    VARCHAR(40)  NOT NULL,
  action      VARCHAR(40)  NOT NULL,
  description VARCHAR(160) NOT NULL DEFAULT '',
  UNIQUE KEY uq_perm (resource, action)
);

CREATE TABLE role_permissions (
  role_id       INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE users (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  name           VARCHAR(80)  NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  password_hash  CHAR(60)     NOT NULL,              -- bcrypt, cost factor 10
  role_id        INT          NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  token_version  INT          NOT NULL DEFAULT 0,    -- bumped on logout / password change / deactivate: old JWTs stop working
  failed_logins  INT          NOT NULL DEFAULT 0,
  locked_until   DATETIME     NULL,                  -- 5 wrong passwords = locked for 15 minutes
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Insert-only. Every ALLOW and DENY decision lands here (FR-11).
CREATE TABLE audit_log (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NULL,
  email      VARCHAR(120) NULL,
  resource   VARCHAR(40) NOT NULL,
  action     VARCHAR(40) NOT NULL,
  owner_id   INT NULL,
  decision   ENUM('ALLOW','DENY') NOT NULL,
  reason     VARCHAR(40) NOT NULL,
  ip         VARCHAR(45) NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_audit_user (user_id, id),
  KEY ix_audit_decision (decision, id)
);

-- Minimal catalog so the storefront has real rows to show. E2 will own the full catalog logic.
CREATE TABLE categories (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  slug      VARCHAR(40) NOT NULL UNIQUE,
  name      VARCHAR(60) NOT NULL,
  parent_id INT NULL,                                -- category tree (Dairy -> Milk); NULL = top level
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE products (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  seller_id   INT NOT NULL,                          -- owner, used by FR-10 ownership checks
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(400) NOT NULL DEFAULT '',
  price       DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  mrp         DECIMAL(10,2) NOT NULL CHECK (mrp >= 0),
  rating      DECIMAL(2,1)  NOT NULL DEFAULT 4.0,
  reviews     INT           NOT NULL DEFAULT 0,
  stock       INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image       VARCHAR(40)   NOT NULL,                -- short image key (fallback illustration)
  image_url   VARCHAR(255)  NULL,                    -- product photo, e.g. /img/products/woofer.png
  featured    TINYINT(1)    NOT NULL DEFAULT 0,      -- shown first on the seller's shop page
  status      ENUM('PENDING','APPROVED','SOLD_OUT') NOT NULL DEFAULT 'APPROVED',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prod_seller FOREIGN KEY (seller_id) REFERENCES users(id),
  FULLTEXT KEY ft_products (name, description)
);

-- A product can sit in several categories (a phone case: Electronics > Mobile accessories AND Audio).
CREATE TABLE product_categories (
  product_id  INT NOT NULL,
  category_id INT NOT NULL,
  PRIMARY KEY (product_id, category_id),
  KEY ix_pc_category (category_id),
  CONSTRAINT fk_pc_product  FOREIGN KEY (product_id)  REFERENCES products(id)   ON DELETE CASCADE,
  CONSTRAINT fk_pc_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- One shop page per seller (1 : 1 with users).
CREATE TABLE shops (
  seller_id     INT PRIMARY KEY,
  slug          VARCHAR(60)   NOT NULL UNIQUE,
  name          VARCHAR(80)   NOT NULL,
  about         VARCHAR(600)  NOT NULL DEFAULT '',
  return_policy VARCHAR(1000) NOT NULL DEFAULT '',
  logo_url      VARCHAR(255)  NULL,
  banner_url    VARCHAR(255)  NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_shop_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);


-- =====================================================================================
-- NOT IMPLEMENTED YET: tables for checkout, orders, payments and refunds (Sprint 2).
-- Created now so the whole design lives in one database. No code uses them and no seed rows are added.
-- =====================================================================================

-- Extra photos per product (products.image_url stays the main photo).
CREATE TABLE product_images (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  url        VARCHAR(255) NOT NULL,
  alt_text   VARCHAR(160) NOT NULL DEFAULT '',
  position   INT NOT NULL DEFAULT 0,                 -- display order, 0 = first
  CONSTRAINT fk_pimg_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  KEY ix_pimg_product (product_id, position)
);

-- Stock history: every change to products.stock, and why. products.stock stays the current number.
CREATE TABLE stock (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  change_qty INT NOT NULL,                           -- +10 restock, -2 sale, ...
  reason     ENUM('RESTOCK','SALE','RESERVE','RELEASE','CORRECTION','REFUND') NOT NULL,
  order_id   INT NULL,                               -- set when the change comes from an order
  actor_id   INT NULL,                               -- who made the change (seller, warehouse, system = NULL)
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  KEY ix_stock_product (product_id, id)
);

-- Stock held for a checkout in progress (expires if payment does not finish in time).
CREATE TABLE product_availability (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id INT NOT NULL,
  order_id   INT NOT NULL,
  quantity   INT NOT NULL CHECK (quantity > 0),
  status     ENUM('HELD','CONFIRMED','RELEASED') NOT NULL DEFAULT 'HELD',
  expires_at DATETIME NOT NULL,                      -- e.g. 10 minutes after the hold is made
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_avail_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  KEY ix_avail_expiry (status, expires_at)           -- lets the clean-up job find expired holds fast
);

CREATE TABLE orders (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  customer_id      INT NOT NULL,
  status           ENUM('PENDING_PAYMENT','PAID','PACKED','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  subtotal         DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  shipping_fee     DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  total            DECIMAL(12,2) NOT NULL CHECK (total >= 0),
  shipping_name    VARCHAR(80)  NOT NULL,
  shipping_address VARCHAR(400) NOT NULL,
  shipping_pincode CHAR(6)      NOT NULL,
  shipping_phone   VARCHAR(15)  NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES users(id),
  KEY ix_order_customer (customer_id, id),
  KEY ix_order_status (status, id)
);

-- One row per product in an order. Name and price are copied at checkout, so later edits never change old orders.
CREATE TABLE order_items (
  order_id   INT NOT NULL,
  product_id INT NOT NULL,
  seller_id  INT NOT NULL,                           -- lets each seller see only their part of an order
  name       VARCHAR(120)  NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity   INT NOT NULL CHECK (quantity > 0),
  line_total DECIMAL(12,2) NOT NULL CHECK (line_total >= 0),
  PRIMARY KEY (order_id, product_id),
  CONSTRAINT fk_oi_order   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_oi_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_oi_seller  FOREIGN KEY (seller_id)  REFERENCES users(id),
  KEY ix_oi_seller (seller_id)
);

-- Every status change of an order: who, from what, to what, when (insert-only, like audit_log).
CREATE TABLE order_status_history (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id    INT NOT NULL,
  from_status VARCHAR(20) NULL,                      -- NULL for the first row (order created)
  to_status   VARCHAR(20) NOT NULL,
  changed_by  INT NULL,                              -- NULL = the system (e.g. hold expired)
  note        VARCHAR(200) NOT NULL DEFAULT '',
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  KEY ix_osh_order (order_id, id)
);

-- Payments through the internal mock payment simulator (no real money).
CREATE TABLE transactions (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id        INT NOT NULL,
  amount          DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  method          ENUM('MOCK_CARD','MOCK_UPI','MOCK_COD') NOT NULL,
  status          ENUM('INITIATED','SUCCESS','FAILED') NOT NULL DEFAULT 'INITIATED',
  idempotency_key CHAR(36) NOT NULL UNIQUE,          -- the same payment request sent twice is charged once
  provider_ref    VARCHAR(64) NULL,                  -- reference returned by the simulator
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tx_order FOREIGN KEY (order_id) REFERENCES orders(id),
  KEY ix_tx_order (order_id)
);

-- Customer cancels -> Finance approves or rejects -> money goes back through the simulator.
CREATE TABLE refunds (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  order_id       INT NOT NULL,
  transaction_id BIGINT NOT NULL,                    -- the payment being refunded
  amount         DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  reason         VARCHAR(300) NOT NULL DEFAULT '',
  status         ENUM('REQUESTED','APPROVED','REJECTED','PAID') NOT NULL DEFAULT 'REQUESTED',
  requested_by   INT NOT NULL,                       -- the customer
  decided_by     INT NULL,                           -- the Finance user who approved or rejected
  decided_at     DATETIME NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ref_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_ref_tx    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
  CONSTRAINT fk_ref_req   FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_ref_dec   FOREIGN KEY (decided_by) REFERENCES users(id),
  KEY ix_ref_status (status, id)
);

-- One invoice per paid order. Amounts are copied so the invoice never changes later.
CREATE TABLE invoices (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  order_id       INT NOT NULL UNIQUE,
  invoice_number VARCHAR(20) NOT NULL UNIQUE,        -- e.g. INV-2026-000123
  subtotal       DECIMAL(12,2) NOT NULL,
  tax            DECIMAL(12,2) NOT NULL DEFAULT 0,
  total          DECIMAL(12,2) NOT NULL,
  issued_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inv_order FOREIGN KEY (order_id) REFERENCES orders(id)
);
