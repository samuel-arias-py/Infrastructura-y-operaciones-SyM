import { LocaleDefinition } from './types';

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min: number, max: number, rand: () => number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export const coLocale: LocaleDefinition = {
  code: 'es_CO',
  name: 'Colombia (es_CO)',
  country: 'Colombia',

  person: {
    firstNames: [
      'Santiago', 'Mateo', 'Sebastián', 'Alejandro', 'Samuel', 'Nicolás', 'Daniel', 'Andrés',
      'Juan David', 'Juan Pablo', 'Carlos Andrés', 'Felipe', 'Camilo', 'Diego', 'Gabriel',
      'Valentina', 'Sofía', 'Isabella', 'Camila', 'Mariana', 'Daniela', 'Gabriela',
      'Laura', 'Paula', 'María José', 'Sara', 'Catalina', 'Luciana', 'Salomé', 'Natalia'
    ],
    lastNames: [
      'Rodríguez', 'González', 'Gómez', 'Fernández', 'López', 'Martínez', 'Pérez', 'García',
      'Sánchez', 'Ramírez', 'Torres', 'Díaz', 'Vargas', 'Castillo', 'Castro', 'Morales',
      'Rojas', 'Ortiz', 'Silva', 'Gutiérrez', 'Restrepo', 'Jaramillo', 'Ospina', 'Henao',
      'Montoya', 'Cárdenas', 'Giraldo', 'Zapata', 'Valencia', 'Bedoya'
    ]
  },

  identity: {
    documentName: 'Cédula de Ciudadanía (CC)',
    generateDocument: (rand = Math.random) => {
      // En Colombia, CC antiguas tienen 8 dígitos, modernas (post 2000) 10 dígitos (1.000.000.000 - 1.199.999.999)
      const use10Digits = rand() > 0.35;
      if (use10Digits) {
        return String(randInt(1000000000, 1199999999, rand));
      }
      return String(randInt(10000000, 99999999, rand));
    }
  },

  address: {
    cities: [
      'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
      'Bucaramanga', 'Pereira', 'Santa Marta', 'Manizales', 'Cúcuta',
      'Ibagué', 'Armenia', 'Villavicencio', 'Pasto', 'Montería'
    ],
    states: [
      'Cundinamarca', 'Antioquia', 'Valle del Cauca', 'Atlántico', 'Bolívar',
      'Santander', 'Risaralda', 'Magdalena', 'Caldas', 'Norte de Santander'
    ],
    streetTypes: ['Cra', 'Cl', 'Av', 'Diag', 'Transv', 'Auto'],
    streets: ['15', '7', '68', '100', '26', '30', '80', '127', '19', '53', '45', '72', '85'],
    neighborhoods: ['Chapinero', 'El Poblado', 'Usaquén', 'Laureles', 'Granada', 'El Prado', 'Cedritos', 'Chicó'],
    formatAddress: (rand = Math.random) => {
      const type = pick(['Cra', 'Cl', 'Av', 'Diag', 'Transv'], rand);
      const num1 = randInt(1, 170, rand);
      const letter = rand() > 0.6 ? pick(['A', 'B', 'C', 'Bis'], rand) + ' ' : '';
      const num2 = randInt(1, 140, rand);
      const num3 = randInt(1, 99, rand);
      const city = pick(coLocale.address.cities, rand);
      return `${type} ${num1}${letter ? ' ' + letter.trim() : ''} # ${num2}-${num3}, ${city}`;
    }
  },

  phone: {
    prefixes: ['+57 300', '+57 301', '+57 310', '+57 311', '+57 312', '+57 313', '+57 314', '+57 315', '+57 320', '+57 321', '+57 350'],
    formatPhone: (rand = Math.random) => {
      const prefix = pick(coLocale.phone.prefixes, rand);
      const p1 = String(randInt(100, 999, rand));
      const p2 = String(randInt(1000, 9999, rand));
      return `${prefix} ${p1} ${p2}`;
    }
  },

  currency: {
    code: 'COP',
    symbol: '$',
    // Precios en Colombia generalmente son múltiplos de 1.000 (redondeados a miles)
    roundPrice: (rawPrice: number) => {
      if (rawPrice <= 0) return 0;
      // Multiplo de 1000
      return Math.max(1000, Math.round(rawPrice / 1000) * 1000);
    },
    formatPrice: (amount: number) => {
      return `$ ${amount.toLocaleString('es-CO')} COP`;
    },
    defaultPriceRange: { min: 20000, max: 2500000 }
  },

  companies: [
    'Grupo Nutresa S.A.S.', 'Bancolombia S.A.', 'Ecopetrol S.A.', 'Almacenes Éxito S.A.',
    'Rappi Colombia S.A.S.', 'Carvajal S.A.', 'Corona Industrial S.A.S.', 'Postobón S.A.',
    'Avianca Group', 'Davivienda S.A.', 'Terpel S.A.', 'Cine Colombia S.A.S.'
  ]
};
