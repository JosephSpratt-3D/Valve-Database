import session from 'express-session';
import { appDb } from './app-db.js';

export class SQLiteSessionStore extends session.Store {
  get(sid:string, callback:(err:any, session?:session.SessionData|null)=>void){
    try { const row=appDb.prepare('SELECT sess FROM sessions WHERE sid=? AND expires_at>?').get(sid,Date.now()) as {sess:string}|undefined; callback(null,row?JSON.parse(row.sess):null); } catch(e){callback(e)}
  }
  set(sid:string, value:session.SessionData, callback?: (err?:any)=>void){
    try { const expires=value.cookie.expires?.getTime() || Date.now()+(value.cookie.maxAge||86400000);appDb.prepare('INSERT INTO sessions(sid,sess,expires_at) VALUES(?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess,expires_at=excluded.expires_at').run(sid,JSON.stringify(value),expires);callback?.(); } catch(e){callback?.(e)}
  }
  destroy(sid:string, callback?: (err?:any)=>void){try{appDb.prepare('DELETE FROM sessions WHERE sid=?').run(sid);callback?.()}catch(e){callback?.(e)}}
  touch(sid:string,value:session.SessionData,callback?:()=>void){const expires=value.cookie.expires?.getTime()||Date.now()+(value.cookie.maxAge||86400000);appDb.prepare('UPDATE sessions SET expires_at=? WHERE sid=?').run(expires,sid);callback?.()}
  clear(callback?: (err?:any)=>void){try{appDb.prepare('DELETE FROM sessions').run();callback?.()}catch(e){callback?.(e)}}
  length(callback:(err:any,length?:number)=>void){try{const n=(appDb.prepare('SELECT COUNT(*) n FROM sessions WHERE expires_at>?').get(Date.now()) as {n:number}).n;callback(null,n)}catch(e){callback(e)}}
}
