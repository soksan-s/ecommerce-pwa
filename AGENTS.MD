# AGENTS.md

# Wholesale & Retail Beverage Management System

## Project Overview

This repository contains a production-oriented Progressive Web Application (PWA) for managing retail and wholesale beverage businesses in Cambodia.

The application is intended for real commercial deployment and is under active development.

Current progress: ~60%.

The project already has an established architecture.

Do not redesign the system.

Always extend the existing implementation.

---

# Primary Goal

Build a scalable enterprise system that combines:

- Retail POS
- Wholesale POS
- E-Commerce
- Inventory Management
- Warehouse Management
- Customer Management
- Customer Credit
- Supplier Management
- Purchasing
- Delivery
- Reporting
- Offline Support
- Future AI Analytics

---

# Core Development Principles

This is an existing production codebase.

Always preserve the current architecture.

Never regenerate existing modules.

Never replace existing technologies unless explicitly instructed.

Favor extending existing code over creating new implementations.

Minimize breaking changes.

Maintain backward compatibility whenever possible.

---

# Technology Stack

## Frontend

- Next.js (App Router)
- JavaScript (No TypeScript)
- React
- JSX
- TailwindCSS
- shadcn/ui
- React Hook Form
- TanStack Query
- Zustand

## Backend

- Next.js Route Handlers
- JavaScript
- Prisma ORM
- PostgreSQL
- Better Auth
- Zod

## Infrastructure

- Progressive Web App (PWA)
- IndexedDB
- Offline Sync
- Background Sync

---

# Authentication

Authentication uses:

- Better Auth
- Firebase Phone Authentication (OTP)

Firebase is used only as the current OTP provider.

The authentication system must remain provider-agnostic.

Design authentication so the OTP provider can be replaced in the future without changing business logic or application flow.

Separate OTP provider logic from authentication logic.

Avoid coupling application code directly to Firebase APIs.

Future providers may include:

- Twilio
- MessageBird
- Vonage
- Local Cambodian SMS providers
- Self-hosted SMS gateways

The application should require minimal code changes when switching providers.

---

# User Roles

Current implementation only supports three roles:

- ADMIN
- CASHIER
- CLIENT

These are the only active roles in the current system.

The Prisma schema may contain additional role values for future expansion, but they are currently inactive.

Do not implement features for inactive roles unless explicitly requested.

---

# Source of Truth

Always treat these files as authoritative.

1. prisma/schema.prisma

Defines the database schema.

Never invent database fields.

Never invent relationships.

Never rename existing columns.

2. Architecture.md

Defines the overall architecture.

3. AGENTS.md

Defines project rules and development guidelines.

If these files conflict with generated code, follow these files.

---

# Existing Modules

Assume these modules already exist.

Do not recreate them.

- Authentication
- Dashboard
- Sidebar
- Navigation
- Layout
- POS
- Products
- Categories
- Brands
- Inventory
- Warehouse
- Branch Management
- Suppliers
- Purchase Orders
- Goods Receipts
- Customers
- Customer Credit
- Payments
- Returns
- Refunds
- Delivery
- Reports
- Notifications
- Audit Logs
- Settings
- Shared Components
- API Routes
- Prisma Client

Always extend existing modules before creating new ones.

---

# Coding Standards

Use JavaScript only.

Never generate:

- TypeScript
- TSX

Use:

- Functional React Components
- ES Modules
- async/await

Prefer:

- Server Components

Use Client Components only when necessary.

Never introduce Redux.

Use Zustand for global state.

Follow existing project conventions.

Reuse utilities before creating new ones.

Reuse existing hooks.

Reuse shared components.

Avoid duplicated business logic.

---

# UI Guidelines

Preserve the existing UI.

Follow the current design system.

Reuse shadcn/ui components.

Do not redesign pages unless requested.

Maintain a consistent user experience.

---

# Database Rules

Prisma is the single source of truth.

Every CRUD operation must match the Prisma schema.

Never generate fake models.

Never create unsupported relationships.

Before changing the database:

- explain why
- explain impact
- preserve existing data whenever possible

---

# Offline Support

Offline functionality is a core requirement.

Any feature affecting data synchronization should consider:

- IndexedDB
- Background Sync
- Conflict Resolution
- Offline-first behavior

Avoid solutions that require a permanent internet connection.

---

# Development Workflow

Before writing code:

1. Understand the feature request.
2. Identify affected modules.
3. Review existing implementation.
4. Reuse existing code whenever possible.
5. Explain the implementation plan.
6. Implement the smallest safe change.
7. Verify compatibility with existing functionality.

Do not rewrite large sections of the application without explicit approval.

---

# Response Expectations

When generating code:

- Prefer modifying existing files.
- Avoid unnecessary refactoring.
- Explain important architectural decisions.
- Keep code production-ready.
- Consider maintainability and scalability.
- Keep responses focused on the requested task.

When information is missing, inspect the existing codebase before making assumptions.

---

# Long-Term Vision

This project is intended to evolve into an enterprise-grade retail and wholesale management platform.

Prioritize:

- Scalability
- Maintainability
- Reliability
- Clean architecture
- Modular design
- Performance
- Future extensibility

Think like a senior software engineer contributing to an established production system rather than creating a new project.