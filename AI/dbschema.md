📘 Documentation: Normalized OMS Orders System
This documentation covers customers, orders, order_items, payments, and order status history.




1️⃣ Customers Table (oms.customers)
Stores all customer details, linked to merchants.
Column
Type
Required
Description
customer_id
BIGSERIAL PK
Auto
Unique ID for the customer.
merchant_id
BIGINT FK
Yes
Merchant who owns the customer.
name
VARCHAR(255)
Yes
Customer name.
phone
VARCHAR(20)
Yes
Customer phone number (unique per merchant).
email
VARCHAR(255)
No
Customer email.
address
TEXT
No
Delivery or contact address.
created_at
TIMESTAMP
Auto
Timestamp when customer was created.
updated_at
TIMESTAMP
Auto
Timestamp when customer was last updated.

Notes for FE:
Merchant is derived from logged-in context; FE does not send merchant_id.
FE must provide at least name + phone.
Duplicate phone numbers for the same merchant are rejected.
Example Payload (New Customer):
{
  "name": "John Doe",
  "phone": "9876543210",
  "email": "john@example.com",
  "address": "123 Main St, City, State"
}


2️⃣ Orders Table (oms.orders)
Stores order-level details.
Column
Type
Required
Description
order_id
BIGSERIAL PK
Auto
Unique order ID.
merchant_id
BIGINT FK
Yes
Merchant fulfilling the order.
user_id
BIGINT FK
Optional
POS staff creating the order; null for online/WhatsApp orders.
customer_id
BIGINT FK
Optional
Link to customer for WhatsApp / Marketplace orders; null for POS orders.
order_date
TIMESTAMP
Auto
When order was created.
order_source
VARCHAR(50)
Yes
POS / WhatsApp / Marketplace / Website / App.
status
VARCHAR(20)
Yes
pending / confirmed / shipped / delivered / cancelled.
total_amount
NUMERIC(12,2)
Yes
Total order value; sum of order_items.
payment_status
VARCHAR(20)
Yes
pending / paid / failed / cod.
payment_method
VARCHAR(50)
Optional
UPI, Cash, Card, Wallet, Marketplace payment.
created_at
TIMESTAMP
Auto
Order creation timestamp.
updated_at
TIMESTAMP
Auto
Last update timestamp.

Notes for FE:
POS orders → send user_id; customer_id optional (internal staff).
WhatsApp / Marketplace / Website orders → send customer_id; user_id = null.
order_source is mandatory.
Example POS Order Payload:
{
  "user_id": 10000031,
  "order_source": "POS",
  "status": "pending",
  "total_amount": 1200.00,
  "payment_status": "pending",
  "payment_method": "Cash"
}

Example WhatsApp / Marketplace Order Payload:
{
  "customer_id": 2001,
  "order_source": "WhatsApp",
  "status": "pending",
  "total_amount": 1500.00,
  "payment_status": "paid",
  "payment_method": "UPI"
}


3️⃣ Order Items Table (oms.order_items)
Stores products in an order.
Column
Type
Required
Description
order_item_id
BIGSERIAL PK
Auto
Unique row ID.
order_id
BIGINT FK
Yes
Link to parent order.
product_id
BIGINT FK
Yes
Product being sold.
inventory_id
BIGINT FK
Optional
Optional stock reference for deduction.
sku
VARCHAR(100)
Yes
Snapshot of SKU at order time.
quantity
INT
Yes
Quantity ordered.
price_per_unit
NUMERIC(12,2)
Yes
Selling price per unit.
total_price
NUMERIC(12,2)
Yes
quantity × price_per_unit.
created_at
TIMESTAMP
Auto
Timestamp when item added.
updated_at
TIMESTAMP
Auto
Timestamp when item last updated.

Example Payload for FE:
[
  {
    "product_id": 1000000,
    "inventory_id": 5001,
    "sku": "1000003-1000000",
    "quantity": 2,
    "price_per_unit": 600.00,
    "total_price": 1200.00
  }
]


