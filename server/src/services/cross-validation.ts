import Database from 'better-sqlite3';
import { activePath } from '../db/source.js';

export function crossValidation(){
 const hw=activePath('hardware_configurator'), mf=activePath('manufacturing_log');
 if(!hw||!mf)return {status:'pending',message:'Both databases must be active',hardwareActive:!!hw,manufacturingActive:!!mf};
 const db=new Database(hw,{readonly:true});
 try{
  db.exec(`ATTACH DATABASE '${mf.replaceAll("'","''")}' AS mf`);
  const row=db.prepare(`SELECT
   (SELECT COUNT(*) FROM valves) configuratorValves,
   (SELECT COUNT(*) FROM mf.manufacturing_log) manufacturingRows,
   (SELECT COUNT(*) FROM mf.manufacturing_log m JOIN valves v ON m.valve_id GLOB '[0-9]*' AND m.valve_id NOT GLOB '*[^0-9]*' AND CAST(m.valve_id AS INTEGER)=v.valve_id) matchedManufacturingRows,
   (SELECT COUNT(*) FROM mf.manufacturing_log m LEFT JOIN valves v ON m.valve_id GLOB '[0-9]*' AND m.valve_id NOT GLOB '*[^0-9]*' AND CAST(m.valve_id AS INTEGER)=v.valve_id WHERE v.valve_id IS NULL) unmatchedManufacturingRows,
   (SELECT COUNT(DISTINCT v.valve_id) FROM valves v JOIN mf.manufacturing_log m ON m.valve_id GLOB '[0-9]*' AND m.valve_id NOT GLOB '*[^0-9]*' AND CAST(m.valve_id AS INTEGER)=v.valve_id) valvesWithHistory,
   (SELECT COUNT(*) FROM valves v WHERE NOT EXISTS(SELECT 1 FROM mf.manufacturing_log m WHERE m.valve_id GLOB '[0-9]*' AND m.valve_id NOT GLOB '*[^0-9]*' AND CAST(m.valve_id AS INTEGER)=v.valve_id)) valvesNeverManufactured,
   (SELECT COUNT(*) FROM mf.manufacturing_log m JOIN valves v ON m.valve_id GLOB '[0-9]*' AND m.valve_id NOT GLOB '*[^0-9]*' AND CAST(m.valve_id AS INTEGER)=v.valve_id WHERE COALESCE(m.valve_brand,'')<>COALESCE(v.valve_brand,'') OR COALESCE(m.valve_size,'')<>COALESCE(v.valve_size,'') OR COALESCE(m.valve_class,'')<>COALESCE(v.valve_class,'') OR COALESCE(m.valve_model,'')<>COALESCE(v.valve_model_number,'')) historicalIdentityMismatches`).get();
  return {status:'complete',...row as object};
 }finally{db.close();}
}
