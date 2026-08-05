import { withSource } from '../db/source.js';

export interface ValveRepository {
  getBrands(): Promise<string[]>; getSizes(brand:string):Promise<string[]>; getClasses(brand:string,size:string):Promise<string[]>;
  getModels(brand:string,size:string,valveClass:string):Promise<Array<{valveId:number;model:string}>>; getValveById(id:number):Promise<Record<string,unknown>|null>;
}
export class SQLiteValveRepository implements ValveRepository {
 async getBrands(){ return withSource('hardware_configurator', db => (db.prepare("SELECT DISTINCT valve_brand value FROM valves WHERE valve_brand IS NOT NULL AND TRIM(valve_brand)<>'' ORDER BY valve_brand COLLATE NOCASE").all() as {value:string}[]).map(x=>x.value)); }
 async getSizes(brand:string){ return withSource('hardware_configurator', db => (db.prepare("SELECT DISTINCT valve_size value FROM valves WHERE valve_brand=? AND valve_size IS NOT NULL AND TRIM(valve_size)<>'' ORDER BY CASE WHEN TRIM(valve_size) GLOB '[0-9]*' THEN CAST(valve_size AS REAL) END, valve_size COLLATE NOCASE").all(brand) as {value:string}[]).map(x=>x.value)); }
 async getClasses(brand:string,size:string){ return withSource('hardware_configurator', db => (db.prepare("SELECT DISTINCT valve_class value FROM valves WHERE valve_brand=? AND valve_size=? AND valve_class IS NOT NULL AND TRIM(valve_class)<>'' ORDER BY CASE WHEN TRIM(valve_class) GLOB '[0-9]*' THEN CAST(valve_class AS INTEGER) END, valve_class COLLATE NOCASE").all(brand,size) as {value:string}[]).map(x=>x.value)); }
 async getModels(brand:string,size:string,valveClass:string){ return withSource('hardware_configurator', db => (db.prepare("SELECT valve_id valveId,valve_model_number model FROM valves WHERE valve_brand=? AND valve_size=? AND valve_class=? AND valve_model_number IS NOT NULL AND TRIM(valve_model_number)<>'' ORDER BY valve_model_number COLLATE NOCASE").all(brand,size,valveClass) as Array<{valveId:number;model:string}>)); }
 async getValveById(id:number){ return withSource('hardware_configurator', db => (db.prepare(`SELECT v.valve_id,v.valve_brand,v.valve_size,v.valve_class,v.valve_model_number,v.valve_port,v.stem_type,v.description,
 k.stem_diameter AS keyed_stem_diameter,k.stem_height AS keyed_stem_height,k.key_qty,k.key_width,k.key_cross,k.valve_bhc AS keyed_valve_bhc,k.valve_hole_dia AS keyed_valve_hole_dia,k.valve_hole_qty AS keyed_valve_hole_qty,k.valve_start_angle AS keyed_valve_start_angle,
 f.stem_height AS flat_stem_height,f.flat_width,f.flat_depth,f.valve_bhc AS flat_valve_bhc,f.valve_hole_dia AS flat_valve_hole_dia,f.valve_hole_qty AS flat_valve_hole_qty,f.valve_start_angle AS flat_valve_start_angle,f.packing_flange,f.packing_flange_width,f.packing_flange_length,f.packing_flange_angle,f.dia_reduction,f.dia_reduction_value,f.stem_thread,f.stem_thread_dia,f.stem_thread_depth,f.u_bolt,f.u_bolt_valve_width,f.u_bolt_valve_length,f.valve_pattern_type,f.valve_grid_x_distance,f.valve_grid_y_distance,
 CASE WHEN v.stem_type='KEYED' AND k.valve_id IS NULL THEN 1 WHEN v.stem_type='FLATS' AND f.valve_id IS NULL THEN 1 ELSE 0 END AS stem_detail_missing
 FROM valves v LEFT JOIN valve_keyed_stems k ON k.valve_id=v.valve_id AND v.stem_type='KEYED' LEFT JOIN valve_flat_stems f ON f.valve_id=v.valve_id AND v.stem_type='FLATS' WHERE v.valve_id=?`).get(id) as Record<string,unknown>|undefined) || null); }
}
