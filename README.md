# Rcommitra - E-commerce Management System

## Project Description

Rcommitra is a comprehensive e-commerce management system designed to streamline various aspects of online retail operations. It provides functionalities for managing products, inventory, customer orders, payments, and user access, with a focus on scalability, multi-channel support, and data integrity. The system aims to offer a robust backend for handling core e-commerce logic and a responsive frontend for administrative tasks.

## Features

*   **User Management**: Secure user authentication, role-based access control, and multi-user support per merchant.
*   **Product Management**: Create, update, and manage product listings with unique SKUs, pricing, and descriptions.
*   **Inventory Management**: Track stock levels, manage inventory across multiple locations, and handle reorder levels.
*   **Order Management**: Process customer orders from various channels (POS, WhatsApp, Marketplace), manage order items, and track order status.
*   **Payment Processing**: Record and manage order payments.
*   **Customer Management**: Maintain customer records.
*   **Reporting**: Generate reports on sales, inventory, and other key metrics.
*   **Security**: Implement password hashing, HTTPS enforcement, and session security.

## Technology Stack

*   **Backend**: Node.js, TypeScript, Express.js
*   **Database**: PostgreSQL (with Drizzle ORM for schema definition)
*   **Frontend**: React, TypeScript, Vite
*   **Styling**: Tailwind CSS
*   **Version Control**: Git

## Database Schema

The database schema is designed to support a multi-merchant e-commerce platform. Below is a detailed description of the key tables, their columns, relationships, and business rules.

### 1. `oms.merchants`

*   **Purpose**: Stores information about each merchant using the platform.
*   **Columns**:
    *   `merchant_id` (PK): Unique identifier for the merchant.
    *   `name`: Name of the merchant.
    *   `email`: Contact email for the merchant.
    *   `phone_number`: Contact phone number for the merchant.
    *   `address`: Physical address of the merchant.
    *   `created_at`: Timestamp of merchant creation.
    *   `updated_at`: Timestamp of last update.
*   **Business Rules**:
    *   `merchant_id` is auto-generated.
    *   Each merchant has a unique `merchant_id`.

### 2. `oms.users`

*   **Purpose**: Stores login and access information for users under each merchant.
*   **Columns**:
    *   `user_id` (PK): Unique identifier for the user.
    *   `merchant_id` (FK to `oms.merchants`): Identifier for the merchant the user belongs to.
    *   `username`: Unique username for login.
    *   `email`: User's email address.
    *   `phone_number`: User's phone number.
    *   `password_hash`: Hashed password for security.
    *   `role`: User's role (e.g., 'admin', 'employee').
    *   `status`: User account status (e.g., 'active', 'inactive').
    *   `created_at`: Timestamp of user creation.
    *   `updated_at`: Timestamp of last update.
*   **Relationships**:
    *   One-to-many with `oms.merchants` (`merchant_id`).
*   **Business Rules**:
    *   `user_id` is generated as `merchant_id * 10 + suffix` (suffix ensures uniqueness within a merchant).
    *   Maximum of 6 users per merchant.
    *   Passwords are stored as hashes.
    *   An 'admin' user is auto-created during merchant signup.
*   **FE Notes**:
    *   Frontend sends `username`, `email`, `phone_number`, `password`, `role` (for adding users).
    *   Frontend never sends `merchant_id` directly.
    *   Raw passwords only travel via HTTPS.

### 3. `oms.products`

*   **Purpose**: Stores information about products offered by merchants.
*   **Columns**:
    *   `product_id` (PK): Unique identifier for the product.
    *   `merchant_id` (FK to `oms.merchants`): Identifier for the merchant who owns the product.
    *   `name`: Product name.
    *   `description`: Product description.
    *   `sku`: Stock Keeping Unit (unique per merchant).
    *   `price`: Selling price of the product.
    *   `category`: Product category.
    *   `image_url`: URL to product image.
    *   `created_at`: Timestamp of product creation.
    *   `updated_at`: Timestamp of last update.
*   **Relationships**:
    *   One-to-many with `oms.merchants` (`merchant_id`).
*   **Business Rules**:
    *   `product_id` starts from 1,000,000 and is generated using a sequence.
    *   `sku` is auto-generated based on `merchant_id` and `product_id` and must be unique per merchant.
    *   `name` and `price` are required.
*   **FE Notes**:
    *   Frontend sends `name`, `description`, `price`, `category`, `image_url`.
    *   Backend handles `product_id`, `sku`, `created_at`, `updated_at`.

### 4. `oms.inventory`

*   **Purpose**: Manages stock levels for products.
*   **Columns**:
    *   `inventory_id` (PK): Unique identifier for the inventory record.
    *   `product_id` (FK to `oms.products`): Identifier for the product.
    *   `merchant_id` (FK to `oms.merchants`): Identifier for the merchant.
    *   `location`: Storage location of the inventory.
    *   `quantity`: Current stock quantity.
    *   `reorder_level`: Threshold to trigger reorder.
    *   `last_restocked_at`: Timestamp of last restock.
    *   `created_at`: Timestamp of inventory record creation.
    *   `updated_at`: Timestamp of last update.
