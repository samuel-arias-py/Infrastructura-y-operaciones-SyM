import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSyntheticDataset } from '@/lib/data-generator';
import { parsePostgresSchema } from '@/lib/sql-parser';
import {
  AISemanticColumnHint,
  ParsedTable,
  SupportedLocale,
} from '@/types/schema';

/**
 * Esquema Zod para validar el payload de entrada del endpoint.
 */
const GenerateRequestSchema = z.object({
  sql: z.string().min(10, 'El esquema SQL es demasiado corto.'),
  locale: z.enum(['es_CO', 'es_MX', 'en_US', 'es_ES']).default('es_CO'),
  rowsPerTable: z.number().int().min(1).max(500).default(15),
  seed: z.number().int().optional(),
  useAiEnrichment: z.boolean().optional().default(false),
});

/**
 * Esquema Zod preparado para Structured Outputs de IA (OpenAI response_format / Gemini responseSchema).
 * Permite que un LLM analice nombres de tablas y columnas ambiguas y devuelva
 * categorías semánticas y ejemplos realistas estrictamente tipados.
 */
export const AIStructuredOutputSchema = z.object({
  hints: z.array(
    z.object({
      tableName: z.string(),
      columnName: z.string(),
      category: z.enum([
        'id_serial',
        'id_uuid',
        'full_name',
        'first_name',
        'last_name',
        'email',
        'phone',
        'document_id',
        'city',
        'state',
        'country',
        'address',
        'postal_code',
        'company_name',
        'product_name',
        'product_category',
        'sku',
        'price',
        'quantity',
        'status',
        'url',
        'boolean',
        'timestamp',
        'date',
        'text_description',
        'integer',
        'float',
        'generic_string',
      ]),
      sampleValues: z.array(z.union([z.string(), z.number()])).optional(),
      minNumber: z.number().optional(),
      maxNumber: z.number().optional(),
    })
  ),
});

/**
 * Capa de enriquecimiento semántico con IA (Structured Outputs).
 * Si existe OPENAI_API_KEY configurada, consulta al modelo con JSON Schema estricto;
 * de lo contrario, aplica inferencia contextual heurística de respaldo sin bloquear el MVP.
 */
async function resolveAiSemanticHints(
  tables: ParsedTable[],
  locale: SupportedLocale
): Promise<AISemanticColumnHint[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback determinístico enriquecido cuando no hay API Key configurada
    const contextualHints: AISemanticColumnHint[] = [];
    for (const table of tables) {
      for (const col of table.columns) {
        if (col.name === 'status' && table.name.includes('order')) {
          contextualHints.push({
            tableName: table.name,
            columnName: col.name,
            category: 'status',
            sampleValues:
              locale === 'en_US'
                ? ['PAID', 'SHIPPED', 'DELIVERED', 'PROCESSING']
                : ['PAGADO', 'EN_CAMINO', 'ENTREGADO', 'PROCESANDO'],
          });
        }
      }
    }
    return contextualHints;
  }

  try {
    const schemaSummary = tables.map((t) => ({
      table: t.name,
      columns: t.columns.map((c) => ({ name: c.name, type: c.rawType })),
    }));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a database architect generating realistic synthetic staging data for locale ${locale}. Classify each column into the closest semantic category and provide 4 realistic sampleValues when domain-specific.`,
          },
          {
            role: 'user',
            content: JSON.stringify(schemaSummary),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return [];
    const json = await response.json();
    const parsed = AIStructuredOutputSchema.safeParse(
      JSON.parse(json.choices?.[0]?.message?.content ?? '{}')
    );
    return parsed.success ? parsed.data.hints : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedReq = GenerateRequestSchema.safeParse(body);

    if (!parsedReq.success) {
      return NextResponse.json(
        {
          error: 'Parámetros de generación inválidos.',
          details: parsedReq.error.flatten(),
        },
        { status: 400 }
      );
    }

    const config = parsedReq.data;
    let aiHints: AISemanticColumnHint[] | undefined;

    if (config.useAiEnrichment) {
      const schemaPreview = parsePostgresSchema(config.sql);
      aiHints = await resolveAiSemanticHints(schemaPreview.tables, config.locale);
    }

    const result = generateSyntheticDataset(config, aiHints);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error interno procesando el esquema SQL.';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
