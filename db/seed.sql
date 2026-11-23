-- Team 3 Store · seed data. Every demo password is Password@123 (bcrypt cost 10).
-- IDs matter: the self-test page expects these exact ids.

INSERT INTO roles (id, name, description, parent_role_id, staff_login) VALUES
 (1, 'ADMIN',           'Runs the platform: users, roles, audit',            NULL, 0),
 (2, 'CUSTOMER',        'Shops, places orders, tracks deliveries',           NULL, 0),
 (3, 'EMPLOYEE',        'Base role for internal staff (abstract parent)',    NULL, 0),
 (4, 'FINANCE',         'Payments, refunds and financial reports',           3,    1),
 (5, 'WAREHOUSE_STAFF', 'Packs and ships orders, keeps stock accurate',      3,    1),
 (6, 'SELLER',          'Lists products and manages own inventory',          NULL, 0),
 (7, 'CEO',             'Future scope: oversight (no permissions yet)',      NULL, 1);

INSERT INTO permissions (resource, action, description) VALUES
 ('user','read','See every user account'),
 ('user','read_own','See your own profile'),
 ('user','update_own','Edit your own profile and password'),
 ('user','assign_role','Change another user''s role'),
 ('user','deactivate','Deactivate or reactivate accounts'),
 ('role','manage','Create roles, change parents, grant permissions'),
 ('audit','read','Read the authorization audit log'),
 ('product','read','Browse the catalog'),
 ('product','create','List a new product'),
 ('product','update','Edit any product'),
 ('product','update_own','Edit products you listed'),
 ('product','delete_own','Remove products you listed'),
 ('product','approve','Approve listings for the storefront'),
 ('stock','read','See stock levels'),
 ('stock','update','Correct stock levels'),
 ('order','create','Place an order'),
 ('order','read','See every order'),
 ('order','read_own','See your own orders'),
 ('order','cancel_own','Cancel your own order'),
 ('order','update_status','Move orders through packing and shipping'),
 ('payment','create','Pay for an order'),
 ('payment','read','See every payment'),
 ('payment','read_own','See your own payments'),
 ('refund','request_own','Request a refund for your own order'),
 ('refund','approve','Approve or reject refunds'),
 ('report','read','Read financial reports'),
 ('category','manage','Create, rename, move and delete categories'),
 ('shop','update_own','Customise your own shop page'),
 -- added for seller approval (appended so existing permission ids do not move)
 ('user','approve','Approve or reject seller shops'),
 ('user','delete','Delete an account permanently');

-- helper: grant by name
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON
 (r.name = 'ADMIN' AND p.resource IN ('user','role','audit','product','stock','order','payment','refund','report','category')
                   AND (p.action NOT LIKE '%\_own' OR p.resource = 'user')
                   -- admin runs the platform; it does not shop, so no order:create / payment:create
                   AND CONCAT(p.resource,':',p.action) NOT IN ('order:create','payment:create'))
 OR (r.name = 'CUSTOMER' AND CONCAT(p.resource,':',p.action) IN
     ('product:read','order:create','order:read_own','order:cancel_own','payment:create','payment:read_own',
      'refund:request_own','user:read_own','user:update_own'))
 OR (r.name = 'EMPLOYEE' AND CONCAT(p.resource,':',p.action) IN ('product:read','user:read_own','user:update_own'))
 OR (r.name = 'FINANCE' AND CONCAT(p.resource,':',p.action) IN ('order:read','payment:read','refund:approve','report:read'))
 OR (r.name = 'WAREHOUSE_STAFF' AND CONCAT(p.resource,':',p.action) IN ('order:read','order:update_status','stock:read','stock:update'))
 OR (r.name = 'SELLER' AND CONCAT(p.resource,':',p.action) IN
     ('product:read','product:create','product:update_own','product:delete_own','stock:read','user:read_own','user:update_own',
      'shop:update_own'));
-- CEO gets nothing on purpose: every protected request is denied by default.

