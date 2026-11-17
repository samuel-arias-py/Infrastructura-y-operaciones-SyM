import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getLocaleDefinition } from '@/lib/locales';

/**
 * Esquema de entrada para el endpoint /api/generate-context
 */
const TableDefinitionSchema = z.object({
  name: z.string(),
  columns: z.array(
    z.object({
      name: z.string(),
      type: z.string().optional(),
    })
  ),
});

const GenerateContextRequestSchema = z.object({
  tables: z.array(TableDefinitionSchema).min(1, 'Se requiere al menos una tabla.'),
  locale: z.enum(['es_CO', 'es_MX', 'en_US', 'es_ES']).default('es_CO'),
  domainHint: z.string().optional(),
});

/**
 * Esquema de respuesta estructurada (JSON Schema) para las 10 semillas por tabla
 */
const SeedContextOutputSchema = z.object({
  tables: z.array(
    z.object({
      tableName: z.string(),
      domain: z.string().describe('Dominio detectado del negocio (ej. ecommerce tecnológico, fintech, logística)'),
      seeds: z
        .array(
          z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
        )
        .length(10)
        .describe('Exactamente 10 filas semilla coherentes con el negocio y la región solicitada'),
    })
  ),
});

/**
 * Fallback determinístico cuando no hay API Key o falla el proveedor de IA.
 * Garantiza exactamente 10 semillas realistas de alta fidelidad según la región.
 */
