import { Faker, es_MX, en_US, es, en } from '@faker-js/faker';
import {
  AISemanticColumnHint,
  GenerationConfig,
  GenerationResult,
  ParsedColumn,
  ParsedTable,
  SemanticCategory,
  SupportedLocale,
  TableRows,
} from '@/types/schema';
import { parsePostgresSchema } from './sql-parser';

/**
 * Datos regionales específicos para enriquecer localizaciones como Colombia (es_CO),
 * México (es_MX), EE. UU. (en_US) y España (es_ES).
 */
const REGIONAL_PRESETS: Record<
  SupportedLocale,
  {
    countryName: string;
    cities: string[];
    phonePrefix: string;
    priceMultiplier: number;
    ecomProducts: { name: string; category: string; basePriceUsd: number }[];
  }
> = {
  es_CO: {
    countryName: 'Colombia',
    cities: [
      'Bogotá D.C.',
      'Medellín',
      'Cali',
      'Barranquilla',
      'Cartagena',
      'Bucaramanga',
      'Pereira',
      'Manizales',
    ],
    phonePrefix: '+57 3',
    priceMultiplier: 4000, // COP aproximado
    ecomProducts: [
      { name: 'Teclado Mecánico Keychron K2 Pro', category: 'Periféricos', basePriceUsd: 95 },
      { name: 'Monitor UltraWide LG 34" WQHD', category: 'Monitores', basePriceUsd: 420 },
      { name: 'Silla Ergonómica Mesh Pro', category: 'Oficina', basePriceUsd: 260 },
      { name: 'Café Especial Origen Huila 500g', category: 'Alimentos', basePriceUsd: 12 },
      { name: 'Audífonos Sony WH-1000XM5', category: 'Audio', basePriceUsd: 340 },
      { name: 'SSD NVMe Samsung 990 Pro 2TB', category: 'Almacenamiento', basePriceUsd: 175 },
      { name: 'Hub USB-C Thunderbolt 4 12-en-1', category: 'Accesorios', basePriceUsd: 85 },
      { name: 'Cámara Web 4K Elgato Facecam', category: 'Streaming', basePriceUsd: 150 },
    ],
  },
  es_MX: {
    countryName: 'México',
    cities: [
      'Ciudad de México',
      'Monterrey',
      'Guadalajara',
      'Puebla',
      'Querétaro',
      'Mérida',
      'Tijuana',
      'León',
    ],
    phonePrefix: '+52 55 ',
    priceMultiplier: 18, // MXN aproximado
    ecomProducts: [
      { name: 'Teclado Mecánico Keychron K2 Pro', category: 'Periféricos', basePriceUsd: 95 },
      { name: 'Monitor UltraWide LG 34" WQHD', category: 'Monitores', basePriceUsd: 420 },
      { name: 'Silla Ergonómica Mesh Pro', category: 'Oficina', basePriceUsd: 260 },
      { name: 'Audífonos Sony WH-1000XM5', category: 'Audio', basePriceUsd: 340 },
      { name: 'SSD NVMe Samsung 990 Pro 2TB', category: 'Almacenamiento', basePriceUsd: 175 },
      { name: 'Hub USB-C Thunderbolt 4', category: 'Accesorios', basePriceUsd: 85 },
    ],
  },
  en_US: {
    countryName: 'United States',
    cities: [
      'San Francisco',
      'Austin',
      'New York',
      'Seattle',
      'Miami',
      'Denver',
      'Boston',
      'Chicago',
    ],
    phonePrefix: '+1 ',
    priceMultiplier: 1, // USD
    ecomProducts: [
      { name: 'Keychron K2 Pro Mechanical Keyboard', category: 'Peripherals', basePriceUsd: 95 },
      { name: 'LG 34" UltraWide WQHD Monitor', category: 'Monitors', basePriceUsd: 420 },
      { name: 'Autonomous ErgoChair Pro', category: 'Office', basePriceUsd: 260 },
      { name: 'Sony WH-1000XM5 Headphones', category: 'Audio', basePriceUsd: 340 },
      { name: 'Samsung 990 Pro 2TB NVMe SSD', category: 'Storage', basePriceUsd: 175 },
      { name: 'CalDigit TS4 Thunderbolt 4 Dock', category: 'Accessories', basePriceUsd: 85 },
    ],
  },
  es_ES: {
    countryName: 'España',
    cities: [
      'Madrid',
      'Barcelona',
      'Valencia',
      'Sevilla',
      'Bilbao',
      'Málaga',
      'Zaragoza',
    ],
    phonePrefix: '+34 6',
    priceMultiplier: 0.92, // EUR
    ecomProducts: [
      { name: 'Teclado Mecánico Keychron K2 Pro', category: 'Periféricos', basePriceUsd: 95 },
      { name: 'Monitor UltraWide LG 34" WQHD', category: 'Monitores', basePriceUsd: 420 },
      { name: 'Silla Ergonómica Mesh Pro', category: 'Oficina', basePriceUsd: 260 },
      { name: 'Auriculares Sony WH-1000XM5', category: 'Audio', basePriceUsd: 340 },
      { name: 'SSD NVMe Samsung 990 Pro 2TB', category: 'Almacenamiento', basePriceUsd: 175 },
    ],
  },
};