4️⃣ Order Payments Table (oms.order_payments)
Optional if multi-payment / partial payments are needed.
Column
Type
Required
Description
payment_id
BIGSERIAL PK
Auto
Unique payment row ID.
order_id
BIGINT FK
Yes
Linked order.
payment_date
TIMESTAMP
Auto
Timestamp when payment made.
payment_method
VARCHAR(50)
Yes
UPI / Cash / Card / Wallet / Marketplace.
amount
NUMERIC(12,2)
Yes
Payment amount.
status
VARCHAR(20)
Yes
pending / paid / failed.


5️⃣ Order Status History Table (oms.order_status_history)
Tracks status changes for audit.
Column
Type
Required
Description
history_id
BIGSERIAL PK
Auto
Unique ID for history row.
order_id
BIGINT FK
Yes
Linked order.
old_status
VARCHAR(20)
Yes
Status before change.
new_status
VARCHAR(20)
Yes
Status after change.
changed_by
BIGINT FK
Optional
User/admin who changed status.
changed_at
TIMESTAMP
Auto
When status changed.


FE Notes / Best Practices
POS Orders
Send user_id.
customer_id optional (internal staff).
WhatsApp / Marketplace Orders
Send customer_id.
user_id = null.
Order Items
Always send product_id, quantity, price_per_unit, total_price.
Optionally send inventory_id for stock deduction.
Payments
If multiple partial payments, send array of payments in order_payments.
Otherwise, can be updated after order creation.
Status Updates
Send old → new status in order_status_history.
FE does not update orders.status directly; BE should enforce status rules.

This structure ensures:
Normalized data → avoids duplication of products and customer info.
POS + Online workflow → works for all channels.
Scalable → supports payments, audits, and reporting.







Queries :


CREATE TABLE oms.customers (
    customer_id BIGSERIAL PRIMARY KEY,
    merchant_id BIGINT NOT NULL,                   -- FK → merchant (each merchant has own customers)
    
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_customers_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants(merchant_id) ON DELETE CASCADE,
    
    CONSTRAINT uq_customer_phone UNIQUE (merchant_id, phone)  -- prevent duplicates per merchant
);

CREATE TABLE oms.orders (
    order_id BIGSERIAL PRIMARY KEY,                  -- Unique order ID
    merchant_id BIGINT NOT NULL,                     -- FK → merchants
    user_id BIGINT NULL,                             -- FK → users (only for POS orders)
    customer_id BIGINT NULL,                         -- FK → customers (nullable for POS orders)
    
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- When the order was created
    order_source VARCHAR(50) NOT NULL DEFAULT 'POS', -- Source of order (POS, WhatsApp, Marketplace, Website, App)
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),

    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- Total order value
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','cod')),
    payment_method VARCHAR(50),                        -- UPI, Card, Cash, Wallet, Marketplace payment

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants (merchant_id) ON DELETE CASCADE,
    CONSTRAINT fk_orders_users FOREIGN KEY (user_id)
        REFERENCES oms.users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id)
        REFERENCES oms.customers(customer_id) ON DELETE SET NULL
);


CREATE TABLE oms.order_items (
    order_item_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,                        -- FK → orders
    product_id BIGINT NOT NULL,                      -- FK → products
    inventory_id BIGINT NULL,                        -- Optional FK → inventory
    
    sku VARCHAR(100) NOT NULL,                       -- SKU snapshot at order time
    quantity INT NOT NULL DEFAULT 1,
    price_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id)
        REFERENCES oms.orders (order_id) ON DELETE CASCADE,
    CONSTRAINT fk_order_items_products FOREIGN KEY (product_id)
        REFERENCES oms.products (product_id)
);


CREATE TABLE oms.order_payments (
    payment_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,                        -- FK → orders
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),

    CONSTRAINT fk_order_payments_orders FOREIGN KEY (order_id)
        REFERENCES oms.orders(order_id) ON DELETE CASCADE
);


CREATE TABLE oms.order_status_history (
    history_id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changed_by BIGINT NULL,           -- FK → users who changed the status
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_status_history_orders FOREIGN KEY (order_id)
        REFERENCES oms.orders(order_id) ON DELETE CASCADE
);



