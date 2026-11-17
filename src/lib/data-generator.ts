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
import { getLocaleDefinition } from './locales';

/**
 * Función pseudo-aleatoria con semilla (Mulberry32) para variaciones determinísticas
 */
function createPrng(seed: number) {
  let s = Math.floor(seed);
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

  if (col.isPrimaryKey) {
    if (type.includes('INT') || type.includes('SERIAL')) return 'id_serial';
    if (type.includes('UUID') || type.includes('CHAR') || type.includes('TEXT'))
      return 'id_uuid';
  }

  if (name.includes('uuid') || name.endsWith('_guid')) return 'id_uuid';
  if (name === 'full_name' || name === 'nombre_completo') return 'full_name';
  if (name === 'first_name' || name === 'nombres' || name === 'nombre')
    return 'first_name';
  if (name === 'last_name' || name === 'apellidos' || name === 'apellido')
    return 'last_name';
  if (name.includes('email') || name.includes('correo')) return 'email';
  if (name.includes('phone') || name.includes('telefono') || name.includes('celular') || name.includes('movil'))
    return 'phone';
  if (
    name.includes('document') ||
    name.includes('cedula') ||
    name.includes('identidad') ||
    name.includes('curp') ||
    name.includes('rfc') ||
    name.includes('dni') ||
    name.includes('nit') ||
    name.includes('tax_id') ||
    name.includes('rut')
  )
    return 'document_id';
  if (name.includes('city') || name.includes('ciudad') || name.includes('municipio')) return 'city';
  if (name.includes('state') || name.includes('departamento') || name.includes('provincia') || name.includes('estado'))
    return 'state';
  if (name.includes('country') || name.includes('pais')) return 'country';
  if (name.includes('address') || name.includes('direccion') || name.includes('domicilio')) return 'address';
  if (name.includes('zip') || name.includes('postal')) return 'postal_code';
  if (name.includes('company') || name.includes('empresa') || name.includes('business')) return 'company_name';
  if (name === 'sku' || name.includes('codigo')) return 'sku';
  if (
    (name === 'name' || name === 'title' || name.includes('product') || name.includes('articulo') || name.includes('item')) &&
    (table.name.includes('product') || table.name.includes('item') || table.name.includes('articulo') || table.name.includes('servicio'))
  )
    return 'product_name';
  if (name.includes('category') || name.includes('categoria')) return 'product_category';
  if (
    name.includes('price') ||
    name.includes('amount') ||
    name.includes('total') ||
    name.includes('cost') ||
    name.includes('precio') ||
    name.includes('valor') ||
    name.includes('subtotal')
  )
    return 'price';
  if (name.includes('stock') || name.includes('quantity') || name.includes('qty') || name.includes('cantidad'))
    return 'quantity';
  if (name.includes('status') || name.includes('estado')) return 'status';
  if (name.includes('url') || name.includes('avatar') || name.includes('website')) return 'url';

  if (type === 'BOOLEAN' || type === 'BOOL' || name.startsWith('is_') || name.startsWith('has_'))
    return 'boolean';
  if (type.includes('TIMESTAMP') || name.endsWith('_at') || name.endsWith('_time')) return 'timestamp';
  if (type === 'DATE' || name.includes('date') || name.includes('fecha')) return 'date';
  if (type === 'NUMERIC' || type === 'DECIMAL' || type === 'FLOAT' || type === 'DOUBLE' || type === 'REAL')
    return 'float';
  if (type.includes('INT') || type === 'SERIAL' || type === 'BIGSERIAL') return 'integer';
  if (type === 'TEXT' || name.includes('description') || name.includes('bio') || name.includes('notes') || name.includes('detalle'))
    return 'text_description';

  return 'generic_string';
}

/**
 * Escapa un valor JS para producir un literal SQL válido en PostgreSQL.
 */
function formatSqlValue(val: string | number | boolean | null): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
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
    `-- Generado por SeedForge | Motor Híbrido Semilla + Determinístico`,
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
 * Aplica variaciones controladas a partir de una fila semilla del LLM
 */
