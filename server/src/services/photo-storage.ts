import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import { paths } from '../config.js';import { appDb } from '../db/app-db.js';import type { ValveRepository } from '../repositories/valve.js';

export interface PhotoStorageService {
  listForValve(valveId:number):Promise<Record<string,unknown>[]>;
  save(valveId:number,temporaryPath:string,originalFileName:string,userId:number,metadata:{caption?:string;photoType?:string;isPrimary?:boolean}):Promise<number>;
}
export class LocalPhotoStorageService implements PhotoStorageService {
 constructor(private valves:ValveRepository){}
 async listForValve(valveId:number){return appDb.prepare('SELECT id,valve_id,original_file_name,caption,photo_type,is_primary,created_at FROM valve_photos WHERE valve_id=? ORDER BY is_primary DESC,id').all(valveId) as Record<string,unknown>[]}
 async save(valveId:number,temporaryPath:string,originalFileName:string,userId:number,metadata:{caption?:string;photoType?:string;isPrimary?:boolean}){if(!await this.valves.getValveById(valveId))throw Object.assign(new Error('Valve not found'),{status:404});const extension=path.extname(originalFileName).toLowerCase();const stored=`${crypto.randomUUID()}${extension}`;const directory=path.join(paths.photos,String(valveId));fs.mkdirSync(directory,{recursive:true});fs.copyFileSync(temporaryPath,path.join(directory,stored));const insert=appDb.transaction(()=>{if(metadata.isPrimary)appDb.prepare('UPDATE valve_photos SET is_primary=0 WHERE valve_id=?').run(valveId);return appDb.prepare('INSERT INTO valve_photos(valve_id,stored_file_name,original_file_name,caption,photo_type,is_primary,uploaded_by) VALUES (?,?,?,?,?,?,?)').run(valveId,stored,path.basename(originalFileName),metadata.caption||null,metadata.photoType||null,metadata.isPrimary?1:0,userId)});return Number(insert().lastInsertRowid)}
}
