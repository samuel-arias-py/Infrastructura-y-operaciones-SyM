export type SupportedLocale = 'es_CO' | 'es_MX' | 'en_US' | 'es_ES';

export interface ForeignKeyReference {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface ParsedColumn {
  name: string;
  dataType: string;
  rawType: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  defaultValue?: string;
  foreignKey?: {
    table: string;
    column: string;
  };
}

export interface ParsedTable {
  name: string;
  columns: ParsedColumn[];
  foreignKeys: ForeignKeyReference[];
  dependencies: string[];
}

export interface ParsedSchemaResult {
  tables: ParsedTable[];
  executionOrder: string[];
  hasCycles: boolean;
  warnings: string[];
}

export type SemanticCategory =
  | 'id_serial'
  | 'id_uuid'
  | 'full_name'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'phone'
  | 'document_id'
  | 'city'
  | 'state'
  | 'country'
  | 'address'
  | 'postal_code'
  | 'company_name'
  | 'product_name'
  | 'product_category'
  | 'sku'
  | 'price'
  | 'quantity'
  | 'status'
  | 'url'
  | 'boolean'
  | 'timestamp'
  | 'date'
  | 'text_description'
  | 'integer'
  | 'float'
  | 'generic_string';

export interface AISemanticColumnHint {
  tableName: string;
  columnName: string;
  category: SemanticCategory;
  sampleValues?: (string | number)[];
  minNumber?: number;
  maxNumber?: number;
}

export interface SeedRow {
  [columnName: string]: string | number | boolean | null;
}

export interface TableSeedContext {
  tableName: string;
  domain: string;
  seeds: SeedRow[];
}

export interface GenerationConfig {
  sql: string;
  locale: SupportedLocale;
  rowsPerTable: number;
  seed?: number;
  useAiEnrichment?: boolean;
  aiSeedContext?: Record<string, TableSeedContext>;
}

export type TableRows = Record<string, string | number | boolean | null>[];

export interface GenerationResult {
  schema: ParsedSchemaResult;
  data: Record<string, TableRows>;
  sqlOutput: string;
  jsonOutput: string;
  stats: {
    totalTables: number;
    totalRows: number;
    totalForeignKeys: number;
    executionTimeMs: number;
    aiEnriched: boolean;
  };
}
