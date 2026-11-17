export const ECOMMERCE_SAMPLE_SQL = `-- Esquema E-Commerce PostgreSQL (SeedForge Demo)
-- Incluye relaciones Foreign Key: orders -> users y orders -> products

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(40),
  document_id VARCHAR(30) UNIQUE,
  city VARCHAR(80) NOT NULL,
  country VARCHAR(60) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(40) UNIQUE NOT NULL,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  stock INT NOT NULL DEFAULT 100,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1,
  total_amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PAID',
  shipping_address VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`;

export const LOCALE_OPTIONS = [
  {
    value: 'es_CO' as const,
    label: 'Colombia (es_CO)',
    flag: '🇨🇴',
    currency: 'COP',
    description: 'Nombres, ciudades (Bogotá, Medellín, Cali), teléfonos +57 y precios en COP',
  },
  {
    value: 'es_MX' as const,
    label: 'México (es_MX)',
    flag: '🇲🇽',
    currency: 'MXN',
    description: 'Datos regionales de México (CDMX, Monterrey, Guadalajara), +52 y MXN',
  },
  {
    value: 'en_US' as const,
    label: 'Estados Unidos (en_US)',
    flag: '🇺🇸',
    currency: 'USD',
    description: 'Nombres, direcciones, estados de EE. UU., +1 y precios en USD',
  },
  {
    value: 'es_ES' as const,
    label: 'España (es_ES)',
    flag: '🇪🇸',
    currency: 'EUR',
    description: 'Nombres, provincias de España (Madrid, Barcelona, Valencia), +34 y EUR',
  },
];