function createLocalizedFaker(locale: SupportedLocale, seed?: number): Faker {
  const localeChain =
    locale === 'en_US'
      ? [en_US, en]
      : locale === 'es_ES'
        ? [es, en]
        : [es_MX, es, en];

  const fakerInstance = new Faker({ locale: localeChain });
  if (typeof seed === 'number' && !Number.isNaN(seed)) {
    fakerInstance.seed(seed);
  }
  return fakerInstance;
}

/**
 * Infiere la categoría semántica de una columna combinando su nombre,
 * su tipo de dato SQL y el contexto de la tabla.
 */
export function inferSemanticCategory(
  table: ParsedTable,
  col: ParsedColumn,
  aiHints?: AISemanticColumnHint[]
): SemanticCategory {
  const hint = aiHints?.find(
    (h) =>
      h.tableName.toLowerCase() === table.name.toLowerCase() &&
      h.columnName.toLowerCase() === col.name.toLowerCase()
  );
  if (hint) return hint.category;

  const name = col.name.toLowerCase();
  const type = col.dataType.toUpperCase();

  if (type === 'UUID' || (col.isPrimaryKey && name.includes('uuid'))) return 'id_uuid';
  if (col.isPrimaryKey || col.isAutoIncrement || name === 'id') return 'id_serial';

  if (name.includes('email') || name.includes('correo')) return 'email';
  if (name === 'full_name' || name === 'nombre_completo' || (name === 'name' && table.name.includes('user')))
    return 'full_name';
  if (name.includes('first_name') || name === 'nombre') return 'first_name';
  if (name.includes('last_name') || name === 'apellido') return 'last_name';
  if (name.includes('phone') || name.includes('telefono') || name.includes('celular')) return 'phone';
  if (name.includes('document') || name.includes('cedula') || name.includes('dni') || name.includes('nit'))
    return 'document_id';
  if (name.includes('city') || name.includes('ciudad')) return 'city';
  if (name.includes('state') || name.includes('departamento') || name.includes('provincia')) return 'state';
  if (name.includes('country') || name.includes('pais')) return 'country';
  if (name.includes('address') || name.includes('direccion')) return 'address';
  if (name.includes('zip') || name.includes('postal')) return 'postal_code';
  if (name.includes('company') || name.includes('empresa')) return 'company_name';
  if (name === 'sku' || name.includes('codigo')) return 'sku';
  if (
    (name === 'name' || name === 'title' || name.includes('product')) &&
    (table.name.includes('product') || table.name.includes('item'))
  )
    return 'product_name';
  if (name.includes('category') || name.includes('categoria')) return 'product_category';
  if (
    name.includes('price') ||
    name.includes('amount') ||
    name.includes('total') ||
    name.includes('cost') ||
    name.includes('precio')
  )
    return 'price';
  if (name.includes('stock') || name.includes('quantity') || name.includes('qty') || name.includes('cantidad'))
    return 'quantity';
  if (name.includes('status') || name.includes('estado')) return 'status';
  if (name.includes('url') || name.includes('avatar') || name.includes('website')) return 'url';

  if (type === 'BOOLEAN' || type === 'BOOL' || name.startsWith('is_') || name.startsWith('has_'))
    return 'boolean';
  if (type.includes('TIMESTAMP') || name.endsWith('_at')) return 'timestamp';
  if (type === 'DATE' || name.includes('date') || name.includes('fecha')) return 'date';
  if (type === 'NUMERIC' || type === 'DECIMAL' || type === 'FLOAT' || type === 'DOUBLE' || type === 'REAL')
    return 'float';
  if (type.includes('INT') || type === 'SERIAL' || type === 'BIGSERIAL') return 'integer';
  if (type === 'TEXT' || name.includes('description') || name.includes('bio') || name.includes('notes'))
    return 'text_description';

  return 'generic_string';
}

