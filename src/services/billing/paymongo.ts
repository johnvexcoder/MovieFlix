import crypto from "crypto";

const API = "https://api.paymongo.com/v1";
function key(name:"PAYMONGO_SECRET_KEY"|"PAYMONGO_PUBLIC_KEY") { const value=process.env[name]?.trim(); if(!value) throw new Error(`${name} is not configured`); return value; }
async function call(path:string, apiKey:string, init:RequestInit){
 const response=await fetch(`${API}${path}`,{...init,headers:{Authorization:`Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,"Content-Type":"application/json",Accept:"application/json",...(init.headers||{})},cache:"no-store"});
 const data=await response.json().catch(()=>null); if(!response.ok){const detail=data?.errors?.[0]?.detail||data?.errors?.[0]?.code||`PayMongo request failed (${response.status})`;throw new Error(detail)} return data.data;
}
export interface ProviderPayment { intentId:string; paymentMethodId:string; qrImage:string; status:string; expiresAt:string }
export interface ProviderPaymentStatus { intentId:string; status:string; amountMinor:number; currency:string; paymentId:string|null }
export async function createQrPhPayment(input:{orderId:string;amountMinor:number;description:string}):Promise<ProviderPayment>{
 const intent=await call("/payment_intents",key("PAYMONGO_SECRET_KEY"),{method:"POST",body:JSON.stringify({data:{attributes:{amount:input.amountMinor,currency:"PHP",payment_method_allowed:["qrph"],description:input.description,statement_descriptor:"MOVIEFLIX",metadata:{movieflix_order_id:input.orderId}}}})});
 const method=await call("/payment_methods",key("PAYMONGO_PUBLIC_KEY"),{method:"POST",body:JSON.stringify({data:{attributes:{type:"qrph",expiry_seconds:1800}}})});
 const attached=await call(`/payment_intents/${intent.id}/attach`,key("PAYMONGO_PUBLIC_KEY"),{method:"POST",body:JSON.stringify({data:{attributes:{payment_method:method.id,client_key:intent.attributes.client_key}}})});
 const qr=attached.attributes?.next_action?.code?.image_url;
 if(typeof qr!=="string"||!qr.startsWith("data:image/")) throw new Error("PayMongo did not return a QR Ph image");
 return {intentId:intent.id,paymentMethodId:method.id,qrImage:qr,status:String(attached.attributes.status||"awaiting_next_action"),expiresAt:new Date(Date.now()+30*60*1000).toISOString()};
}
export async function retrievePaymentIntent(intentId:string):Promise<ProviderPaymentStatus>{
 const intent=await call(`/payment_intents/\${encodeURIComponent(intentId)}`,key("PAYMONGO_SECRET_KEY"),{method:"GET"});
 const attrs=intent?.attributes||{};
 const payments=Array.isArray(attrs.payments)?attrs.payments:[];
 const paid=payments.find((payment:{attributes?:{status?:string}})=>payment?.attributes?.status==="paid")||payments[0];
 return {intentId:String(intent?.id||intentId),status:String(attrs.status||""),amountMinor:Number(paid?.attributes?.amount??attrs.amount),currency:String(paid?.attributes?.currency??attrs.currency??"").toUpperCase(),paymentId:paid?.id?String(paid.id):null};
}
export function verifyPayMongoSignature(raw:string,header:string|null){
 const secret=process.env.PAYMONGO_WEBHOOK_SECRET?.trim(); if(!secret||!header)return false;
 const parts=Object.fromEntries(header.split(",").map(x=>x.trim().split("=",2))); const timestamp=parts.t; const live=process.env.PAYMONGO_SECRET_KEY?.startsWith("sk_live_"); const supplied=live?parts.li:parts.te;
 if(!timestamp||!supplied||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
 const expected=crypto.createHmac("sha256",secret).update(`${timestamp}.${raw}`).digest("hex");
 const a=Buffer.from(expected),b=Buffer.from(supplied);return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
