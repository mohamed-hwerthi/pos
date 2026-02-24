import { OrderSource } from "../Order-source.model";
import { ClientCustomer } from "./client-customer.model";
import { ClientOrderItem } from "./client-order-item.model";

export interface VatBreakdownLine {
  vatRate: number;
  baseAmount: number;
  vatAmount: number;
  totalAmount: number;
}

export interface ClientOrder {
  id?: string;
  orderItems: ClientOrderItem[];
  customer?: ClientCustomer;
  total: number;
  subTotal: number;
  status?: string;
  createdAt?: string;
  orderNumber?: string;
  source: OrderSource;
  cashierSessionId?: string;
  cashReceived?: number;
  changeGiven?: number;
  tableId: string;
  clientId: string;
  totalExclTax?: number;
  totalVatAmount?: number;
  vatBreakdown?: VatBreakdownLine[];
  paymentMethod?: string;
  nf525SequentialNumber?: number;
  nf525Hash?: string;
  nf525ShortHash?: string;
  nf525PreviousHash?: string;
  nf525GrandTotal?: number;
}