function varySeedValue(
  seedVal: string | number | boolean | null,
  col: ParsedColumn,
  category: SemanticCategory,
  rowIndex: number,
  loc: ReturnType<typeof getLocaleDefinition>,
  prng: () => number,
  faker: Faker
): string | number | boolean | null {
  if (seedVal === null || seedVal === undefined) return null;

  // 1. Numéricos y Precios
  if (typeof seedVal === 'number') {
    if (category === 'price') {
      // Variar el precio en un +/- 15% para que siga siendo coherente con el tipo de producto
      const variationFactor = 0.85 + prng() * 0.3; // 0.85 a 1.15
      const variedPrice = seedVal * variationFactor;
      return loc.currency.roundPrice(variedPrice);
    }
    if (category === 'quantity') {
      const delta = Math.floor(prng() * 5) - 2;
      return Math.max(1, seedVal + delta);
    }
    if (col.isPrimaryKey || category === 'id_serial') {
      return rowIndex + 1;
    }
    // Números enteros o floats genéricos
    const delta = Math.floor(prng() * 10) - 5;
    return typeof seedVal === 'number' && Number.isInteger(seedVal)
      ? Math.max(0, seedVal + delta)
      : Number((seedVal * (0.9 + prng() * 0.2)).toFixed(2));
  }

  // 2. Booleanos
  if (typeof seedVal === 'boolean') {
    return prng() > 0.2;
  }

  // 3. Cadenas de texto
  if (typeof seedVal === 'string') {
    // Si la semilla es un producto o título, agregar sufijos de variación
    if (category === 'product_name') {
      const seedIndex = Math.floor(rowIndex / 10);
      if (seedIndex === 0) return seedVal; // Las primeras 10 son idénticas a las semillas

      const variations = [
        'Pro Edition', 'Plus', 'Ultra', 'Max', 'v2', 'Lite', 'Slim',
        'Edición Especial', 'Gen 2', 'Air', 'Compact', 'Titanium'
      ];
      const colors = ['Negro', 'Plata', 'Gris Espacial', 'Blanco', 'Azul Marino'];
      const suffix = variations[rowIndex % variations.length];
      const color = colors[rowIndex % colors.length];

      return rowIndex % 2 === 0
        ? `${seedVal} ${suffix}`
        : `${seedVal} (${color})`;
    }

    if (category === 'product_category') {
      return seedVal;
    }

    if (category === 'status') {
      return seedVal;
    }

    if (category === 'full_name' || category === 'first_name') {
      const fn = faker.helpers.arrayElement(loc.person.firstNames);
      const ln1 = faker.helpers.arrayElement(loc.person.lastNames);
      const ln2 = faker.helpers.arrayElement(loc.person.lastNames);
      return category === 'first_name' ? fn : `${fn} ${ln1} ${ln2}`;
    }

    if (category === 'last_name') {
      return `${faker.helpers.arrayElement(loc.person.lastNames)} ${faker.helpers.arrayElement(loc.person.lastNames)}`;
    }

    if (category === 'document_id') {
      return loc.identity.generateDocument(prng);
    }

    if (category === 'phone') {
      return loc.phone.formatPhone(prng);
    }

    if (category === 'address') {
      return loc.address.formatAddress(prng);
    }

    if (category === 'city') {
      return faker.helpers.arrayElement(loc.address.cities);
    }

    if (category === 'state' && loc.address.states) {
      return faker.helpers.arrayElement(loc.address.states);
    }

    if (category === 'country') {
      return loc.country;
    }

    if (category === 'company_name') {
      return faker.helpers.arrayElement(loc.companies);
    }

    if (category === 'email') {
      const fn = faker.helpers.arrayElement(loc.person.firstNames).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const ln = faker.helpers.arrayElement(loc.person.lastNames).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const domain = loc.code === 'es_CO' ? 'correo.com.co' : 'empresa.mx';
      return `${fn}.${ln}${rowIndex + 1}@${domain}`;
    }

    if (category === 'sku') {
      return `SKU-${String(rowIndex + 100).padStart(5, '0')}`;
    }

    // Si es un ID tipo UUID
    if (category === 'id_uuid') {
      return faker.string.uuid();
    }
  }

  return seedVal;
}

/**
 * Genera el conjunto de datos sintéticos combinando las semillas de IA con el motor determinístico localizado.
 */