function generateFallbackSeeds(
  tables: { name: string; columns: { name: string; type?: string }[] }[],
  localeCode: string
) {
  const loc = getLocaleDefinition(localeCode);
  const isCo = loc.code === 'es_CO';

  const defaultCatalog = [
    { name: 'Laptop Ultrabook Pro 14"', category: 'Laptops', price: isCo ? 3850000 : 18500 },
    { name: 'Monitor Curvo 27" 165Hz IPS', category: 'Monitores', price: isCo ? 1250000 : 6200 },
    { name: 'Teclado Mecánico Inalámbrico RGB', category: 'Periféricos', price: isCo ? 380000 : 1950 },
    { name: 'Mouse Ergonómico Óptico 16000 DPI', category: 'Periféricos', price: isCo ? 220000 : 1100 },
    { name: 'Silla Ergonómica Pro Soporte Lumbar', category: 'Oficina', price: isCo ? 890000 : 4500 },
    { name: 'Audífonos Bluetooth Cancelación Ruido', category: 'Audio', price: isCo ? 650000 : 3200 },
    { name: 'SSD NVMe Gen4 1TB Lectura 7000MB/s', category: 'Almacenamiento', price: isCo ? 490000 : 2400 },
    { name: 'Hub USB-C 8 en 1 HDMI 4K', category: 'Accesorios', price: isCo ? 190000 : 950 },
    { name: 'Cámara Web Full HD con Micrófono Estéreo', category: 'Streaming', price: isCo ? 280000 : 1400 },
    { name: 'Escritorio Elevable Eléctrico Standing Desk', category: 'Oficina', price: isCo ? 1750000 : 8800 },
  ];

  const defaultUsers = Array.from({ length: 10 }, (_, i) => {
    const fn = loc.person.firstNames[i % loc.person.firstNames.length];
    const ln = loc.person.lastNames[i % loc.person.lastNames.length];
    const fullName = `${fn} ${ln}`;
    const slug = `${fn}.${ln}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const doc = loc.identity.generateDocument(() => (i + 1) * 0.08);
    const phone = loc.phone.formatPhone(() => (i + 1) * 0.09);
    const addr = loc.address.formatAddress(() => (i + 1) * 0.07);
    const domain = isCo ? 'correo.com.co' : 'empresa.mx';

    return {
      id: i + 1,
      name: fullName,
      full_name: fullName,
      first_name: fn,
      last_name: ln,
      email: `${slug}${i + 1}@${domain}`,
      document_id: doc,
      national_id: doc,
      cedula: doc,
      rfc: doc,
      curp: doc,
      phone,
      address: addr,
      city: loc.address.cities[i % loc.address.cities.length],
    };
  });

  return tables.map((t) => {
    const tableName = t.name.toLowerCase();
    const seeds: Record<string, string | number | boolean | null>[] = [];

    for (let i = 0; i < 10; i++) {
      const row: Record<string, string | number | boolean | null> = {};

      for (const col of t.columns) {
        const cName = col.name.toLowerCase();

        if (cName === 'id') {
          row[col.name] = i + 1;
        } else if (tableName.includes('product') || tableName.includes('item')) {
          const item = defaultCatalog[i];
          if (cName.includes('name') || cName.includes('title') || cName === 'description') {
            row[col.name] = item.name;
          } else if (cName.includes('cat') || cName === 'type') {
            row[col.name] = item.category;
          } else if (cName.includes('price') || cName.includes('cost') || cName.includes('amount')) {
            row[col.name] = item.price;
          } else if (cName.includes('sku') || cName.includes('code')) {
            row[col.name] = `SKU-TECH-${String(100 + i).padStart(4, '0')}`;
          } else if (cName.includes('stock') || cName.includes('qty') || cName.includes('cant')) {
            row[col.name] = (i + 2) * 15;
          } else {
            row[col.name] = `Seed ${col.name} ${i + 1}`;
          }
        } else if (tableName.includes('user') || tableName.includes('client') || tableName.includes('customer') || tableName.includes('person')) {
          const u = defaultUsers[i];
          if (cName in u) {
            row[col.name] = (u as Record<string, string | number>)[cName];
          } else if (cName.includes('doc') || cName.includes('ident') || cName.includes('cedula') || cName.includes('curp') || cName.includes('rfc')) {
            row[col.name] = u.document_id;
          } else if (cName.includes('phone') || cName.includes('tel') || cName.includes('cel')) {
            row[col.name] = u.phone;
          } else if (cName.includes('addr') || cName.includes('dir')) {
            row[col.name] = u.address;
          } else if (cName.includes('city') || cName.includes('ciudad')) {
            row[col.name] = u.city;
          } else if (cName.includes('mail')) {
            row[col.name] = u.email;
          } else {
            row[col.name] = `Usuario ${i + 1}`;
          }
        } else if (tableName.includes('order') || tableName.includes('sale') || tableName.includes('factura')) {
          if (cName.includes('status') || cName.includes('estado')) {
            row[col.name] = ['ENTREGADO', 'PAGADO', 'EN_CAMINO', 'PROCESANDO'][i % 4];
          } else if (cName.includes('total') || cName.includes('amount')) {
            row[col.name] = isCo ? (i + 1) * 125000 : (i + 1) * 850;
          } else {
            row[col.name] = `Orden-REF-${1000 + i}`;
          }
        } else {
          row[col.name] = `Ejemplo ${col.name} ${i + 1}`;
        }
      }

      seeds.push(row);
    }

    return {
      tableName: t.name,
      domain: 'comercio y gestión operativa',
      seeds,
    };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedReq = GenerateContextRequestSchema.safeParse(body);

    if (!parsedReq.success) {
      return NextResponse.json(
        {
          error: 'Parámetros de contexto inválidos.',
          details: parsedReq.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { tables, locale, domainHint } = parsedReq.data;
    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

    // Si no hay API key disponible en variables de entorno, usamos el motor determinístico de alta fidelidad
    if (!apiKey) {
      const fallbackData = generateFallbackSeeds(tables, locale);
      return NextResponse.json(
        {
          source: 'deterministic-seed-engine',
          tables: fallbackData,
          message: 'Semillas contextuales generadas determinísticamente (sin consumo de tokens LLM externos).',
        },
        { status: 200 }
      );
    }

    // Si hay OpenAI API Key disponible, invocamos el modelo con Structured Outputs estricto (10 ejemplos semilla únicamente)
    if (process.env.OPENAI_API_KEY) {
      const prompt = `Eres un arquitecto de bases de datos y especialista en dominios de negocio.
Para cada tabla proporcionada, analiza el esquema y devuelve ÚNICAMENTE 10 ejemplos semilla ('seeds') realistas, coherentes con el dominio del negocio y la región ${locale}.
Por ejemplo, si la tabla es 'products', genera 10 productos reales con categorías y precios lógicos para la moneda local (${locale === 'es_CO' ? 'COP múltiplos de 1.000' : 'MXN'}).
Si es 'users' o clientes, genera nombres y datos realistas de ${locale}.
Es OBLIGATORIO que cada tabla tenga exactamente 10 filas semilla en el array 'seeds'.
Esquema de tablas: ${JSON.stringify(tables)}
${domainHint ? `Contexto o industria: ${domainHint}` : ''}`;

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Genera exactamente 10 ejemplos semilla altamente coherentes para cada tabla usando JSON Schema.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'seed_context_response',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  tables: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        tableName: { type: 'string' },
                        domain: { type: 'string' },
                        seeds: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: {
                              type: ['string', 'number', 'boolean', 'null'],
                            },
                          },
                        },
                      },
                      required: ['tableName', 'domain', 'seeds'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['tables'],
                additionalProperties: false,
              },
            },
          },
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.warn('OpenAI error, reverting to deterministic fallback:', errorText);
        const fallbackData = generateFallbackSeeds(tables, locale);
        return NextResponse.json(
          {
            source: 'deterministic-fallback',
            tables: fallbackData,
            warning: 'Fallo la llamada al LLM externo, se usó motor de respaldo determinístico.',
          },
          { status: 200 }
        );
      }

      const json = await openaiResponse.json();
      const content = json.choices?.[0]?.message?.content;
      const parsedOutput = JSON.parse(content ?? '{}');

      return NextResponse.json(
        {
          source: 'llm-structured-output',
          tables: parsedOutput.tables,
        },
        { status: 200 }
      );
    }

    // Fallback estándar
    const fallbackData = generateFallbackSeeds(tables, locale);
    return NextResponse.json(
      {
        source: 'deterministic-seed-engine',
        tables: fallbackData,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno en /api/generate-context';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