/**
 * Escapa un valor JS para producir un literal SQL válido en PostgreSQL.
 */
function formatSqlValue(val: string | number | boolean | null): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'boolean') return val ? ' TRUE' : 'FALSE';
  const escaped = String(val).replace(/'/g, "''");
  return `'${escaped}'`;
}

/**
 * Genera sentencias INSERT INTO en orden topológico listas para ejecutar en PostgreSQL.
 */
export function exportToSql(
  tables: ParsedTable[],
  data: Record<string, TableRows>,
  locale: SupportedLocale
): string {
  const lines: string[] = [
    `-- =====================================================================`,
    `-- Generado por SeedForge | Staging & Synthetic Data Engine`,
    `-- Localización: ${locale} | Fecha: ${new Date().toISOString()}`,
    `-- Orden de inserción topológico verificado (Integridad Referencial FK)`,
    `-- =====================================================================`,
    ``,
    `BEGIN;`,
    ``,
  ];

  for (const table of tables) {
    const rows = data[table.name] ?? [];
    if (rows.length === 0) continue;

    const colNames = table.columns.map((c) => c.name);
    lines.push(`-- Tabla: ${table.name} (${rows.length} registros)`);

    for (const row of rows) {
      const valuesList = colNames.map((col) => formatSqlValue(row[col] ?? null).trim());
      lines.push(
        `INSERT INTO "${table.name}" (${colNames.map((c) => `"${c}"`).join(', ')}) VALUES (${valuesList.join(', ')});`
      );
    }
    lines.push(``);
  }

  lines.push(`COMMIT;`);
  return lines.join('\n');
}

/**
 * Genera el conjunto de datos sintéticos respetando el orden topológico y las llaves foráneas.
 */
