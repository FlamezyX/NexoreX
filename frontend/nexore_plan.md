# NEXOREX  
## Multi-Vendor Marketplace Platform  
### Business Proposal & Technical Documentation  

**Prepared:** April 20, 2026  
**Version:** 1.0 — Confidential  

---

# 1. Executive Summary

Nexore is a modern, multi-vendor e-commerce marketplace designed to connect local buyers and sellers within a single state, with a clear roadmap to expand statewide and nationally. The platform enables anyone to register as a buyer or seller, with a rigorous seller vetting and approval process managed by the platform administrator.

Nexore operates on a commission-based revenue model, earning **5% on every successful transaction** processed through the platform. All payments are managed through bank transfers routed via Nexore’s central account, giving the platform operator full financial oversight, fraud control, and payout management.

The platform is built with scalability in mind — starting lean with a single-state focus, but architected to grow into a full national marketplace with minimal re-engineering.

| Item | Details |
|------|--------|
| Platform Name | NexoreX |
| Business Type | Multi-Vendor E-Commerce Marketplace |
| Target Market | Local buyers and sellers (single state, expanding) |
| Revenue Model | 5% commission on every completed sale |
| Payment Method | Bank Transfer (via central Nexore account) |
| Launch Stage | MVP — Version 1.0 |

---

# 2. Business Model

## 2.1 How Nexore Makes Money

Nexore’s primary revenue stream is a platform commission charged on every successful sale.

| Revenue Stream | How It Works | Rate |
|---------------|-------------|------|
| Transaction Commission | Deducted from every confirmed sale | 5% |
| Shipping Control | Admin sets all shipping rates | Fixed |
| Future: Seller Subscriptions | Monthly premium seller plans | TBD |
| Future: Featured Listings | Paid product boosts | TBD |

---

## 2.2 Payment & Money Flow

1. Buyer places order  
2. Payment instructions shown  
3. Buyer transfers funds  
4. Admin confirms payment  
5. Commission deducted (5%)  
6. Seller wallet credited (95%)  
7. Seller requests withdrawal  
8. Admin processes payout  

---

## 2.3 Seller Wallet System

| Field | Description |
|------|------------|
| Total Earned | Total earnings after commission |
| Available Balance | Withdrawable funds |
| Pending Balance | Orders not yet completed |
| Total Withdrawn | Total paid out |

---

# 3. Platform Features

## 3.1 User Roles

| Role | Description | Permissions |
|------|------------|------------|
| Buyer | Shops on platform | Browse, buy, review |
| Seller | Approved vendor | List products, manage sales |
| Admin | Platform owner | Full control |

---

## 3.2 Features Overview

### Authentication
- Register/login system  
- Seller application system  
- Admin approval  

### Product Management
- Add/edit/delete products  
- Admin approval required  
- Categories system  

### Shopping
- Search & filters  
- Cart system  
- Checkout  

### Orders
- Status tracking  
- Payment proof upload  
- Admin confirmation  

### Reviews
- 1–5 star ratings  
- Only after delivery  

### Messaging
- Buyer ↔ Seller chat  
- Real-time (Socket.io)  

### Notifications
- Real-time updates  
- Order + system alerts  

---

# 4. Admin Panel

| Module | Function |
|-------|---------|
| Dashboard | Stats & overview |
| Applications | Approve/reject sellers |
| Orders | Manage and verify payments |
| Products | Approve listings |
| Withdrawals | Handle payouts |
| Wallets | Track seller balances |
| Users | Manage accounts |
| Shipping | Set delivery pricing |
| Analytics | Revenue tracking |

---

# 5. Shipping & Delivery

## 5.1 Strategy
- Single-state focus  
- Admin-controlled pricing  

## 5.2 Options

| Type | Time |
|------|------|
| Standard | 3–5 days |
| Express | 1–2 days |
| Same Day | Same day |
| Pickup | Arranged |

---

# 6. Technical Architecture

## 6.1 Stack

| Layer | Tech |
|------|-----|
| Frontend | React + Tailwind |
| Backend | Node.js + Express |
| Database | MySQL |
| Auth | JWT + bcrypt |
| Real-time | Socket.io |

---

## 6.2 Database Tables (Summary)

- users  
- seller_applications  
- products  
- categories  
- orders  
- order_items  
- wallets  
- transactions  
- withdrawal_requests  
- reviews  
- notifications  
- messages  
- shipping_options  
- platform_earnings  

---

## 6.3 Security

- Password hashing (bcrypt)  
- JWT authentication  
- Role-based access  
- SQL injection protection  
- File validation  

---

## 6.4 Project Structure
