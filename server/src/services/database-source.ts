import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { appDb, audit } from '../db/app-db.js';
import { activePath } from '../db/source.js';
import { paths } from '../config.js';
import { manufacturingColumns } from '../repositories/manufacturing.js';
import type { DatabaseSourceType, DatabaseValidationReport, ValidationIssue } from '../../../shared/types/index.js';

const hardware:Record<string,string[]> = {
 valves:['valve_id','valve_brand','valve_size','valve_class','valve_model_number','valve_port','stem_type','description'],
 valve_keyed_stems:['valve_id','stem_diameter','stem_height','key_qty','key_width','key_cross','valve_bhc','valve_hole_dia','valve_hole_qty','valve_start_angle'],
 valve_flat_stems:['valve_id','stem_height','flat_width','flat_depth','valve_bhc','valve_hole_dia','valve_hole_qty','valve_start_angle','packing_flange','packing_flange_width','packing_flange_length','packing_flange_angle','dia_reduction','dia_reduction_value','stem_thread','stem_thread_dia','stem_thread_depth','u_bolt','u_bolt_valve_width','u_bolt_valve_length','valve_pattern_type','valve_grid_x_distance','valve_grid_y_distance'],
 actuator_sets:['actuator_id','actuator_name','theme_name','square_size','square_height','sq_rad','d_stem','actuator_hole_dia','actuator_bhc','actuator_hole_qty','actuator_start_angle','bracket_height'],
 bracket_patterns:['bracket_id','bracket_code','actuator_1_bhc','actuator_1_hole_dia','actuator_1_hole_qty','actuator_1_start_angle','actuator_2_bhc','actuator_2_hole_dia','actuator_2_hole_qty','actuator_2_start_angle','actuator_3_bhc','actuator_3_hole_dia','actuator_3_hole_qty','actuator_3_start_angle','valve_bhc','valve_hole_dia','valve_hole_qty','valve_start_angle','valve_2_bhc','valve_2_hole_dia','valve_2_hole_qty','valve_2_start_angle','valve_3_bhc','valve_3_hole_dia','valve_3_hole_qty','valve_3_start_angle','bracket_width','bracket_length','bracket_height','actuator_bracket_center_hole','valve_bracket_center_hole','packing_flange','packing_flange_width','packing_flange_length','packing_flange_angle','d_actuator_bracket_center_hole_offset','d_actuator_bhc_offset','hole_grid_length','hole_grid_width'],
 universal_adapters:['id','universal_adapter_name','square_size','square_height','sq_rad','one_p_adapter_length','actuator_name','adapter_od_fixed']
};
const count=(db:Database.Database,sql:string,...p:unknown[]) => (db.prepare(sql).get(...p) as {n:number}).n;
export class LocalDatabaseSourceService {
 validateUpload(type:DatabaseSourceType,file:string):DatabaseValidationReport {
  const issues:ValidationIssue[]=[]; const rowCounts:Record<string,number>={}; const details:Record<string,unknown>={}; let db:Database.Database|undefined;
  try {
   db=new Database(file,{readonly:true,fileMustExist:true}); db.pragma('query_only=ON');
   const integrity=String((db.pragma('integrity_check') as Array<{integrity_check:string}>)[0]?.integrity_check||'');
   if(integrity!=='ok') issues.push({level:'error',code:'integrity',message:`Integrity check returned: ${integrity}`});
   const required=type==='hardware_configurator'?hardware:{manufacturing_log:[...manufacturingColumns]};
   const tables=new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {name:string}[]).map(r=>r.name));
   for(const [table,columns] of Object.entries(required)) {
    if(!tables.has(table)){issues.push({level:'error',code:'missing_table',message:`Missing required table: ${table}`});continue;}
    const actual=(db.prepare(`PRAGMA table_info("${table}")`).all() as {name:string}[]).map(r=>r.name); const set=new Set(actual);
    for(const col of columns) if(!set.has(col)) issues.push({level:'error',code:'missing_column',message:`${table} is missing required column: ${col}`});
    const extras=actual.filter(c=>!columns.includes(c)); if(extras.length) issues.push({level:'info',code:'extra_columns',message:`${table} has additional columns: ${extras.join(', ')}`});
    rowCounts[table]=count(db,`SELECT COUNT(*) n FROM "${table}"`);
   }
   if(!issues.some(i=>i.level==='error')) type==='hardware_configurator'?this.hardwareChecks(db,issues,details):this.manufacturingChecks(db,issues,details);
   return {valid:!issues.some(i=>i.level==='error'),sourceType:type,integrityCheck:integrity,rowCounts,issues,details};
  } catch(e){ return {valid:false,sourceType:type,integrityCheck:'failed',rowCounts,issues:[{level:'error',code:'not_sqlite',message:`Unable to open a valid SQLite database: ${(e as Error).message}`}],details}; }
  finally { db?.close(); }
 }
 private hardwareChecks(db:Database.Database,issues:ValidationIssue[],details:Record<string,unknown>){
  const checks:[string,string,string][]=[
   ['bad_stem_type',"SELECT COUNT(*) n FROM valves WHERE stem_type NOT IN ('KEYED','FLATS')",'Valves have unsupported stem types'],
   ['orphan_keyed','SELECT COUNT(*) n FROM valve_keyed_stems k LEFT JOIN valves v ON v.valve_id=k.valve_id WHERE v.valve_id IS NULL','Keyed-stem rows reference missing valves'],
   ['orphan_flat','SELECT COUNT(*) n FROM valve_flat_stems f LEFT JOIN valves v ON v.valve_id=f.valve_id WHERE v.valve_id IS NULL','Flat-stem rows reference missing valves'],
   ['missing_keyed',"SELECT COUNT(*) n FROM valves v LEFT JOIN valve_keyed_stems k ON k.valve_id=v.valve_id WHERE v.stem_type='KEYED' AND k.valve_id IS NULL",'KEYED valves lack keyed-stem details'],
   ['missing_flat',"SELECT COUNT(*) n FROM valves v LEFT JOIN valve_flat_stems f ON f.valve_id=v.valve_id WHERE v.stem_type='FLATS' AND f.valve_id IS NULL",'FLATS valves lack flat-stem details'],
   ['both_stems','SELECT COUNT(*) n FROM valves v JOIN valve_keyed_stems k ON k.valve_id=v.valve_id JOIN valve_flat_stems f ON f.valve_id=v.valve_id','Valves have both stem-detail types'],
   ['blank_selectors',"SELECT COUNT(*) n FROM valves WHERE TRIM(COALESCE(valve_brand,''))='' OR TRIM(COALESCE(valve_size,''))='' OR TRIM(COALESCE(valve_class,''))=''",'Valves have blank selector fields'],
   ['blank_models',"SELECT COUNT(*) n FROM valves WHERE TRIM(COALESCE(valve_model_number,''))=''",'Valves have blank model numbers']];
  for(const [code,sql,msg] of checks){const n=count(db,sql);if(n)issues.push({level:code==='bad_stem_type'||code.startsWith('orphan')?'error':'warning',code,message:`${n} ${msg}`,count:n});}
  const duplicates=db.prepare("SELECT valve_brand,valve_size,valve_class,valve_model_number,COUNT(*) n FROM valves GROUP BY valve_brand,valve_size,valve_class,valve_model_number HAVING COUNT(*)>1").all(); if(duplicates.length)issues.push({level:'warning',code:'duplicate_selector',message:`${duplicates.length} duplicate brand/size/class/model combinations`,count:duplicates.length}); details.duplicateCombinations=duplicates;
  let malformed=0;for(const [table,columns] of Object.entries(hardware)){const numeric=(db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{name:string;type:string}>).filter(c=>/^(REAL|NUMERIC|INTEGER)$/.test(c.type.toUpperCase())&&!['valve_id','actuator_id','bracket_id','id'].includes(c.name));for(const c of numeric)malformed+=count(db,`SELECT COUNT(*) n FROM "${table}" WHERE "${c.name}" IS NOT NULL AND typeof("${c.name}") NOT IN ('integer','real')`);}if(malformed)issues.push({level:'warning',code:'malformed_dimensions',message:`${malformed} dimensional values are not stored as numbers`,count:malformed});
 }
 private manufacturingChecks(db:Database.Database,issues:ValidationIssue[],details:Record<string,unknown>){
  const blank=count(db,"SELECT COUNT(*) n FROM manufacturing_log WHERE TRIM(COALESCE(timestamp,''))=''"); if(blank)issues.push({level:'error',code:'blank_timestamp',message:`${blank} rows have blank timestamps`,count:blank});
  const malformed=count(db,"SELECT COUNT(*) n FROM manufacturing_log WHERE timestamp NOT GLOB '????-??-?? ??:??:??'"); if(malformed)issues.push({level:'warning',code:'timestamp_format',message:`${malformed} timestamps do not match YYYY-MM-DD HH:MM:SS`,count:malformed});
  const badIds=count(db,"SELECT COUNT(*) n FROM manufacturing_log WHERE TRIM(COALESCE(valve_id,''))='' OR valve_id NOT GLOB '[0-9]*' OR valve_id GLOB '*[^0-9]*'"); if(badIds)issues.push({level:'warning',code:'invalid_valve_id',message:`${badIds} rows have blank or non-integer valve IDs`,count:badIds});
  details.range=db.prepare('SELECT MIN(timestamp) oldest,MAX(timestamp) newest,COUNT(DISTINCT valve_id) distinctValveIds FROM manufacturing_log').get();
  const hw=activePath('hardware_configurator');if(hw){const configDb=new Database(hw,{readonly:true,fileMustExist:true});try{const ids=new Set((configDb.prepare('SELECT valve_id FROM valves').all() as Array<{valve_id:number}>).map(x=>String(x.valve_id)));const rows=db.prepare("SELECT valve_id,COUNT(*) n FROM manufacturing_log WHERE valve_id GLOB '[0-9]*' AND valve_id NOT GLOB '*[^0-9]*' GROUP BY valve_id").all() as Array<{valve_id:string;n:number}>;const unmatched=rows.filter(x=>!ids.has(String(Number(x.valve_id)))).reduce((n,x)=>n+x.n,0);details.hardwareCrossCheck={status:'complete',unmatchedRows:unmatched};if(unmatched)issues.push({level:'warning',code:'unmatched_valve_ids',message:`${unmatched} manufacturing rows reference valve IDs absent from the active hardware database`,count:unmatched});}finally{configDb.close();}}else details.hardwareCrossCheck={status:'pending'};
 }
 activateUpload(type:DatabaseSourceType,temp:string,original:string,userId:number,ip?:string){
  const report=this.validateUpload(type,temp); if(!report.valid) throw Object.assign(new Error('Database validation failed'),{status:400,report});
  const final=path.join(paths.active,`${type}.db`), staged=path.join(paths.active,`.${type}-${crypto.randomUUID()}.tmp`), previous=activePath(type);
  fs.copyFileSync(temp,staged); if(previous&&fs.existsSync(previous)){const backup=path.join(paths.backups,`${type}-${new Date().toISOString().replaceAll(':','-')}.db`);fs.copyFileSync(previous,backup);}
  fs.renameSync(staged,final); const stat=fs.statSync(final); const fingerprint=crypto.createHash('sha256').update(JSON.stringify(report.rowCounts)).digest('hex'); const recordCount=Object.values(report.rowCounts).reduce((a,b)=>a+b,0);
  appDb.prepare(`INSERT INTO database_sources(source_type,active_file_path,original_file_name,file_size_bytes,uploaded_at,uploaded_by,validation_status,validation_message,integrity_check_result,record_count,schema_fingerprint) VALUES (?,?,?,?,CURRENT_TIMESTAMP,?,'valid',?,?,?,?) ON CONFLICT(source_type) DO UPDATE SET active_file_path=excluded.active_file_path,original_file_name=excluded.original_file_name,file_size_bytes=excluded.file_size_bytes,uploaded_at=CURRENT_TIMESTAMP,uploaded_by=excluded.uploaded_by,validation_status=excluded.validation_status,validation_message=excluded.validation_message,integrity_check_result=excluded.integrity_check_result,record_count=excluded.record_count,schema_fingerprint=excluded.schema_fingerprint`).run(type,final,path.basename(original),stat.size,userId,JSON.stringify(report),report.integrityCheck,recordCount,fingerprint);
  audit(userId,'database.upload','database_source',type,{originalFileName:path.basename(original),report},ip); return report;
 }
 revalidate(type:DatabaseSourceType){const file=activePath(type);if(!file)throw Object.assign(new Error('No active database'),{status:404});const report=this.validateUpload(type,file);appDb.prepare('UPDATE database_sources SET validation_status=?,validation_message=?,integrity_check_result=? WHERE source_type=?').run(report.valid?'valid':'invalid',JSON.stringify(report),report.integrityCheck,type);return report;}
}