*   **Relationships**:
    *   One-to-one with `oms.products` (`product_id`).
    *   One-to-many with `oms.merchants` (`merchant_id`).
*   **Business Rules**:
    *   `quantity` cannot be negative.
    *   `reorder_level` should be less than `quantity`.
    *   `inventory_id` is auto-generated.
*   **FE Notes**:
    *   Frontend sends `product_id`, `location`, `quantity`, `reorder_level`.
    *   Backend handles `inventory_id`, `merchant_id`, `last_restocked_at`, `created_at`, `updated_at`.

### 5. `oms.customers`

*   **Purpose**: Stores customer information.
*   **Columns**:
    *   `customer_id` (PK): Unique identifier for the customer.
    *   `merchant_id` (FK to `oms.merchants`): Identifier for the merchant the customer belongs to.
    *   `first_name`: Customer's first name.
    *   `last_name`: Customer's last name.
    *   `email`: Customer's email address.
    *   `phone_number`: Customer's phone number.
    *   `address`: Customer's address.
    *   `created_at`: Timestamp of customer creation.
    *   `updated_at`: Timestamp of last update.
*   **Relationships**:
    *   One-to-many with `oms.merchants` (`merchant_id`).
*   **Business Rules**:
    *   `customer_id` is auto-generated.
    *   `email` or `phone_number` should be unique per merchant.
*   **FE Notes**:
    *   Frontend sends `first_name`, `last_name`, `email`, `phone_number`, `address`.
    *   Backend handles `customer_id`, `merchant_id`, `created_at`, `updated_at`.

### 6. `oms.orders`

*   **Purpose**: Stores information about customer orders.
*   **Columns**:
    *   `order_id` (PK): Unique identifier for the order.
    *   `merchant_id` (FK to `oms.merchants`): Identifier for the merchant.
    *   `customer_id` (FK to `oms.customers`): Identifier for the customer who placed the order.
    *   `order_date`: Date and time the order was placed.
    *   `total_amount`: Total amount of the order.
    *   `status`: Current status of the order (e.g., 'pending', 'completed', 'cancelled').
    *   `channel`: Origin of the order (e.g., 'POS', 'WhatsApp', 'Marketplace').
    *   `created_at`: Timestamp of order creation.
    *   `updated_at`: Timestamp of last update.
*   **Relationships**:
    *   One-to-many with `oms.merchants` (`merchant_id`).
    *   Many-to-one with `oms.customers` (`customer_id`).
*   **Business Rules**:
    *   `order_id` is auto-generated.
    *   `total_amount` is calculated from `order_items`.
    *   `status` transitions are managed by the system.
*   **FE Notes**:
    *   Frontend sends `customer_id`, `order_items` (product_id, quantity, price), `channel`.
    *   Backend handles `order_id`, `merchant_id`, `order_date`, `total_amount`, `status`, `created_at`, `updated_at`.

### 7. `oms.order_items`

*   **Purpose**: Stores details of items within an order.
*   **Columns**:
    *   `order_item_id` (PK): Unique identifier for the order item.
    *   `order_id` (FK to `oms.orders`): Identifier for the parent order.
    *   `product_id` (FK to `oms.products`): Identifier for the product ordered.
    *   `quantity`: Quantity of the product ordered.
    *   `price_at_order`: Price of the product at the time of order.
    *   `subtotal`: `quantity * price_at_order`.
    *   `created_at`: Timestamp of order item creation.
    *   `updated_at`: Timestamp of last update.
*   **Relationships**:
    *   Many-to-one with `oms.orders` (`order_id`).
    *   Many-to-one with `oms.products` (`product_id`).
*   **Business Rules**:
    *   `order_item_id` is auto-generated.
    *   `subtotal` is calculated.
    *   Inventory is updated when an order item is created/updated.
*   **FE Notes**:
    *   Frontend sends `product_id`, `quantity`, `price_at_order`.
    *   Backend handles `order_item_id`, `order_id`, `subtotal`, `created_at`, `updated_at`.

### 8. `oms.order_payments`

*   **Purpose**: Records payment transactions for orders.
*   **Columns**:
    *   `payment_id` (PK): Unique identifier for the payment.
    *   `order_id` (FK to `oms.orders`): Identifier for the order being paid.
    *   `merchant_id` (FK to `oms.merchants`): Identifier for the merchant.
    *   `amount`: Amount paid.
    *   `payment_method`: Method of payment (e.g., 'credit card', 'cash', 'UPI').
    *   `transaction_id`: External transaction ID (if any).
    *   `payment_date`: Date and time of payment.
    *   `status`: Status of the payment (e.g., 'successful', 'failed', 'refunded').
    *   `created_at`: Timestamp of payment record creation.
    *   `updated_at`: Timestamp of last update.
