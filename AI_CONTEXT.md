# Project Identity

Project Name:
Wholesale & Retail Beverage Management System

Project Type:
Enterprise Progressive Web Application (PWA)

Status:
Active Development (Approximately 60% Complete)

Primary Goal:

Develop a production-ready Retail + Wholesale Beverage Management System for Cambodia that combines:

* Retail POS
* Wholesale POS
* E-commerce
* Inventory Management
* Warehouse Management
* Customer Credit
* Supplier Management
* Purchase Management
* Delivery Management
* Reporting
* Offline Support

The project is intended for real commercial use.

---

# IMPORTANT

This project already exists.

Never regenerate the project.

Never redesign the architecture.

Never replace technologies.

Always extend the existing implementation.

Maintain backward compatibility.

---

# Technology Stack

Frontend

* Next.js App Router
* JavaScript
* JSX
* TailwindCSS
* shadcn/ui
* React Hook Form
* TanStack Query
* Zustand

Backend

* Next.js Route Handlers
* JavaScript
* Prisma ORM
* PostgreSQL
* Better Auth
* Zod Validation

Infrastructure

* Progressive Web App (PWA)
* IndexedDB
* Offline Sync
* Background Sync

---

# Source of Truth

The following files are authoritative:

1. schema.prisma

Database Structure

2. Architecture.md

System Design

3. AI_CONTEXT.md

Development Rules

Never invent fields that do not exist inside schema.prisma.

---

# Business Type

The application supports BOTH:

Retail

Wholesale

The system is NOT retail-only.

The system is NOT wholesale-only.

Everything should support both.

---

# Supported Modules

Authentication

Dashboard

Retail POS

Wholesale POS

Products

Categories

Brands

Product Variants

Inventory

Inventory Batch

Warehouse

Branch Management

Suppliers

Purchase Orders

Goods Receipts

Stock Transfers

Customers

Customer Groups

Customer Credit

Payments

Returns

Refunds

Bottle Deposits

Container Returns

Delivery

Online Orders

Coupons

Promotions

Reports

Notifications

Audit Logs

Settings

Offline Sync

Future AI Analytics

---

# Development Philosophy

Never duplicate business logic.

Reuse existing components.

Reuse utilities.

Reuse API helpers.

Keep code modular.

Prefer composition over duplication.

Maintain consistent coding style.

Minimize breaking changes.

---

# Existing Codebase

Assume these modules already exist.

Do NOT recreate them unless instructed.

Authentication

Sidebar

Navigation

Layout

Dashboard

POS

Product Management

Inventory

Customer Management

Supplier Management

API Routes

Prisma Client

Database

Shared Components

---

# Coding Rules

Use JavaScript only.

Never use TypeScript.

Never generate TS files.

Never generate TSX.

Never introduce Redux.

Use Zustand.

Use functional React components.

Use async/await.

Use ES Modules.

Use Server Components whenever possible.

Only use Client Components when necessary.

---

# UI Principles

Maintain existing design.

Reuse components.

Follow shadcn/ui.

Avoid redesigning pages.

Do not introduce a different design language.

---

# Database Principles

Schema.prisma is the single source of truth.

Every CRUD must follow Prisma exactly.

Never create fake fields.

Never create fake relationships.

Never rename existing fields.

Every database modification requires explanation.

---

# AI Workflow

Before writing code:

1. Understand the request.

2. Review existing architecture.

3. Identify affected modules.

4. Explain planned changes.

5. Generate minimal code.

6. Preserve compatibility.

Never skip analysis.

---

# Long-Term Vision

This application should be maintainable for years.

Prioritize scalability over shortcuts.

Write production-quality code.

Think like a Senior Software Engineer joining an existing enterprise project.
