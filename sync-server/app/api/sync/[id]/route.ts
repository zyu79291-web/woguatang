import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
const allowed = new Set(["https://zyu79291-web.github.io", "http://localhost:8765", "http://127.0.0.1:8765", "http://localhost:8899", "http://127.0.0.1:8899", "https://woguatang-sync.zyu79291.chatgpt.site"]);
const hash = async (s:string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,"0")).join("");
function reply(req:Request,body:unknown,status=200){
 const origin=req.headers.get("Origin"),headers:Record<string,string>={"Cache-Control":"no-store", "Content-Type":"application/json", "Vary":"Origin", "X-Content-Type-Options":"nosniff"};
 if(origin&&allowed.has(origin)){headers["Access-Control-Allow-Origin"]=origin;headers["Access-Control-Allow-Headers"]="Authorization,Content-Type";headers["Access-Control-Allow-Methods"]="GET,PUT,OPTIONS";headers["Access-Control-Max-Age"]="600";}
 return new Response(status===204?null:JSON.stringify(body),{status,headers});
}
function identity(req:Request){
 const origin=req.headers.get("Origin");if(origin&&!allowed.has(origin))return null;
 const id=new URL(req.url).pathname.split("/").pop()||"",auth=req.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 return /^[a-f0-9]{64}$/.test(id)&&auth?{id,auth}:null;
}
export async function OPTIONS(req:Request){return reply(req,null,allowed.has(req.headers.get("Origin")||"")?204:403)}
export async function GET(req:Request){
 const who=identity(req);if(!who)return reply(req,{error:"unauthorized"},401);
 const row=await env.DB!.prepare("SELECT payload,revision,updated_at FROM sync_vaults WHERE id=? AND auth_hash=?").bind(who.id,await hash(who.auth)).first();
 return row?reply(req,row):reply(req,{error:"not_found"},404);
}
export async function PUT(req:Request){
 const who=identity(req);if(!who)return reply(req,{error:"unauthorized"},401);
 if(Number(req.headers.get("content-length")||0)>1500000)return reply(req,{error:"too_large"},413);
 const raw=await req.text();if(raw.length>1500000)return reply(req,{error:"too_large"},413);
 let data;try{data=JSON.parse(raw)}catch{return reply(req,{error:"invalid_json"},400)}
 if(!Number.isSafeInteger(data.revision)||data.revision<0||typeof data.payload!=="string"||!/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/.test(data.payload))return reply(req,{error:"invalid_payload"},400);
 const authHash=await hash(who.auth),now=Date.now(),db=env.DB!;
 const old=await db.prepare("SELECT revision,auth_hash FROM sync_vaults WHERE id=?").bind(who.id).first<{revision:number,auth_hash:string}>();
 if(old&&old.auth_hash!==authHash)return reply(req,{error:"not_found"},404);
 if(old&&old.revision!==data.revision)return reply(req,{error:"conflict"},409);
 if(!old){
  if(data.revision!==0)return reply(req,{error:"conflict"},409);
  const ip=req.headers.get("CF-Connecting-IP");
  if(ip){const bucket=await hash(ip+":"+Math.floor(now/3600000));const rate=await db.prepare("INSERT INTO sync_rates(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count").bind(bucket).first<{count:number}>();if(rate&&rate.count>10)return reply(req,{error:"rate_limited"},429);}
  const result=await db.prepare("INSERT INTO sync_vaults(id,auth_hash,payload,revision,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(id) DO NOTHING").bind(who.id,authHash,data.payload,now).run();
  return result.meta.changes?reply(req,{revision:1,updated_at:now},201):reply(req,{error:"conflict"},409);
 }
 const result=await db.prepare("UPDATE sync_vaults SET previous=payload,payload=?,revision=revision+1,updated_at=? WHERE id=? AND auth_hash=? AND revision=?").bind(data.payload,now,who.id,authHash,data.revision).run();
 return result.meta.changes?reply(req,{revision:data.revision+1,updated_at:now}):reply(req,{error:"conflict"},409);
}