export function generateSyntheticDataset(
  config: GenerationConfig,
  aiHints?: AISemanticColumnHint[]
): GenerationResult {
  const startTime = performance.now();
  const parsedSchema = parsePostgresSchema(config.sql);
  const faker = createLocalizedFaker(config.locale, config.seed);
  const preset = REGIONAL_PRESETS[config.locale];

  const data: Record<string, TableRows> = {};
  let totalRows = 0;
  let totalForeignKeys = 0;

  // Recorremos las tablas en el orden topológico calculado (padres antes que hijos)
  for (const table of parsedSchema.tables) {
    totalForeignKeys += table.foreignKeys.length;
    const tableRows: TableRows = [];

    for (let rowIndex = 0; rowIndex < config.rowsPerTable; rowIndex++) {
      const row: Record<string, string | number | boolean | null> = {};
      const productTemplate =
        preset.ecomProducts[rowIndex % preset.ecomProducts.length];

      for (const col of table.columns) {
        // 1. INTEGRIDAD REFERENCIAL: Si la columna es llave foránea, tomamos un valor real de la tabla padre
        if (col.foreignKey) {
          const parentTableName = col.foreignKey.table;
          const parentColName = col.foreignKey.column;

          // Caso auto-referencia (parent === table.name)
          const candidatePool =
            parentTableName === table.name ? tableRows : data[parentTableName];

          if (candidatePool && candidatePool.length > 0) {
            const chosenParentRow = faker.helpers.arrayElement(candidatePool);
            const fkValue = chosenParentRow[parentColName];
            if (fkValue !== undefined) {
              row[col.name] = fkValue;
              continue;
            }
          } else if (col.isNullable) {
            row[col.name] = null;
            continue;
          }
        }

        // 2. Generación Semántica / Contextual
        const category = inferSemanticCategory(table, col, aiHints);
        const hint = aiHints?.find(
          (h) =>
            h.tableName.toLowerCase() === table.name.toLowerCase() &&
            h.columnName.toLowerCase() === col.name.toLowerCase()
        );

        if (hint?.sampleValues && hint.sampleValues.length > 0 && !col.isPrimaryKey) {
          row[col.name] = faker.helpers.arrayElement(hint.sampleValues);
          continue;
        }

        switch (category) {
          case 'id_serial':
            row[col.name] = rowIndex + 1;
            break;

          case 'id_uuid':
            row[col.name] = faker.string.uuid();
            break;

          case 'full_name':
            row[col.name] = faker.person.fullName();
            break;

          case 'first_name':
            row[col.name] = faker.person.firstName();
            break;

          case 'last_name':
            row[col.name] = faker.person.lastName();
            break;

          case 'email': {
            const baseName =
              typeof row['full_name'] === 'string'
                ? row['full_name']
                : faker.person.fullName();
            const slug = baseName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '.')
              .replace(/^\.|\.$/g, '');
            const domain =
              config.locale === 'es_CO'
                ? faker.helpers.arrayElement(['empresa.co', 'devmail.co', 'gmail.com'])
                : config.locale === 'es_MX'
                  ? faker.helpers.arrayElement(['correo.mx', 'tech.mx', 'gmail.com'])
                  : faker.helpers.arrayElement(['acme.io', 'vercel.app', 'gmail.com']);
            row[col.name] = `${slug}.${rowIndex + 1}@${domain}`;
            break;
          }

          case 'phone':
            if (config.locale === 'es_CO') {
              row[col.name] = `+57 3${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(4)}`;
            } else if (config.locale === 'es_MX') {
              row[col.name] = `+52 55 ${faker.string.numeric(4)} ${faker.string.numeric(4)}`;
            } else if (config.locale === 'es_ES') {
              row[col.name] = `+34 6${faker.string.numeric(2)} ${faker.string.numeric(3)} ${faker.string.numeric(3)}`;
            } else {
              row[col.name] = `+1 (${faker.string.numeric(3)}) ${faker.string.numeric(3)}-${faker.string.numeric(4)}`;
            }
            break;

          case 'document_id':
            if (config.locale === 'es_CO') {
              row[col.name] = `CC-${faker.number.int({ min: 1010000000, max: 1199999999 })}`;
            } else if (config.locale === 'es_MX') {
              row[col.name] = faker.string.alphanumeric({ length: 13, casing: 'upper' });
            } else {
              row[col.name] = `ID-${faker.string.numeric(9)}`;
            }
            break;

          case 'city':
            row[col.name] = faker.helpers.arrayElement(preset.cities);
            break;

          case 'state':
            row[col.name] = faker.location.state();
            break;

          case 'country':
            row[col.name] = preset.countryName;
            break;

          case 'address':
            if (config.locale === 'es_CO') {
              const via = faker.helpers.arrayElement(['Calle', 'Carrera', 'Avenida', 'Diagonal']);
              const num1 = faker.number.int({ min: 10, max: 170 });
              const num2 = faker.number.int({ min: 1, max: 99 });
              const num3 = faker.number.int({ min: 1, max: 80 });
              const city = faker.helpers.arrayElement(preset.cities);
              row[col.name] = `${via} ${num1} # ${num2}-${num3}, ${city}`;
            } else {
              row[col.name] = `${faker.location.streetAddress()}, ${faker.helpers.arrayElement(preset.cities)}`;
            }
            break;

          case 'postal_code':
            row[col.name] = faker.location.zipCode();
            break;

          case 'company_name':
            row[col.name] = faker.company.name();
            break;

          case 'sku':
            row[col.name] = `SKU-${faker.string.alpha({ length: 3, casing: 'upper' })}-${String(rowIndex + 101).padStart(4, '0')}`;
            break;

          case 'product_name':
            row[col.name] =
              rowIndex < preset.ecomProducts.length
                ? productTemplate.name
                : `${productTemplate.name} v${rowIndex + 1}`;
            break;

          case 'product_category':
            row[col.name] = productTemplate.category;
            break;

          case 'price': {
            // Si estamos en una tabla como orders y ya existe product_id + quantity, calculamos el total real
            const productId = row['product_id'];
            const quantity = typeof row['quantity'] === 'number' ? row['quantity'] : 1;
            const productsData = data['products'];

            if (productId && productsData) {
              const matchedProduct = productsData.find((p) => p.id === productId);
              if (matchedProduct && typeof matchedProduct.price === 'number') {
                row[col.name] = Number((matchedProduct.price * quantity).toFixed(2));
                break;
              }
            }

            const baseUsd =
              table.name.includes('product')
                ? productTemplate.basePriceUsd
                : faker.number.float({ min: 25, max: 450, fractionDigits: 2 });
            const localizedPrice = baseUsd * preset.priceMultiplier;
            row[col.name] =
              config.locale === 'es_CO'
                ? Math.round(localizedPrice / 100) * 100
                : Number(localizedPrice.toFixed(2));
            break;
          }

          case 'quantity':
            row[col.name] = col.name.includes('stock')
              ? faker.number.int({ min: 15, max: 250 })
              : faker.number.int({ min: 1, max: 5 });
            break;

          case 'status':
            row[col.name] = faker.helpers.arrayElement([
              'PAID',
              'SHIPPED',
              'DELIVERED',
              'PROCESSING',
              'PENDING',
            ]);
            break;

          case 'url':
            row[col.name] = faker.internet.url();
            break;

          case 'boolean':
            row[col.name] = faker.datatype.boolean({ probability: 0.85 });
            break;

          case 'timestamp':
            row[col.name] = faker.date
              .recent({ days: 45 })
              .toISOString();
            break;

          case 'date':
            row[col.name] = faker.date
              .recent({ days: 90 })
              .toISOString()
              .split('T')[0];
            break;

          case 'text_description':
            row[col.name] = faker.commerce.productDescription();
            break;

          case 'float':
            row[col.name] = faker.number.float({ min: 10, max: 1000, fractionDigits: 2 });
            break;

          case 'integer':
            row[col.name] = faker.number.int({ min: 1, max: 100 });
            break;

          default:
            row[col.name] = faker.commerce.productMaterial();
            break;
        }
      }

      // Post-procesamiento: Si una orden tiene quantity generada después de total_amount, recalcular
      if (
        table.name === 'orders' &&
        row['product_id'] &&
        typeof row['quantity'] === 'number' &&
        row['total_amount'] !== undefined &&
        data['products']
      ) {
        const matchedProduct = data['products'].find((p) => p.id === row['product_id']);
        if (matchedProduct && typeof matchedProduct.price === 'number') {
          row['total_amount'] = Number(
            (matchedProduct.price * (row['quantity'] as number)).toFixed(2)
          );
        }
      }

      tableRows.push(row);
      totalRows++;
    }

    data[table.name] = tableRows;
  }

  const sqlOutput = exportToSql(parsedSchema.tables, data, config.locale);
  const jsonOutput = JSON.stringify(data, null, 2);
  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    schema: parsedSchema,
    data,
    sqlOutput,
    jsonOutput,
    stats: {
      totalTables: parsedSchema.tables.length,
      totalRows,
      totalForeignKeys,
      executionTimeMs,
      aiEnriched: Boolean(aiHints && aiHints.length > 0),
    },
  };
}