📘 Documentation: oms.inventory Table
The inventory table tracks stock for each product owned by a merchant. Each row corresponds to a specific product for a specific merchant.

Table Name
oms.inventory

Columns
Column Name
Data Type
Description
inventory_id
BIGSERIAL PK
Unique identifier for the inventory row (auto-generated).
merchant_id
BIGINT FK
Links to oms.merchants(merchant_id). Identifies the merchant who owns this stock.
product_id
BIGINT FK
Links to oms.products(product_id). Identifies which product this stock row belongs to.
sku
VARCHAR(100)
SKU of the product. Copied from the product table for quick lookup.
quantity_available
INT
Current stock available for sale.
reorder_level
INT
Threshold set by merchant to trigger a low-stock alert.
cost_price
NUMERIC(12,2)
Procurement cost per unit.
selling_price
NUMERIC(12,2)
Standard selling price per unit.
status
VARCHAR(20)
active (default) or inactive.
created_at
TIMESTAMP
When the inventory row was created. Defaults to current timestamp.
updated_at
TIMESTAMP
Last update timestamp. Defaults to current timestamp.


Constraints & Business Rules
Primary Key → inventory_id.
Foreign Keys →
merchant_id → oms.merchants.merchant_id (ON DELETE CASCADE)
product_id → oms.products.product_id (ON DELETE CASCADE)
Unique Constraint → merchant_id + product_id → ensures a merchant cannot have duplicate inventory rows for the same product.
reorder_level is merchant-defined → can vary per merchant, even for the same product.
Alerts can be triggered in BE when quantity_available < reorder_level.

Frontend Developer Notes
Fields FE Sends
Field
Required?
Input Type
Notes
product_id
✅ Yes
Select / ID
Chosen from merchant’s products.
sku
❌ Optional
Text
Optional, pre-filled from product table.
quantity_available
✅ Yes
Number
Initial stock quantity.
reorder_level
✅ Yes
Number
Low-stock threshold. Merchant-defined.
cost_price
✅ Yes
Number
Procurement cost per unit.
selling_price
✅ Yes
Number
Selling price per unit.
status
❌ Optional
Dropdown
Defaults to active.


Fields Auto-Handled by BE/DB
Field
Notes
inventory_id
Auto-generated by DB.
merchant_id
Derived from logged-in merchant context.
created_at
Auto-set to current timestamp.
updated_at
Auto-updated whenever inventory changes.


Example FE JSON Payload
{
  "product_id": 1000000,
  "quantity_available": 50,
  "reorder_level": 10,
  "cost_price": 250.00,
  "selling_price": 400.00,
  "sku": "1000003-1000000",
  "status": "active"
}

Example Response from BE
{
  "inventory_id": 5001,
  "merchant_id": 1000003,
  "product_id": 1000000,
  "sku": "1000003-1000000",
  "quantity_available": 50,
  "reorder_level": 10,
  "cost_price": 250.00,
  "selling_price": 400.00,
  "status": "active",
  "created_at": "2025-09-04T12:00:00Z",
  "updated_at": "2025-09-04T12:00:00Z"
}


✅ Key Points for FE
Merchant can set and edit reorder_level per product.
FE never sends merchant_id or inventory_id — handled by BE.
sku can be auto-filled from products table if merchant does not provide.




QUERIES :


CREATE TABLE oms.inventory (
    inventory_id BIGSERIAL PRIMARY KEY,                 -- Unique inventory row ID

    merchant_id BIGINT NOT NULL,                        -- FK → merchants
    product_id BIGINT NOT NULL,                         -- FK → products
    sku VARCHAR(100) NOT NULL,                          -- SKU (copied from products for quick lookup)

    quantity_available INT NOT NULL DEFAULT 0,          -- Current stock
    reorder_level INT NOT NULL DEFAULT 0,               -- Threshold for low stock alert (merchant-defined)

    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,     -- Procurement cost per unit
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,  -- Selling price per unit

    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_inventory_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants (merchant_id) ON DELETE CASCADE,
    CONSTRAINT fk_inventory_products FOREIGN KEY (product_id)
        REFERENCES oms.products (product_id) ON DELETE CASCADE,

    -- Ensure uniqueness: a merchant can’t have duplicate inventory rows for the same product
    CONSTRAINT uq_inventory_merchant_product UNIQUE (merchant_id, product_id)
);