INSERT INTO users (id, name, email, password_hash, role_id, is_active) VALUES
 (1, 'Riya Admin',      'admin@team3.test',     '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly', 1, 1),
 (2, 'Arjun Mehta',     'customer@team3.test',  '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly', 2, 1),
 (3, 'Kavya Crafts',    'seller1@team3.test',   '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly', 6, 1),
 (4, 'Nilgiri Goods',   'seller2@team3.test',   '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly', 6, 1),
 (5, 'Priya Finance',   'finance@team3.test',   '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly', 4, 1),
 (6, 'Rahul Warehouse', 'warehouse@team3.test', '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly', 5, 1),
 (7, 'Vikram CEO',      'ceo@team3.test',       '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly', 7, 1),
 (8, 'Old Account',     'inactive@team3.test',  '$2b$10$KIMPw0dfl5svl90Qyva9aesnZeCvQ6lUrRl14FDBu2JTvWRMJ24ly', 2, 0);

INSERT INTO categories (id, slug, name, parent_id) VALUES
 (1,'electronics','Electronics',NULL), (2,'audio','Audio',1), (3,'mobile','Mobile accessories',1),
 (4,'home','Home & Living',NULL), (5,'furniture','Furniture',4), (6,'decor','Decor',4),
 (7,'beauty','Beauty',NULL), (8,'skincare','Skincare',7), (9,'makeup','Makeup',7);

-- Product photos live in frontend/public/img/products. Prices are the BAGUETTE demo prices.
INSERT INTO products (id, seller_id, name, description, price, mrp, rating, reviews, stock, image, image_url, featured, status) VALUES
 (1, 3,'Jacquard Case','Soft-touch silicone phone case in warm tan, raised edges for the camera.',4000,4999,4.5,1240,60,'jacquard-case','/img/products/jacquard-case.png',1,'APPROVED'),
 (2, 3,'ANC Zony XM5','Over-ear wireless headphones with adaptive noise cancelling and 30 h battery.',55000,64990,4.7,3301,14,'anc-zony-xm5','/img/products/anc-zony-xm5.png',1,'APPROVED'),
 (3, 4,'True Wireless Bud','Compact earbuds with charging case, 24 h total playback.',7000,9999,4.3,2876,40,'true-wireless-bud','/img/products/true-wireless-bud.png',1,'APPROVED'),
 (4, 4,'Woofer','Bookshelf speaker in matte black, deep bass from a 6.5 inch driver.',79999,89999,4.4,640,9,'woofer','/img/products/woofer.png',0,'APPROVED'),
 (5, 3,'Cleopatric Chair','Rust-brown lounge chair with tapered walnut legs.',45000,52000,4.6,412,6,'cleopatric-chair','/img/products/cleopatric-chair.png',0,'APPROVED'),
 (6, 4,'Borivili Chase','Tufted boucle armchair with a curved shell and wooden legs.',55000,55000,4.5,288,4,'borivili-chase','/img/products/borivili-chase.png',1,'APPROVED'),
 (7, 3,'3-Seater Lounger','Linen three-seater sofa, cushions and throw included.',99000,115000,4.8,190,3,'three-seater-lounger','/img/products/three-seater-lounger.png',1,'APPROVED'),
 (8, 4,'Luxe Vase','Hand-thrown stoneware ring vase, matte cream glaze.',195000,195000,4.2,96,12,'luxe-vase','/img/products/luxe-vase.png',0,'APPROVED'),
 (9, 3,'Jacquard Vase Duo','A pair of sculptural ceramic vases in sand and chalk.',77000,82000,4.4,154,0,'jacquard-vase-duo','/img/products/jacquard-vase-duo.png',0,'SOLD_OUT'),
 (10,4,'Skin Velore Creme','Nourishing face cream, 50 g, for daily hydration.',55000,59000,4.4,1520,30,'skin-velore-creme','/img/products/skin-velore-creme.png',0,'APPROVED'),
 (11,3,'Alu Serum','Lightweight radiance serum that doubles as a sheer tint.',7000,8500,4.1,980,50,'alu-serum','/img/products/alu-serum.png',0,'APPROVED'),
 (12,4,'Alu Foundation','Buildable natural-finish liquid foundation, 30 ml.',79999,79999,4.0,0,25,'alu-foundation','/img/products/alu-foundation.png',0,'PENDING');

