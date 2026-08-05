let csrf='';
export async function api<T=any>(url:string,options:RequestInit={}):Promise<T>{const headers=new Headers(options.headers);if(options.body&&!headers.has('Content-Type')&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');if(!['GET','HEAD'].includes(options.method||'GET')&&csrf)headers.set('X-CSRF-Token',csrf);const res=await fetch(`/api${url}`,{...options,headers,credentials:'include'});const data=res.status===204?null:await res.json().catch(()=>null);if(!res.ok)throw new Error(data?.error||`Request failed (${res.status})`);return data;}
export async function session(){const x=await api<{user:User|null;csrfToken:string}>('/auth/session');csrf=x.csrfToken;return x;}
export function setCsrf(x:string){csrf=x}
export interface User{id:number;username:string;role:'admin'|'user'}
