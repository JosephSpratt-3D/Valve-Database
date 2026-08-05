export type Role = 'admin' | 'user';
export type DatabaseSourceType = 'hardware_configurator' | 'manufacturing_log';
export interface SessionUser { id: number; username: string; role: Role }
export interface ValidationIssue { level: 'error' | 'warning' | 'info'; code: string; message: string; count?: number }
export interface DatabaseValidationReport { valid: boolean; sourceType: DatabaseSourceType; integrityCheck: string; rowCounts: Record<string, number>; issues: ValidationIssue[]; details: Record<string, unknown> }
