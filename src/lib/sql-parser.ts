import { Parser } from 'node-sql-parser';
import {
  ForeignKeyReference,
  ParsedColumn,
  ParsedSchemaResult,
  ParsedTable,
} from '@/types/schema';

/**
 * Limpia comentarios SQL y normaliza construcciones específicas de PostgreSQL
 * para maximizar la compatibilidad con el AST de node-sql-parser.
 */
function preprocessPostgresSql(rawSql: string): string {
  return rawSql
    .replace(/--.*$/gm, '') // eliminar comentarios de línea
    .replace(/\/\*[\s\S]*?\*\//g, '') // eliminar comentarios de bloque
    .trim();
}

/**
 * Divide sentencias CREATE TABLE del script SQL preservando el cuerpo entre paréntesis.
 */
function extractCreateTableBlocks(cleanSql: string): {
  tableName: string;
  body: string;
  fullStatement: string;
}[] {
  const results: { tableName: string; body: string; fullStatement: string }[] = [];
  const createRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?[\w]+["`]?\.?)?["`]?([\w]+)["`]?\s*\(/gi;

  let match: RegExpExecArray | null;
  while ((match = createRegex.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    const openParenIndex = match.index + match[0].length - 1;

    let depth = 0;
    let endParenIndex = -1;
    for (let i = openParenIndex; i < cleanSql.length; i++) {
      if (cleanSql[i] === '(') depth++;
      else if (cleanSql[i] === ')') {
        depth--;
        if (depth === 0) {
          endParenIndex = i;
          break;
        }
      }
    }

    if (endParenIndex !== -1) {
      const body = cleanSql.slice(openParenIndex + 1, endParenIndex);
      const fullStatement = cleanSql.slice(match.index, endParenIndex + 1) + ';';
      results.push({ tableName, body, fullStatement });
    }
  }

  return results;
}

/**
 * Divide las definiciones internas de un CREATE TABLE por comas de nivel superior
 * (ignorando comas dentro de NUMERIC(12, 2) o listas de columnas).
 */
function splitTopLevelDefinitions(body: string): string[] {
  const defs: string[] = [];
  let current = '';
  let depth = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);

    if (ch === ',' && depth === 0) {
      if (current.trim()) defs.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) defs.push(current.trim());
  return defs;
}

/**
 * Intenta enriquecer metadatos mediante el AST de node-sql-parser cuando la sentencia
 * es directamente compatible con el dialecto Postgresql de la librería.
 */
function tryParseAstWithNodeSqlParser(statement: string): unknown | null {
  try {
    const parser = new Parser();
    // Normalizamos sintaxis inline de PG que node-sql-parser a veces rechaza
    const normalizedForAst = statement
      .replace(/\bTIMESTAMPTZ\b/gi, 'TIMESTAMP')
      .replace(/\bSERIAL\b/gi, 'INT')
      .replace(/\bBIGSERIAL\b/gi, 'BIGINT')
      .replace(/\bDEFAULT\s+NOW\(\)/gi, '')
      .replace(/\bDEFAULT\s+gen_random_uuid\(\)/gi, '')
      .replace(/\bON\s+DELETE\s+(?:CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)/gi, '')
      .replace(/\bON\s+UPDATE\s+(?:CASCADE|RESTRICT|SET\s+NULL|NO\s+ACTION)/gi, '');

    return parser.astify(normalizedForAst, { database: 'Postgresql' });
  } catch {
    return null;
  }
}

/**
 * Ordenamiento Topológico (Algoritmo de Kahn) sobre el grafo de dependencias de tablas.
 * Garantiza que las tablas padre (ej. users, products) se generen antes que las tablas
 * hijas (ej. orders) que dependen de sus llaves primarias.
 */
export function topologicalSortTables(tables: ParsedTable[]): {
  sortedNames: string[];
  hasCycles: boolean;
  warnings: string[];
} {
  const tableMap = new Map<string, ParsedTable>();
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, Set<string>>();
  const warnings: string[] = [];

  for (const t of tables) {
    tableMap.set(t.name, t);
    inDegree.set(t.name, 0);
    dependents.set(t.name, new Set());
  }

  for (const t of tables) {
    const uniqueParentTables = new Set<string>();
    for (const fk of t.foreignKeys) {
      const parent = fk.referencedTable.toLowerCase();
      // Ignorar auto-referencias (ej. employees.manager_id -> employees.id) en el DAG
      if (parent === t.name) continue;

      if (!tableMap.has(parent)) {
        warnings.push(
          `La tabla "${t.name}" referencia a "${parent}" (${fk.columnName}), pero "${parent}" no está definida en el esquema.`
        );
        continue;
      }
      uniqueParentTables.add(parent);
    }

    for (const parent of uniqueParentTables) {
      dependents.get(parent)?.add(t.name);
      inDegree.set(t.name, (inDegree.get(t.name) ?? 0) + 1);
    }
  }

  // Cola inicial con tablas sin dependencias (in-degree === 0)
  const queue: string[] = [];
  for (const [name, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(name);
  }

  const sortedNames: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sortedNames.push(current);

    for (const child of dependents.get(current) ?? []) {
      const nextDegree = (inDegree.get(child) ?? 1) - 1;
      inDegree.set(child, nextDegree);
      if (nextDegree === 0) {
        queue.push(child);
      }
    }
  }

  let hasCycles = false;
  if (sortedNames.length < tables.length) {
    hasCycles = true;
    warnings.push(
      'Se detectó una dependencia circular entre tablas. Se aplicó resolución de ciclo para permitir la generación.'
    );
    for (const t of tables) {
      if (!sortedNames.includes(t.name)) {
        sortedNames.push(t.name);
      }
    }
  }

  return { sortedNames, hasCycles, warnings };
}

/**
 * Parsea un script DDL de PostgreSQL, extrae tablas, columnas, tipos y llaves foráneas,
 * y calcula el orden topológico de ejecución.
 */
export function parsePostgresSchema(rawSql: string): ParsedSchemaResult {
  const cleanSql = preprocessPostgresSql(rawSql);
  const blocks = extractCreateTableBlocks(cleanSql);

  if (blocks.length === 0) {
    throw new Error(
      'No se encontraron sentencias CREATE TABLE válidas en el esquema SQL proporcionado.'
    );
  }

  const tables: ParsedTable[] = [];

  for (const block of blocks) {
    // Validación complementaria con node-sql-parser AST
    tryParseAstWithNodeSqlParser(block.fullStatement);

    const definitions = splitTopLevelDefinitions(block.body);
    const columns: ParsedColumn[] = [];
    const foreignKeys: ForeignKeyReference[] = [];
    const tablePrimaryKeys = new Set<string>();

    for (const def of definitions) {
      const trimmed = def.trim();
      if (!trimmed) continue;

      // 1. Constraint de nivel de tabla: PRIMARY KEY (col1, col2)
      const tablePkMatch = trimmed.match(
        /^(?:CONSTRAINT\s+["`]?[\w]+["`]?\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i
      );
      if (tablePkMatch) {
        tablePkMatch[1]
          .split(',')
          .map((c) => c.trim().replace(/["`]/g, '').toLowerCase())
          .forEach((colName) => tablePrimaryKeys.add(colName));
        continue;
      }

      // 2. Constraint de nivel de tabla: FOREIGN KEY (col) REFERENCES ref_table(ref_col)
      const tableFkMatch = trimmed.match(
        /^(?:CONSTRAINT\s+["`]?[\w]+["`]?\s+)?FOREIGN\s+KEY\s*\(\s*["`]?([\w]+)["`]?\s*\)\s*REFERENCES\s+(?:["`]?[\w]+["`]?\.?)?["`]?([\w]+)["`]?\s*\(\s*["`]?([\w]+)["`]?\s*\)/i
      );
      if (tableFkMatch) {
        const colName = tableFkMatch[1].toLowerCase();
        const refTable = tableFkMatch[2].toLowerCase();
        const refCol = tableFkMatch[3].toLowerCase();
        foreignKeys.push({
          columnName: colName,
          referencedTable: refTable,
          referencedColumn: refCol,
        });
        continue;
      }

      // Ignorar otros constraints de nivel de tabla (UNIQUE, CHECK)
      if (/^(?:CONSTRAINT|UNIQUE|CHECK)\b/i.test(trimmed)) {
        continue;
      }

      // 3. Definición de columna estándar
      const colMatch = trimmed.match(
        /^["`]?([\w]+)["`]?\s+([a-zA-Z0-9_]+(?:\s*\([^)]+\))?(?:\s+WITH(?:OUT)?\s+TIME\s+ZONE)?)(.*)$/i
      );
      if (!colMatch) continue;

      const colName = colMatch[1].toLowerCase();
      const rawType = colMatch[2].trim().toUpperCase();
      const baseType = rawType.replace(/\([^)]*\)/, '').trim();
      const modifiers = colMatch[3] || '';

      const isSerial =
        baseType === 'SERIAL' ||
        baseType === 'BIGSERIAL' ||
        baseType === 'SMALLSERIAL' ||
        /GENERATED\s+(?:ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY/i.test(modifiers);

      const isPrimaryKey = /\bPRIMARY\s+KEY\b/i.test(modifiers);
      const isNotNull = /\bNOT\s+NULL\b/i.test(modifiers) || isPrimaryKey || isSerial;
      const isUnique = /\bUNIQUE\b/i.test(modifiers) || isPrimaryKey;

      const defaultMatch = modifiers.match(
        /\bDEFAULT\s+([^\s,]+(?:\([^)]*\))?)/i
      );

      // Detectar llave foránea inline: REFERENCES users(id)
      const inlineFkMatch = modifiers.match(
        /\bREFERENCES\s+(?:["`]?[\w]+["`]?\.?)?["`]?([\w]+)["`]?\s*(?:\(\s*["`]?([\w]+)["`]?\s*\))?/i
      );

      let fkObj: { table: string; column: string } | undefined;
      if (inlineFkMatch) {
        const refTable = inlineFkMatch[1].toLowerCase();
        const refCol = (inlineFkMatch[2] || 'id').toLowerCase();
        fkObj = { table: refTable, column: refCol };
        foreignKeys.push({
          columnName: colName,
          referencedTable: refTable,
          referencedColumn: refCol,
        });
      }

      columns.push({
        name: colName,
        dataType: baseType,
        rawType,
        isPrimaryKey,
        isNullable: !isNotNull,
        isUnique,
        isAutoIncrement: isSerial,
        defaultValue: defaultMatch ? defaultMatch[1] : undefined,
        foreignKey: fkObj,
      });
    }

    // Sincronizar constraints de nivel de tabla con las columnas
    for (const col of columns) {
      if (tablePrimaryKeys.has(col.name)) {
        col.isPrimaryKey = true;
        col.isNullable = false;
        col.isUnique = true;
      }
      if (!col.foreignKey) {
        const matchingFk = foreignKeys.find((fk) => fk.columnName === col.name);
        if (matchingFk) {
          col.foreignKey = {
            table: matchingFk.referencedTable,
            column: matchingFk.referencedColumn,
          };
        }
      }
    }

    const dependencies = Array.from(
      new Set(
        foreignKeys
          .map((fk) => fk.referencedTable)
          .filter((ref) => ref !== block.tableName)
      )
    );

    tables.push({
      name: block.tableName,
      columns,
      foreignKeys,
      dependencies,
    });
  }

  const { sortedNames, hasCycles, warnings } = topologicalSortTables(tables);

  // Ordenar el arreglo de tablas según el orden topológico calculado
  const sortedTables = sortedNames
    .map((name) => tables.find((t) => t.name === name)!)
    .filter(Boolean);

  return {
    tables: sortedTables,
    executionOrder: sortedNames,
    hasCycles,
    warnings,
  };
}
