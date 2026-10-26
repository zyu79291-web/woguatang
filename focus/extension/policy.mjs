export const HOME='http://localhost:8765/';
export const ALLOWED=[HOME,'https://chatgpt.com/','https://www.ptexj.com/pte/user_center/home?type=home'];
export function isPractice(url){try{const u=new URL(url);return ['http:','https:'].includes(u.protocol)&&['localhost','127.0.0.1'].includes(u.hostname)&&u.port==='8765'&&!u.username&&!u.password}catch{return false}}
export function isAllowed(url,extensionOrigin=''){
 try{const u=new URL(url);if(u.username||u.password)return false;if(extensionOrigin&&u.protocol==='chrome-extension:'&&u.host===new URL(extensionOrigin).host)return true;
 return isPractice(url)||(u.protocol==='https:'&&(!u.port||u.port==='443')&&['chatgpt.com','www.ptexj.com','ptexj.com'].includes(u.hostname))}catch{return false}
}
export const RULES=[
 {id:1,priority:1,action:{type:'block'},condition:{regexFilter:'^https?://',resourceTypes:['main_frame']}},
 {id:2,priority:2,action:{type:'allow'},condition:{regexFilter:'^https?://(localhost|127\\.0\\.0\\.1):8765(/|$)',resourceTypes:['main_frame']}},
 {id:3,priority:2,action:{type:'allow'},condition:{regexFilter:'^https://chatgpt\\.com(:443)?(/|$)',resourceTypes:['main_frame']}},
 {id:4,priority:2,action:{type:'allow'},condition:{regexFilter:'^https://(www\\.)?ptexj\\.com(:443)?(/|$)',resourceTypes:['main_frame']}}
];