📘 Documentation: oms.products Table
The products table stores product catalog information for each merchant. Each product belongs to exactly one merchant, and its stock is tracked in the inventory table.

Table Name
oms.products

Columns
Column Name
Data Type
Description
product_id
BIGINT (PK)
Unique identifier for each product. Auto-generated from a sequence starting at 1,000,000.
merchant_id
BIGINT (FK → oms.merchants.merchant_id)
Identifies the merchant who owns this product. Ensures products are merchant-specific.
product_name
VARCHAR(255)
Name of the product as displayed to customers. Mandatory field.
description
TEXT
Optional detailed description of the product.
category
VARCHAR(100)
Optional category (e.g., Apparel, Electronics, Grocery).
brand
VARCHAR(100)
Optional brand/manufacturer name.
sku
VARCHAR(100)
Stock Keeping Unit. Either provided by merchant (via FE) or auto-generated by BE/trigger (merchant_id-product_id). Must be unique across all products.
barcode
VARCHAR(100)
Optional barcode/QR code identifier for scanning.
status
VARCHAR(20)
Status of product: active (default), inactive, or discontinued.
created_at
TIMESTAMP
Timestamp when the product record was created. Defaults to CURRENT_TIMESTAMP.
updated_at
TIMESTAMP
Timestamp when the product record was last updated. Defaults to CURRENT_TIMESTAMP.


Constraints & Business Rules
Primary Key → product_id.
Foreign Key → merchant_id references oms.merchants(merchant_id) with ON DELETE CASCADE.
If a merchant is deleted, their products are also removed.
SKU must be unique.
If not provided by FE, BE/trigger auto-generates it as:
SKU = merchant_id || '-' || LPAD(product_id, 6, '0')
Example: Merchant 1000003, Product 1000000 → SKU = 1000003-1000000.
Status can only be one of active, inactive, discontinued.

Usage Notes for FE/BE
FE (Frontend) should collect:
product_name (required)
description (optional)
category (optional)
brand (optional)
sku (optional – if merchant wants to provide)
barcode (optional)
BE (Backend) should handle:
Auto-generating product_id (starting from 1,000,000).
Auto-generating sku if not provided.
Enforcing uniqueness of SKU.
Setting default status = active.
Updating created_at / updated_at.



📘 Frontend Developer Documentation – oms.products
The products table manages catalog items for each merchant.
FE is responsible only for collecting merchant-provided product details, while IDs, SKUs (if not given), and timestamps are auto-generated by the backend.

Fields FE Needs to Send
Field
Required?
Input Type
Notes
product_name
✅ Yes
Text (max 255)
Name shown in catalog.
description
❌ Optional
Multiline text
Detailed description (optional).
category
❌ Optional
Dropdown/Text
Product category (e.g., Apparel, Electronics).
brand
❌ Optional
Text
Brand or manufacturer name.
sku
❌ Optional
Text
Merchant can provide custom SKU. If left blank, BE auto-generates one (merchant_id-product_id).
barcode
❌ Optional
Text / Barcode scanner input
For QR/barcode scanning support.


Fields Auto-Handled by BE/DB
Field
Who Handles
Notes
product_id
DB
Auto-generated, starts from 1,000,000.
merchant_id
BE
Derived from logged-in merchant context (FE does not send).
status
DB
Defaults to active. Can be changed later by merchant.
created_at
DB
Set automatically when product is created.
updated_at
DB
Auto-set/updated by DB/BE.


