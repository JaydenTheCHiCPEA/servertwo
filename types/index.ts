export type UserRole = "admin" | "manager" | "cashier";

export interface Permissions {
  acceptPayments: boolean;
  applyDiscounts: boolean;
  applyRestrictedDiscounts: boolean;
  changeTaxes: boolean;
  manageOpenTickets: boolean;
  voidSavedItems: boolean;
  openCashDrawer: boolean;
  viewCosts: boolean;
  viewReceipts: boolean;
  performRefunds: boolean;
  accessBackOffice: boolean;
  manageItems: boolean;
  manageEmployees: boolean;
  viewReports: boolean;
  manageSettings: boolean;
}

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  salary: number;
  hourlyRate: number;
  permissions: Permissions;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
}

export interface Item {
  id: string;
  name: string;
  price: number;
  cost: number;
  categoryId: string;
  stock: number;
  minStock: number;
  taxRateId: string | null;
  imageUri: string | null;
  barcode: string | null;
  active: boolean;
}

export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  discountAmount: number;
  taxRate: number;
}

export interface DiscountRule {
  id: string;
  name: string;
  type: "percent" | "amount";
  value: number;
  requiresApproval: boolean;
  active: boolean;
}

export interface CashMovement {
  id: string;
  type: "in" | "out";
  amount: number;
  note: string;
  timestamp: string;
}

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  startTime: string;
  endTime: string | null;
  openingCash: number;
  closingCash: number | null;
  expectedCash: number | null;
  cashDifference: number | null;
  cashMovements: CashMovement[];
  salesCount: number;
  salesTotal: number;
  status: "open" | "closed";
}

export interface Transaction {
  id: string;
  receiptNumber: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentType: "cash" | "card" | "other";
  cashGiven: number;
  changeDue: number;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  timestamp: string;
  type: "sale" | "refund";
  refundedTransactionId?: string;
  notes: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  receiptFooter: string;
}
