import { LocaleDefinition } from './types';

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min: number, max: number, rand: () => number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export const mxLocale: LocaleDefinition = {
  code: 'es_MX',
  name: 'México (es_MX)',
  country: 'México',

  person: {
    firstNames: [
      'Santiago', 'Mateo', 'Sebastián', 'Leonardo', 'Matías', 'Emiliano', 'Diego', 'Daniel',
      'Alejandro', 'Jesús', 'Carlos', 'Miguel Ángel', 'Eduardo', 'Fernando', 'Rodrigo',
      'Sofía', 'Valentina', 'Regina', 'María José', 'Ximena', 'Camila', 'Renata',
      'Valeria', 'Natalia', 'Daniela', 'Fernanda', 'Guadalupe', 'Andrea', 'Mariana'
    ],
    lastNames: [
      'Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez',
      'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez',
      'Torres', 'Díaz', 'Gutiérrez', 'Mendoza', 'Aguilar', 'Ortiz', 'Castillo', 'Moreno'
    ]
  },

  identity: {
    documentName: 'RFC / CURP',
    generateDocument: (rand = Math.random) => {
      // 50% probabilidad de generar RFC (13 caracteres persona física) o CURP (18 caracteres)
      const letters = 'ABCDEFGHIJKLMNPQRSTUVWXYZ';
      const rfcCurpChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      
      const randLetters = (len: number) =>
        Array.from({ length: len }, () => letters[randInt(0, letters.length - 1, rand)]).join('');
      
      const randDigits = (len: number) =>
        Array.from({ length: len }, () => String(randInt(0, 9, rand))).join('');

      const randAlphaNum = (len: number) =>
        Array.from({ length: len }, () => rfcCurpChars[randInt(0, rfcCurpChars.length - 1, rand)]).join('');

      const isCurp = rand() > 0.5;

      if (isCurp) {
        // CURP: 4 letras + 6 digitos (AAMMDD) + 1 letra sexo (H/M) + 2 letras entidad + 3 letras consonantes + 1 digito/letra + 1 digito
        const prefix = randLetters(4);
        const yymmdd = `${String(randInt(70, 99, rand))}${String(randInt(1, 12, rand)).padStart(2, '0')}${String(randInt(1, 28, rand)).padStart(2, '0')}`;
        const sex = rand() > 0.5 ? 'H' : 'M';
        const stateCode = pick(['DF', 'JC', 'NL', 'MC', 'GT', 'PL', 'VZ', 'BC', 'CS', 'SN'], rand);
        const internal = randLetters(3);
        const homokey = randAlphaNum(2);
        return `${prefix}${yymmdd}${sex}${stateCode}${internal}${homokey}`;
      } else {
        // RFC Persona Física: 4 letras + 6 dígitos fecha + 3 caracteres homoclave
        const prefix = randLetters(4);
        const yymmdd = `${String(randInt(70, 99, rand))}${String(randInt(1, 12, rand)).padStart(2, '0')}${String(randInt(1, 28, rand)).padStart(2, '0')}`;
        const homoclave = randAlphaNum(3);
        return `${prefix}${yymmdd}${homoclave}`;
      }
    }
  },

  address: {
    cities: [
      'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Querétaro',
      'Mérida', 'Tijuana', 'León', 'Cancún', 'Toluca',
      'Aguascalientes', 'San Luis Potosí', 'Hermosillo', 'Chihuahua', 'Veracruz'
    ],
    states: [
      'CDMX', 'Jalisco', 'Nuevo León', 'Puebla', 'Querétaro',
      'Yucatán', 'Baja California', 'Guanajuato', 'Quintana Roo', 'Estado de México'
    ],
    streetTypes: ['Av.', 'Calle', 'Calz.', 'Blvd.', 'Paseo de', 'Cerrada'],
    streets: [
      'Insurgentes', 'Reforma', 'Benito Juárez', 'Hidalgo', 'Revolución',
      'Constitución', '5 de Mayo', 'Chapultepec', 'Cuauhtémoc', 'Universidad', 'Zaragoza'
    ],
    neighborhoods: ['Polanco', 'Roma Norte', 'Condesa', 'Del Valle', 'Santa Fe', 'San Pedro Garza García', 'Providencia', 'Americana'],
    formatAddress: (rand = Math.random) => {
      const type = pick(mxLocale.address.streetTypes, rand);
      const street = pick(mxLocale.address.streets, rand);
      const extNum = randInt(10, 4500, rand);
      const col = pick(mxLocale.address.neighborhoods || ['Centro'], rand);
      const city = pick(mxLocale.address.cities, rand);
      return `${type} ${street} #${extNum}, Col. ${col}, ${city}`;
    }
  },

  phone: {
    // Teléfonos con indicativo local (+52 55..., +52 81..., +52 33...)
    prefixes: [
      '+52 55', // CDMX
      '+52 81', // Monterrey
      '+52 33', // Guadalajara
      '+52 222', // Puebla
      '+52 442', // Querétaro
      '+52 999', // Mérida
      '+52 664'  // Tijuana
    ],
    formatPhone: (rand = Math.random) => {
      const prefix = pick(mxLocale.phone.prefixes, rand);
      const remainingDigits = prefix.length === 6 ? 8 : 7; // Lada 2 dígitos -> 8 digitos; Lada 3 digitos -> 7 digitos (Total 10 dígitos locales)
      if (remainingDigits === 8) {
        const p1 = String(randInt(1000, 9999, rand));
        const p2 = String(randInt(1000, 9999, rand));
        return `${prefix} ${p1} ${p2}`;
      } else {
        const p1 = String(randInt(100, 999, rand));
        const p2 = String(randInt(1000, 9999, rand));
        return `${prefix} ${p1} ${p2}`;
      }
    }
  },

  currency: {
    code: 'MXN',
    symbol: '$',
    // Precios en México coherentes con centavos o números redondos con terminación típica .00 ó .50 / .99
    roundPrice: (rawPrice: number) => {
      if (rawPrice <= 0) return 0;
      // Precios típicos en pesos mexicanos, ej. 149.00, 499.50, 1250.00
      return Math.round(rawPrice * 2) / 2;
    },
    formatPrice: (amount: number) => {
      return `$ ${amount.toFixed(2)} MXN`;
    },
    defaultPriceRange: { min: 99, max: 25000 }
  },

  companies: [
    'América Móvil S.A.B. de C.V.', 'FEMSA S.A.B. de C.V.', 'Grupo Bimbo S.A.B. de C.V.',
    'Cemex S.A.B. de C.V.', 'Grupo México S.A.B.', 'Grupo Elektra S.A.B.',
    'Liverpool S.A.B. de C.V.', 'Kavak México S.A.P.I.', 'Bitso S.A.P.I. de C.V.',
    'Alsea S.A.B. de C.V.', 'Grupo Aeroméxico S.A.B.', 'Banorte S.A.B.'
  ]
};