Form Behavior for FE
On Product Create Page
FE displays fields: product_name, description, category, brand, sku, barcode.
FE does not display merchant_id or product_id – these are handled by BE/DB.
On Submission
If merchant provides a sku, FE sends it.
If sku is blank, BE auto-generates one.
On Product View/Edit Page
FE should show: product_id, sku, status, created_at, updated_at (all read-only except status).
Merchant can update: product_name, description, category, brand, sku, barcode, status.

Example Create Product API (JSON Payload from FE)
{
  "product_name": "T-Shirt Red",
  "description": "100% cotton, size M",
  "category": "Apparel",
  "brand": "MyStyle",
  "sku": "",               // Optional, blank → BE generates SKU
  "barcode": "8901234567890"
}

✅ Example Response (from BE)
{
  "product_id": 1000000,
  "merchant_id": 1000003,
  "product_name": "T-Shirt Red",
  "description": "100% cotton, size M",
  "category": "Apparel",
  "brand": "MyStyle",
  "sku": "1000003-1000000",    // Auto-generated SKU
  "barcode": "8901234567890",
  "status": "active",
  "created_at": "2025-09-03T15:21:00Z",
  "updated_at": "2025-09-03T15:21:00Z"
}


QUERIES : 



-- 1. Create custom sequence for product_id starting from 1,000,000
CREATE SEQUENCE oms.products_product_id_seq
    START WITH 1000000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- 2. Create products table
CREATE TABLE oms.products (
    product_id BIGINT PRIMARY KEY DEFAULT nextval('oms.products_product_id_seq'), -- custom sequence
    merchant_id BIGINT NOT NULL,                    
    product_name VARCHAR(255) NOT NULL,             
    description TEXT,                               
    category VARCHAR(100),                          
    brand VARCHAR(100),                             
    sku VARCHAR(100) UNIQUE,                        
    barcode VARCHAR(100),                           
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_merchants FOREIGN KEY (merchant_id)
        REFERENCES oms.merchants (merchant_id) ON DELETE CASCADE
);



-- 3. Link sequence to product_id
ALTER TABLE oms.products ALTER COLUMN product_id SET DEFAULT nextval('oms.products_product_id_seq');