INSERT INTO product_categories (product_id, category_id) VALUES
 (1,1),(1,3), (2,1),(2,2), (3,1),(3,2),(3,3), (4,1),(4,2),
 (5,4),(5,5), (6,4),(6,5), (7,4),(7,5), (8,4),(8,6), (9,4),(9,6),
 (10,7),(10,8), (11,7),(11,8),(11,9), (12,7),(12,9);

-- The two demo shops are already approved by the admin (new shops start PENDING).
INSERT INTO shops (seller_id, slug, name, about, return_policy, logo_url, banner_url, status, reviewed_by, reviewed_at) VALUES
 (3,'kavya-crafts','Kavya Crafts','Handpicked tech accessories and living-room pieces, chosen for warm materials and quiet design.','Returns accepted within 7 days of delivery in original packaging.',NULL,NULL,'APPROVED',1,NOW()),
 (4,'nilgiri-goods','Nilgiri Goods','Audio, ceramics and skincare from small makers across South India.','Unused items can be returned within 10 days. Skincare is non-returnable once opened.',NULL,NULL,'APPROVED',1,NOW());


-- Initial seed orders for Warehouse & Fulfillment testing (Sprint 2)
INSERT INTO orders (id, customer_id, status, subtotal, shipping_fee, total, shipping_name, shipping_address, shipping_pincode, shipping_phone) VALUES
 (1, 2, 'PAID', 59000.00, 0.00, 59000.00, 'Arjun Mehta', 'Flat 402, Royal Palms, 12th Main, Indiranagar, Bengaluru', '560038', '9876543210'),
 (2, 2, 'PAID', 14000.00, 150.00, 14150.00, 'Arjun Mehta', 'Villa 12, Palm Meadows, Whitefield, Bengaluru', '560066', '9876543210'),
 (3, 2, 'PACKED', 4000.00, 100.00, 4100.00, 'Pooja Sharma', 'Plot 88, Road No. 36, Jubilee Hills, Hyderabad', '500033', '9812345678'),
 (4, 2, 'SHIPPED', 55000.00, 0.00, 55000.00, 'Rohan Verma', 'Sector 14, DLF Phase 2, Gurugram, Haryana', '122002', '9988776655'),
 (5, 2, 'PAID', 110000.00, 0.00, 110000.00, 'Neha Kapoor', 'B-104, Sea Mist Apts, Bandra West, Mumbai', '400050', '9820011223');

INSERT INTO order_items (order_id, product_id, seller_id, name, unit_price, quantity, line_total) VALUES
 (1, 1, 3, 'Jacquard Case', 4000.00, 1, 4000.00),
 (1, 2, 3, 'ANC Zony XM5', 55000.00, 1, 55000.00),
 (2, 3, 4, 'True Wireless Bud', 7000.00, 2, 14000.00),
 (3, 1, 3, 'Jacquard Case', 4000.00, 1, 4000.00),
 (4, 2, 3, 'ANC Zony XM5', 55000.00, 1, 55000.00),
 (5, 6, 4, 'Borivili Chase', 55000.00, 2, 110000.00);

INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note) VALUES
 (1, NULL, 'PENDING_PAYMENT', 2, 'Order placed by customer'),
 (1, 'PENDING_PAYMENT', 'PAID', NULL, 'Mock payment confirmed via UPI'),
 (2, NULL, 'PENDING_PAYMENT', 2, 'Order placed by customer'),
 (2, 'PENDING_PAYMENT', 'PAID', NULL, 'Mock payment confirmed via Card'),
 (3, NULL, 'PENDING_PAYMENT', 2, 'Order placed by customer'),
 (3, 'PENDING_PAYMENT', 'PAID', NULL, 'Payment settled'),
 (3, 'PAID', 'PACKED', 6, 'Packed into Parcel Box P-2 by Rahul Warehouse'),
 (4, NULL, 'PENDING_PAYMENT', 2, 'Order placed by customer'),
 (4, 'PENDING_PAYMENT', 'PAID', NULL, 'Payment settled'),
 (4, 'PAID', 'PACKED', 6, 'Packed with bubble wrap'),
 (4, 'PACKED', 'SHIPPED', 6, 'Dispatched via BlueDart Express (AWB: TRK-T3-99214)'),
 (5, NULL, 'PENDING_PAYMENT', 2, 'Order placed by customer'),
 (5, 'PENDING_PAYMENT', 'PAID', NULL, 'Payment settled via NetBanking');