export function generateSyntheticDataset(
  config: GenerationConfig,
  aiHints?: AISemanticColumnHint[]
): GenerationResult {
  const startTime = performance.now();
  const parsedSchema = parsePostgresSchema(config.sql);
  const faker = createLocalizedFaker(config.locale, config.seed);
  const loc = getLocaleDefinition(config.locale);
  const prng = createPrng(config.seed ?? 42);

  const data: Record<string, TableRows> = {};
  let totalRows = 0;
  let totalForeignKeys = 0;

  // Recorremos las tablas en el orden topológico calculado (padres antes que hijos)
  for (const table of parsedSchema.tables) {
    totalForeignKeys += table.foreignKeys.length;
    const tableRows: TableRows = [];

    // Verificamos si tenemos semillas de IA para esta tabla
    const tableSeedContext = config.aiSeedContext?.[table.name];
    const aiSeeds = tableSeedContext?.seeds ?? [];

    for (let rowIndex = 0; rowIndex < config.rowsPerTable; rowIndex++) {
      const row: Record<string, string | number | boolean | null> = {};

      // Si hay semillas de IA para esta tabla, usamos la semilla correspondiente como base
      const seedRow = aiSeeds.length > 0 ? aiSeeds[rowIndex % aiSeeds.length] : undefined;

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

        // 2. Si la columna es Primary Key
        if (col.isPrimaryKey) {
          if (col.dataType.toUpperCase().includes('UUID')) {
            row[col.name] = faker.string.uuid();
            continue;
          } else {
            row[col.name] = rowIndex + 1;
            continue;
          }
        }

        // 3. Si tenemos semilla para esta columna y no es PK
        const category = inferSemanticCategory(table, col, aiHints);

        if (seedRow && seedRow[col.name] !== undefined) {
          const baseSeedVal = seedRow[col.name];
          // Las primeras filas hasta aiSeeds.length (ej. 10) usan directamente los datos de la semilla
          if (rowIndex < aiSeeds.length) {
            row[col.name] = baseSeedVal;
          } else {
            // A partir de la fila 11 hasta 1000+, aplicamos variación rápida determinística y localizada
            row[col.name] = varySeedValue(baseSeedVal, col, category, rowIndex, loc, prng, faker);
          }
          continue;
        }

        // 4. Si no hay semilla de IA específica para la columna, generamos con el módulo de localización
        const hint = aiHints?.find(
          (h) =>
            h.tableName.toLowerCase() === table.name.toLowerCase() &&
            h.columnName.toLowerCase() === col.name.toLowerCase()
        );

        if (hint?.sampleValues && hint.sampleValues.length > 0) {
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

          case 'full_name': {
            const fn = faker.helpers.arrayElement(loc.person.firstNames);
            const ln1 = faker.helpers.arrayElement(loc.person.lastNames);
            const ln2 = faker.helpers.arrayElement(loc.person.lastNames);
            row[col.name] = `${fn} ${ln1} ${ln2}`;
            break;
          }

          case 'first_name':
            row[col.name] = faker.helpers.arrayElement(loc.person.firstNames);
            break;

          case 'last_name':
            row[col.name] = faker.helpers.arrayElement(loc.person.lastNames);
            break;

          case 'email': {
            const baseName =
              typeof row['full_name'] === 'string'
                ? row['full_name']
                : faker.helpers.arrayElement(loc.person.firstNames);
            const slug = baseName
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '.')
              .replace(/^\.|\.$/g, '');
            const domain = loc.code === 'es_CO' ? 'correo.com.co' : 'empresa.mx';
            row[col.name] = `${slug}.${rowIndex + 1}@${domain}`;
            break;
          }

          case 'phone':
            row[col.name] = loc.phone.formatPhone(prng);
            break;

          case 'document_id':
            row[col.name] = loc.identity.generateDocument(prng);
            break;

          case 'city':
            row[col.name] = faker.helpers.arrayElement(loc.address.cities);
            break;

          case 'state':
            row[col.name] = loc.address.states
              ? faker.helpers.arrayElement(loc.address.states)
              : faker.location.state();
            break;

          case 'country':
            row[col.name] = loc.country;
            break;

          case 'address':
            row[col.name] = loc.address.formatAddress(prng);
            break;

          case 'postal_code':
            row[col.name] = loc.code === 'es_CO'
              ? String(Math.floor(prng() * 900000) + 100000)
              : String(Math.floor(prng() * 90000) + 10000);
            break;

          case 'company_name':
            row[col.name] = faker.helpers.arrayElement(loc.companies);
            break;

          case 'sku':
            row[col.name] = `SKU-${faker.string.alpha({ length: 3, casing: 'upper' })}-${String(rowIndex + 101).padStart(4, '0')}`;
            break;

          case 'product_name': {
            const techCatalog = [
              'Laptop Ultrabook Pro 14"',
              'Monitor Curvo 27" 165Hz IPS',
              'Teclado Mecánico Inalámbrico RGB',
              'Mouse Ergonómico Óptico 16000 DPI',
              'Silla Ergonómica Pro Soporte Lumbar',
              'Audífonos Bluetooth Cancelación Ruido',
              'SSD NVMe Gen4 1TB Lectura 7000MB/s',
              'Hub USB-C 8 en 1 HDMI 4K',
              'Cámara Web Full HD con Micrófono Estéreo',
              'Escritorio Elevable Eléctrico Standing Desk'
            ];
            const baseItem = techCatalog[rowIndex % techCatalog.length];
            row[col.name] = rowIndex < 10 ? baseItem : `${baseItem} v${Math.floor(rowIndex / 10) + 1}`;
            break;
          }

          case 'product_category': {
            const categories = ['Hardware', 'Periféricos', 'Monitores', 'Audio', 'Oficina', 'Almacenamiento'];
            row[col.name] = categories[rowIndex % categories.length];
            break;
          }

          case 'price': {
            // Si estamos en una tabla como orders/order_items y ya existe product_id + quantity, calculamos el total real
            const productId = row['product_id'];
            const quantity = typeof row['quantity'] === 'number' ? row['quantity'] : 1;
            const productsData = data['products'] || data['articulos'] || data['items'];

            if (productId && productsData) {
              const matchedProduct = productsData.find((p) => p.id === productId);
              if (matchedProduct && typeof matchedProduct.price === 'number') {
                const total = matchedProduct.price * quantity;
                row[col.name] = loc.currency.roundPrice(total);
                break;
              }
            }

            const rawPrice =
              loc.currency.defaultPriceRange.min +
              prng() * (loc.currency.defaultPriceRange.max - loc.currency.defaultPriceRange.min);
            row[col.name] = loc.currency.roundPrice(rawPrice);
            break;
          }

          case 'quantity':
            row[col.name] = col.name.includes('stock')
              ? Math.floor(prng() * 200) + 10
              : Math.floor(prng() * 4) + 1;
            break;

          case 'status': {
            const statuses =
              config.locale === 'en_US'
                ? ['PAID', 'SHIPPED', 'DELIVERED', 'PROCESSING', 'PENDING']
                : ['PAGADO', 'EN_CAMINO', 'ENTREGADO', 'PROCESANDO', 'PENDIENTE'];
            row[col.name] = faker.helpers.arrayElement(statuses);
            break;
          }

          case 'url':
            row[col.name] = faker.internet.url();
            break;

          case 'boolean':
            row[col.name] = prng() > 0.15;
            break;

          case 'timestamp':
            row[col.name] = faker.date.recent({ days: 45 }).toISOString();
            break;

          case 'date':
            row[col.name] = faker.date.recent({ days: 90 }).toISOString().split('T')[0];
            break;

          case 'text_description':
            row[col.name] = `Descripción detallada de alta calidad para ${col.name} en contexto operativo de ${loc.country}.`;
            break;

          case 'float':
            row[col.name] = Number((10 + prng() * 990).toFixed(2));
            break;

          case 'integer':
            row[col.name] = Math.floor(prng() * 100) + 1;
            break;

          default:
            row[col.name] = `Val-${rowIndex + 1}`;
            break;
        }
      }

      // Post-procesamiento de coherencia de negocio (ej. order total = product.price * quantity)
      if (
        (table.name === 'orders' || table.name === 'order_items') &&
        row['product_id'] &&
        typeof row['quantity'] === 'number'
      ) {
        const productsData = data['products'] || data['items'];
        if (productsData) {
          const matchedProduct = productsData.find((p) => p.id === row['product_id']);
          if (matchedProduct && typeof matchedProduct.price === 'number') {
            const calculatedTotal = loc.currency.roundPrice(
              matchedProduct.price * (row['quantity'] as number)
            );
            if (row['total_amount'] !== undefined) row['total_amount'] = calculatedTotal;
            if (row['total'] !== undefined) row['total'] = calculatedTotal;
            if (row['subtotal'] !== undefined) row['subtotal'] = calculatedTotal;
          }
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
      aiEnriched: Boolean(
        (aiHints && aiHints.length > 0) ||
        (config.aiSeedContext && Object.keys(config.aiSeedContext).length > 0)
      ),
    },
  };
}
