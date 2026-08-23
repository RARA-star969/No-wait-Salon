import type { Salon } from '../types';
import { authHeaders } from './customerAccountService';

const API_BASE_URL=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/$/,'');
export type QrBusiness=Salon&{businessType:string;qrStatus:string;liveWaitMinutes:number;waitingCustomers:number;queueAccepting:boolean};

async function request<T>(path:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(`${API_BASE_URL}${path}`,{...init,headers:{'Content-Type':'application/json',...authHeaders(),...init.headers}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'This QR could not be opened.');
  return body as T;
}

export function businessQrToken(rawValue:string){
  const value=rawValue.trim();
  if(!value)return null;
  try{const url=new URL(value);const match=url.pathname.match(/^\/q\/([^/]+)\/?$/);return match?decodeURIComponent(match[1]):null}catch{return /^[A-Za-z0-9_-]{24,200}$/.test(value)?value:null}
}

export const businessQrService={
  resolve:(token:string)=>request<{business:QrBusiness}>(`/api/business-qr/${encodeURIComponent(token)}`),
  join:(token:string,serviceIds:string|string[],sessionId:string,source:'qr_walk_in'|'qr_web'='qr_walk_in',preferredBarberId?:string)=>request<{joined:boolean;reason?:'already_in_queue';entry:any;state:any}>(`/api/business-qr/${encodeURIComponent(token)}/join`,{method:'POST',body:JSON.stringify({serviceIds:Array.isArray(serviceIds)?serviceIds:[serviceIds],sessionId,source,preferredBarberId:preferredBarberId||undefined,requestId:crypto.randomUUID()})}),
  recordVisit:(token:string,payload:{appCtaShown?:boolean;appCtaClicked?:boolean}={})=>request<{recorded:boolean}>(`/api/business-qr/${encodeURIComponent(token)}/visit`,{method:'POST',body:JSON.stringify(payload)}).catch(()=>({recorded:false})),
  acknowledgeCall:(salonId:string,itemId:string)=>request<any>(`/api/salons/${encodeURIComponent(salonId)}/commands`,{method:'POST',body:JSON.stringify({type:'queue_action',action:'Acknowledge',itemId})}).catch(()=>null),
  leaveQueue:(salonId:string,sessionId:string,reasonCode='other',reasonText='')=>request<any>(`/api/salons/${encodeURIComponent(salonId)}/commands`,{method:'POST',body:JSON.stringify({type:'cancel_customer',sessionId,reasonCode,reasonText})}),
  setMarketingConsent:(consent:boolean)=>request<{marketingConsent:boolean}>('/api/me/marketing-consent',{method:'PUT',body:JSON.stringify({consent})}).catch(()=>({marketingConsent:false})),
};
