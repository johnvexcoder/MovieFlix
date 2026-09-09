import { createQrPhPayment } from "./paymongo";
export interface PaymentProvider { createPayment(input:{orderId:string;amountMinor:number;description:string}):Promise<{intentId:string;paymentMethodId:string;qrImage:string;status:string;expiresAt:string}> }
export const paymentProvider:PaymentProvider={createPayment:createQrPhPayment};
