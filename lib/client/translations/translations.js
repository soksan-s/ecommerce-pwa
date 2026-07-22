"use client";

import { useMemo } from "react";

export const translations = {
  en: {
    // Client Storefront Navigation
    shop: "Shop",
    favorites: "Favorites",
    cart: "Cart",
    orders: "Orders",
    profile: "Profile",
    logout: "Log Out",
    theme: "Theme",
    language: "Language",
    english: "English",
    khmer: "Khmer",
    open_nav: "Open Navigation",
    close_nav: "Close Navigation",

    // Client Storefront — Product List / Filters
    all_categories: "All Categories",
    search_placeholder: "Search products...",
    search_products_deals: "Search products, categories, deals",
    filters: "Filters",
    reset: "Reset",
    clear_filters: "Clear filters",
    sort_by: "Sort by",
    quick_filters: "Quick filters",
    price: "Price",
    categories: "Categories",
    search_categories: "Search categories",
    show_more: "Show more",
    no_matching_products: "No matching products.",
    products_ready: "{count} products ready to browse",
    filter_hint: "Filter by deals, stock, price range, and grocery category.",
    grocery_items: "{count} grocery items",

    // Client Storefront — Product Card
    add_to_cart: "Add to Cart",
    out_of_stock: "Out of Stock",
    in_stock: "{count} in stock",

    // Client Storefront — Favorites
    no_favorites_yet: "No favorites yet",
    no_favorites_hint: "Tap the heart on any product and it will appear here.",

    // Client Storefront — Cart
    items_in_cart: "items in cart",
    cart_empty: "Your cart is empty.",
    cart_empty_hint: "Your cart is empty. Add products from the shop tab.",
    proceed_to_checkout: "Proceed to checkout",
    total: "Total",
    subtotal: "Subtotal",
    remove: "Remove",

    // Client Storefront — Checkout
    checkout: "Checkout",
    order_summary: "Order summary",
    items: "Items",
    delivery_details: "Delivery details",
    shipping_address: "Shipping address",
    shipping_address_hint: "Please enter a full shipping address.",
    use_current_location: "Use current location",
    pick_on_map: "Or tap the map to pick a delivery point",
    map_location_hint: "Allow location access or tap the map. You can still edit the address below.",
    coupon_hint: "Have a promo code from your coupon wallet or a campaign? Enter it below and the backend will validate the discount when you place the order.",
    enter_coupon: "Enter coupon (optional)",
    coupon_wallet_note: "Copy a code from Profile > Coupon wallet and paste it here. Each account can redeem a coupon only once.",
    payment_method: "Payment method",
    cash_on_delivery: "Cash on delivery",
    credit_card: "Credit card",
    bank_transfer: "Bank transfer",
    place_order: "Place order securely",
    placing_order: "Placing order...",

    // Client Storefront — Order History
    order_history: "Order History",
    search_order: "Search order ID, address, payment, product",
    all_status: "All status",
    status_pending: "Pending",
    status_processing: "Processing",
    status_shipped: "Shipped",
    status_delivered: "Delivered",
    status_cancelled: "Cancelled",
    newest: "Newest",
    oldest: "Oldest",
    total_high: "Total high-low",
    total_low: "Total low-high",
    date_range: "Date range",
    no_orders: "No orders found.",
    order_placed: "Order placed",
    view_detail: "View detail",

    // POS UI
    pos: "POS",
    cashier_checkout: "Cashier Checkout",
    online: "Online",
    offline: "Offline",
    checking: "Checking",
    search_products: "Search Products",
    current_sale: "Current Sale",
    select_products_pos: "Select products to start an in-store sale.",
    cash: "Cash",
    card: "Card",
    khqr: "KHQR",
    bank_transfer_pos: "Bank Transfer",
    customer_credit: "Customer Credit",
    cash_received: "Cash Received",
    change: "Change",
    complete_sale: "Complete Sale",
    sales_queued: "offline sales queued",
    storefront: "Storefront",
    admin: "Admin",
    back_to_pos: "Back to POS",

    // POS tabs/navigation
    dashboard: "Dashboard",
    new_sale: "New Sale",
    products: "Products",
    reports: "Reports",
    shifts: "Shifts",
    returns: "Returns",
    exchanges: "Exchanges",
    settings: "Settings",

    // Admin Reports
    export_csv: "Export CSV",
    export_sales: "Sales Report",
    export_inventory: "Inventory Report",
    export_credits: "Receivables Report",
    export_containers: "Container Ledger",
    export_procurement: "Procurement Report",
    refresh: "Refresh",

    // Others
    tax: "Tax",
    currency_label: "USD",
    change_language: "Change Language",
    left: "left",
    each: "each",
    decrease: "Decrease",
    increase: "Increase",
    pending: "Pending",
  },
  km: {
    // Client Storefront Navigation
    shop: "ហាងទំនិញ",
    favorites: "ទំនិញពេញចិត្ត",
    cart: "កន្ត្រកទំនិញ",
    orders: "ប្រវត្តិកុម្ម៉ង់",
    profile: "គណនី",
    logout: "ចាកចេញ",
    theme: "រចនាប័ទ្ម",
    language: "ភាសា",
    english: "English",
    khmer: "ភាសាខ្មែរ",
    open_nav: "បើកម៉ឺនុយ",
    close_nav: "បិទម៉ឺនុយ",

    // Client Storefront — Product List / Filters
    all_categories: "គ្រប់ប្រភេទ",
    search_placeholder: "ស្វែងរកផលិតផល...",
    search_products_deals: "ស្វែងរកផលិតផល ប្រភេទ ឬ ការផ្តល់ជូន",
    filters: "តម្រង",
    reset: "កំណត់ឡើងវិញ",
    clear_filters: "លុបតម្រង",
    sort_by: "តម្រៀបតាម",
    quick_filters: "តម្រងរហ័ស",
    price: "តម្លៃ",
    categories: "ប្រភេទ",
    search_categories: "ស្វែងរកប្រភេទ",
    show_more: "មើលបន្ថែម",
    no_matching_products: "រកមិនឃើញផលិតផល។",
    products_ready: "ផលិតផល {count} ត្រៀមរួចរាល់ហើយ",
    filter_hint: "តម្រងតាមការផ្តល់ជូន ស្ដុក ជួររថម្លៃ និង ប្រភេទ",
    grocery_items: "មានទំនិញ {count} មុខ",

    // Client Storefront — Product Card
    add_to_cart: "បន្ថែមទៅកន្ត្រក",
    out_of_stock: "អស់ពីស្តុក",
    in_stock: "នៅក្នុងស្ដុក {count}",

    // Client Storefront — Favorites
    no_favorites_yet: "មិនទាន់មានទំនិញពេញចិត្ត",
    no_favorites_hint: "ចុចរូបបេះដូងលើផលិតផលណាមួយ ហើយវានឹងបង្ហាញនៅទីនេះ។",

    // Client Storefront — Cart
    items_in_cart: "មុខទំនិញក្នុងកន្ត្រក",
    cart_empty: "កន្ត្រកទំនិញរបស់អ្នកទទេស្អាត។",
    cart_empty_hint: "កន្ត្រកទំនិញទទេ។ សូមបន្ថែមផលិតផលពីផ្ទាំងហាង។",
    proceed_to_checkout: "ចូលទៅទូទាត់ប្រាក់",
    total: "សរុប",
    subtotal: "សរុបដំណាក់កាល",
    remove: "លុបចេញ",

    // Client Storefront — Checkout
    checkout: "ទូទាត់ប្រាក់",
    order_summary: "សង្ខេបការបញ្ជាទិញ",
    items: "មុខទំនិញ",
    delivery_details: "ព័ត៌មានដឹកជញ្ជូន",
    shipping_address: "អាសយដ្ឋានដឹកជញ្ជូន",
    shipping_address_hint: "សូមបញ្ចូលអាសយដ្ឋានដឹកជញ្ជូនពេញ។",
    use_current_location: "ប្រើទីតាំងបច្ចុប្បន្ន",
    pick_on_map: "ឬចុចលើផែនទីដើម្បីជ្រើសទីតាំងដឹកជញ្ជូន",
    map_location_hint: "អនុញ្ញាតទីតាំង ឬចុចលើផែនទី។ អ្នកនៅតែអាចកែអាសយដ្ឋានខាងក្រោមបាន។",
    coupon_hint: "មានលេខកូដបញ្ចុះតម្លៃ? បញ្ចូលខាងក្រោម ហើយប្រព័ន្ធនឹងផ្ទៀងផ្ទាត់ស្វ័យប្រវត្តិ។",
    enter_coupon: "បញ្ចូលលេខកូដ (ស្រេចចិត្ត)",
    coupon_wallet_note: "ចម្លងលេខកូដពី គណនី > កាបូបបញ្ចុះតម្លៃ ហើយបិទភ្ជាប់នៅទីនេះ។ គណនីនីមួយៗ អាចប្រើបានម្ដង។",
    payment_method: "វិធីសាស្ត្របង់ប្រាក់",
    cash_on_delivery: "ប្រាក់ក្រដាស (បង់ពេលទទួល)",
    credit_card: "កាតឥណទាន",
    bank_transfer: "ផ្ទេរតាមធនាគារ",
    place_order: "ដាក់ការបញ្ជាទិញ",
    placing_order: "កំពុងដាក់ការបញ្ជាទិញ...",

    // Client Storefront — Order History
    order_history: "ប្រវត្តិការបញ្ជាទិញ",
    search_order: "ស្វែងរក ID ការបញ្ជាទិញ អាសយដ្ឋាន ការទូទាត់ ឬ ផលិតផល",
    all_status: "ស្ថានភាពទាំងអស់",
    status_pending: "រង់ចាំ",
    status_processing: "កំពុងដំណើរការ",
    status_shipped: "ដឹកជញ្ជូនហើយ",
    status_delivered: "ដល់ហើយ",
    status_cancelled: "បានលុបចោល",
    newest: "ថ្មីជាងគេ",
    oldest: "ចាស់ជាងគេ",
    total_high: "តម្លៃខ្ពស់ → ទាប",
    total_low: "តម្លៃទាប → ខ្ពស់",
    date_range: "ជួរកាលបរិច្ឆេទ",
    no_orders: "រកមិនឃើញការបញ្ជាទិញ។",
    order_placed: "ការបញ្ជាទិញត្រូវបានដាក់",
    view_detail: "មើលព័ត៌មានលម្អិត",

    // POS UI
    pos: "ប្រព័ន្ធលក់ (POS)",
    cashier_checkout: "គិតលុយលក់រាយ",
    online: "អនឡាញ",
    offline: "អហ្វឡាញ",
    checking: "កំពុងពិនិត្យ",
    search_products: "ស្វែងរកផលិតផល",
    current_sale: "ការលក់បច្ចុប្បន្ន",
    select_products_pos: "សូមជ្រើសរើសផលិតផលដើម្បីចាប់ផ្តើមលក់។",
    cash: "សាច់ប្រាក់",
    card: "កាត",
    khqr: "KHQR",
    bank_transfer_pos: "ផ្ទេរប្រាក់តាមធនាគារ",
    customer_credit: "ជំពាក់ (សន្យាប្រាក់)",
    cash_received: "ប្រាក់ទទួល",
    change: "ប្រាក់អាប់",
    complete_sale: "បញ្ចប់ការលក់",
    sales_queued: "ការលក់អហ្វឡាញត្រូវបានរក្សាទុក",
    storefront: "មុខហាង",
    admin: "គ្រប់គ្រង",
    back_to_pos: "ត្រឡប់ទៅ POS",

    // POS tabs/navigation
    dashboard: "ផ្ទាំងគ្រប់គ្រង",
    new_sale: "លក់ថ្មី",
    products: "ផលិតផល",
    reports: "របាយការណ៍",
    shifts: "វេនលក់",
    returns: "បង្វិលទំនិញ",
    exchanges: "ប្តូររង្វាន់",
    settings: "ការកំណត់",

    // Admin Reports
    export_csv: "នាំចេញ CSV",
    export_sales: "របាយការណ៍លក់",
    export_inventory: "របាយការណ៍ស្ដុក",
    export_credits: "របាយការណ៍ជំពាក់",
    export_containers: "ប្រតិបត្តិការធុង",
    export_procurement: "របាយការណ៍ទិញ",
    refresh: "ផ្ទុកឡើងវិញ",

    // Others
    tax: "ពន្ធ (VAT)",
    currency_label: "ដុល្លារ (USD)",
    change_language: "ផ្លាស់ប្តូរភាសា",
    left: "នៅសល់",
    each: "នីមួយៗ",
    decrease: "បន្ថយ",
    increase: "បន្ថែម",
    pending: "រង់ចាំ",
  }
};

export function useTranslation(lang) {
  const currentLang = lang === "km" ? "km" : "en";

  return useMemo(
    () => ({
      t: (key) => translations[currentLang]?.[key] || translations.en?.[key] || key,
      language: currentLang,
    }),
    [currentLang],
  );
}