-- 4. Function to auto generate SKU 
CREATE OR REPLACE FUNCTION oms.generate_sku()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sku IS NULL OR TRIM(NEW.sku) = '' THEN
        NEW.sku := NEW.merchant_id || '-' || LPAD(NEW.product_id::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- 5. Trigger for auto generated SKU
CREATE TRIGGER trg_generate_sku
BEFORE INSERT ON oms.products
FOR EACH ROW
EXECUTE FUNCTION oms.generate_sku();


User Table: 

📘 Documentation: oms.users Table
📌 Purpose
The users table stores login and access information for all accounts under each merchant.
Each merchant has 1 admin (auto-created at signup) and up to 5 additional users (roles: biller, staff, etc.).
Each user’s user_id is derived from merchant_id for easy mapping.

🗂 Table Schema
Column Name
Type
Constraints / Default
Description
user_id
BIGINT
PK. Auto-generated from merchant_id * 10 + sequence. Example: 10000031.
Unique identifier for the user.
merchant_id
BIGINT
FK → oms.merchants.merchant_id (ON DELETE CASCADE).
Links user to the merchant.
username
VARCHAR(150)
NOT NULL
Display name of the user (can be owner, biller, staff).
email
VARCHAR(255)
NOT NULL, UNIQUE
User’s email ID (used for login/communication).
phone_number
VARCHAR(15)
NOT NULL, UNIQUE
User’s phone number (can be used for login/OTP).
password_hash
TEXT
NOT NULL
Stores bcrypt-hashed password(never raw).
role
VARCHAR(50)
Default 'admin'
Role of the user (admin, biller, staff, etc.).
status
VARCHAR(20)
Default 'active'. Check constraint → ('active','suspended','disabled')
Current status of the account.
created_at
TIMESTAMP
Default CURRENT_TIMESTAMP
Timestamp when the user was created.
updated_at
TIMESTAMP
Default CURRENT_TIMESTAMP
Timestamp when the user was last updated.


🔑 ID Generation Logic
user_id = merchant_id * 10 + suffix
suffix = sequence of users under the same merchant (1 to 6).
Max 6 users per merchant (1 admin + 5 others).
Example:
Merchant ID = 1000003
Admin → 10000031
Biller → 10000032
Staff → 10000033
… up to 10000036

🔐 Security Notes
Password is hashed with bcrypt using pgcrypto.crypt() + gen_salt('bf').
Never store or log raw passwords.
Always enforce HTTPS for signup/login API calls.

📌 Workflow
Merchant Signup (auto-creates admin user)
FE sends → merchant_name, contact_person_name, email, phone_number, password.
BE/DB → Creates merchant in oms.merchants.
Trigger auto-creates first user:
role = admin
status = active
user_id = merchant_id * 10 + 1
Adding More Users
Admin logs in (BE knows merchant_id via session/token).
FE sends → username, email, phone_number, password, role.
BE inserts → DB assigns next available user_id (10000032, 10000033, …).
If 6 users exist → insert fails with error Maximum 6 users allowed per merchant.




📌 Frontend Developer Note: oms.users
1. What FE Sends
On Merchant Signup (creates merchant + admin user together)
FE must send:
merchant_name (business name)
contact_person_name (owner’s name)
email (business email)
phone_number (business phone)
password (raw, plain text over HTTPS)
👉 BE/DB will:
Auto-generate merchant_id (e.g., 1000003).
Auto-create the admin user linked to that merchant.
Auto-generate user_id (e.g., 10000031).
Store password securely (bcrypt hash).
Set role = admin, status = active.
FE gets back:
merchant_id
user_id (admin)
role
status

On Adding More Users (only after admin is logged in)
FE must send:
username
email
phone_number
password
role (optional, default = staff/biller)
👉 BE/DB will:
Identify merchant_id from admin’s session/auth token.
Auto-generate user_id (e.g., 10000032, 10000033, up to 10000036).
Store password as bcrypt hash.
Enforce max 6 users per merchant (admin + 5 staff).
FE gets back:
user_id
role
status

2. Important Rules
FE never sends merchant_id directly → it comes from backend/session.
Raw passwords should only travel via HTTPS and never be logged in FE.
Each merchant can have 1 admin + 5 extra users max.

3. Example Flow
Signup Response Example:
{
  "merchant_id": 1000003,
  "user_id": 10000031,
  "role": "admin",
  "status": "active"
}

Add User Response Example:
{
  "user_id": 10000032,
  "role": "biller",
  "status": "active"
}




















Queries : 

1: —-
CREATE TABLE oms.users (
    user_id BIGINT PRIMARY KEY,                    -- derived, not independent
    merchant_id BIGINT NOT NULL,
    username VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_merchants FOREIGN KEY (merchant_id) 
        REFERENCES oms.merchants(merchant_id) ON DELETE CASCADE
);

2:—-------------------------------

CREATE OR REPLACE FUNCTION oms.generate_user_id(p_merchant_id BIGINT)
RETURNS BIGINT AS $$
DECLARE
    user_count INT;
    next_suffix INT;
    new_user_id BIGINT;
BEGIN
    -- Count existing users for this merchant
    SELECT COUNT(*) INTO user_count 
    FROM oms.users WHERE merchant_id = p_merchant_id;

    IF user_count >= 6 THEN
        RAISE EXCEPTION 'Maximum 6 users allowed per merchant (including admin)';
    END IF;

    -- Suffix starts at 1 (admin), up to 6
    next_suffix := user_count + 1;

    -- Build user_id = merchant_id * 10 + suffix
    new_user_id := p_merchant_id * 10 + next_suffix;

    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

3: —--------------------------------------
CREATE OR REPLACE FUNCTION oms.set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id := oms.generate_user_id(NEW.merchant_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_user_id
BEFORE INSERT ON oms.users
FOR EACH ROW
EXECUTE FUNCTION oms.set_user_id();

Merchant Table : 

📘 Documentation: oms.merchants Table
📌 Purpose
The merchants table stores the primary business information of each merchant (company/owner) that signs up on the OMS platform.
Each merchant is uniquely identified by a 7-digit merchant_id.
Each merchant automatically gets an admin user created in oms.users.

🗂 Table Schema
Column Name
Type
Constraints / Default
Description
merchant_id
BIGINT
PK, auto-generated, starts from 100000. Increments by 1.
Unique identifier for the merchant.
merchant_name
VARCHAR(255)
NOT NULL
Company/Business name (provided during signup).
contact_person_name
VARCHAR(255)
NOT NULL
Owner’s full name (provided during signup).
email
VARCHAR(255)
NOT NULL, UNIQUE
Business email ID (used for communication and login).
phone_number
VARCHAR(15)
NOT NULL, UNIQUE
Business phone number (used for login/OTP).
status
VARCHAR(20)
Default 'active'. Check constraint → ('active','suspended','disabled')
Merchant account status.
created_at
TIMESTAMP
Default CURRENT_TIMESTAMP
Timestamp when merchant account was created.
updated_at
TIMESTAMP
Default CURRENT_TIMESTAMP
Timestamp when merchant account was last updated.


🔑 ID Generation Logic
merchant_id starts at 100000 and increments sequentially.
Example sequence:
First merchant → 100000
Second merchant → 100001
Third merchant → 100002 …

🔐 Notes
Each merchant is linked to one or more users in the oms.users table.
When a new merchant is created, a trigger auto-creates the admin user in oms.users.
The email and phone_number must be unique across all merchants.

📌 Workflow
Merchant Signup
FE sends:
merchant_name
contact_person_name
email
phone_number
password
BE/DB actions:
Creates a new row in oms.merchants.
Auto-assigns merchant_id (e.g., 1000003).
Creates the admin user in oms.users:
user_id = merchant_id * 10 + 1 (e.g., 10000031)
Role = admin, Status = active
Password stored as bcrypt hash.
Response to FE:
{
  "merchant_id": 1000003,
  "user_id": 10000031,
  "role": "admin",
  "status": "active"
}



📌 Frontend Developer Note: oms.merchants
1. What FE Sends at Merchant Signup
When a new merchant is signing up, FE must send these fields:
merchant_name → Business/Company name
contact_person_name → Owner’s full name
email → Business email ID
phone_number → Business phone number
password → (raw, plain text, via HTTPS)

2. What BE/DB Does Automatically
Generates a 7-digit merchant_id (starting from 100000).
Creates a new record in oms.merchants.
Automatically creates the first user (admin) in oms.users:
user_id = merchant_id * 10 + 1 (example: 10000031)
Role = admin
Status = active
Password stored securely (bcrypt hash).

3. What FE Gets Back in Response
After signup, FE receives:
{
  "merchant_id": 1000003,
  "user_id": 10000031,
  "role": "admin",
  "status": "active"
}


4. Important Rules
FE never sends merchant_id → it’s generated by backend.
Password must only travel over HTTPS (never log raw passwords).
email and phone_number must be unique across all merchants.
If signup fails (duplicate email/phone), FE will receive an error response.






Merchant Table stores all registered business accounts.
 During signup, we capture:
Business name (merchant_name)
Owner’s name (contact_person_name)
Business email (email)
Phone number (phone_number)
Backend will auto-generate:
A unique 7-digit Merchant Code (merchant_code)
Internal merchant_id (primary key)
status defaults to active (can later be suspended/disabled by admin)
created_at and updated_at timestamps
The merchant_code should be shown on the dashboard & used for references in invoices, orders, etc.





5. Queries 


-- 1. Create schema (if not already created)
CREATE SCHEMA IF NOT EXISTS oms;

-- 2. Create a custom sequence inside oms schema (starts at 1000000)
CREATE SEQUENCE oms.merchant_seq START 1000000;

-- 3. Create merchants table in oms schema
CREATE TABLE oms.merchants (
    merchant_id BIGINT PRIMARY KEY DEFAULT nextval('oms.merchant_seq'), -- auto ID starting at 1000000
    merchant_name VARCHAR(255) NOT NULL,
    contact_person_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);