*   **Relationships**:
    *   Many-to-one with `oms.orders` (`order_id`).
    *   One-to-many with `oms.merchants` (`merchant_id`).
*   **Business Rules**:
    *   `payment_id` is auto-generated.
    *   `amount` should match `order.total_amount` for full payment.
*   **FE Notes**:
    *   Frontend sends `order_id`, `amount`, `payment_method`, `transaction_id`.
    *   Backend handles `payment_id`, `merchant_id`, `payment_date`, `status`, `created_at`, `updated_at`.

### 9. `oms.order_status_history`

*   **Purpose**: Tracks the status changes of an order.
*   **Columns**:
    *   `history_id` (PK): Unique identifier for the status history record.
    *   `order_id` (FK to `oms.orders`): Identifier for the order.
    *   `status`: New status of the order.
    *   `changed_at`: Timestamp when the status changed.
    *   `changed_by`: User or system that changed the status.
*   **Relationships**:
    *   Many-to-one with `oms.orders` (`order_id`).
*   **Business Rules**:
    *   `history_id` is auto-generated.
    *   A new record is created every time an order's status changes.
*   **FE Notes**:
    *   Backend handles all aspects of this table.

## API Endpoints (High-Level)

The backend exposes RESTful API endpoints for managing resources.

*   `/api/auth/signup`: Merchant signup and initial admin user creation.
*   `/api/auth/login`: User login.
*   `/api/users`: Manage users (add, view, update).
*   `/api/products`: Manage products (create, view, update, delete).
*   `/api/inventory`: Manage inventory (view, update stock).
*   `/api/customers`: Manage customer records.
*   `/api/orders`: Manage orders (create, view, update status).
*   `/api/payments`: Process and view payments.
*   `/api/reports`: Generate various reports.

## Frontend Structure

The frontend is a React application structured into pages and components.

*   **Pages**:
    *   `Landing.tsx`: Public landing page.
    *   `Login.tsx`: User login page.
    *   `Signup.tsx`: Merchant signup page.
    *   `Dashboard.tsx`: Main dashboard for merchants.
    *   `Inventory.tsx`: Inventory management page.
    *   `Orders.tsx`: Order listing and detail page.
    *   `Invoices.tsx`: Invoices management page.
    *   `Reports.tsx`: Reporting page.
    *   `Settings.tsx`: User and merchant settings.
    *   `EmployeeDashboard.tsx`, `EmployeeInventory.tsx`, `EmployeeOrders.tsx`: Employee-specific views.
*   **Components**: Reusable UI elements like `Sidebar`, `DownloadDropdown`, `FileUpload`, `ProtectedRoute`, and various UI components (buttons, cards, inputs).
*   **Contexts**: `AuthContext`, `ThemeContext`, `WebSocketContext` for global state management.
*   **Utilities**: `utils.ts` for general utilities, `activityLogger.ts`, `currency.ts`.

## Getting Started

To set up and run the project locally, follow these steps:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/HD3-run/Rcommitra.git
    cd Rcommitra
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Set up environment variables**:
    Create an `.env` file in the root directory based on `envfiles/example.env` and fill in the necessary database credentials and other configurations.

4.  **Database Setup**:
    *   Ensure PostgreSQL is running.
    *   Create a new database for the project.
    *   Run the SQL schema creation scripts (from `dbschema.md` and `backend/utils/indexes.sql`) to set up tables, sequences, functions, and triggers.

5.  **Run the application**:
    *   **Backend**:
        ```bash
        npm run start:backend
        ```
    *   **Frontend**:
        ```bash
        npm run start:frontend
        ```

6.  Access the application in your browser, usually at `http://localhost:5173` for the frontend.

## Future Enhancements / Missing Features

Based on the current schema and project scope, the following features or tables are identified as potential future enhancements or currently missing:

*   **Suppliers Management**: Dedicated tables for `suppliers` and `purchase_orders`, `purchase_order_items` to manage procurement.
*   **Invoicing**: While `Invoices.tsx` exists, dedicated `invoices` and `invoice_items` tables for formal invoice generation and tracking.
*   **Shipping Management**: Tables and logic for managing shipping details, carriers, and tracking.
*   **Returns Management**: Tables for `returns` and `return_items` to handle product returns.
*   **Notifications**: A system for sending notifications to users or merchants.
*   **Audit Logs**: Comprehensive `audit_logs` to track all significant actions within the system for compliance and debugging.
*   **General Payments Table**: A more generalized `payments` table that can handle various types of payments beyond just order payments (e.g., subscription payments, refunds).
*   **Activities**: A table to log user and system activities for better traceability.
