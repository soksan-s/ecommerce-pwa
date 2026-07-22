# Architecture

## Overview

Wholesale & Retail Beverage Management System

Enterprise Progressive Web Application (PWA)

Designed for Cambodia.

Supports:

- Retail
- Wholesale
- E-Commerce

Offline capable.

Production ready.

## High-Level Architecture

Browser (PWA)
        │
        ▼
Next.js App Router
        │
        ▼
Route Handlers
        │
        ▼
Business Services
        │
        ▼
Prisma ORM
        │
        ▼
PostgreSQL

## Authentication

User

↓

Better Auth

↓

Firebase OTP

↓

Session

↓

Protected Routes

## Folder Structure
