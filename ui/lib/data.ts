import { Contrato, TrazaItem } from "./types";

export const DEPARTAMENTOS = ["Amazonas","Antioquia","Arauca","Atlántico","Bogotá D.C.","Bolívar","Boyacá","Caldas","Caquetá","Casanare","Cauca","Cesar","Chocó","Córdoba","Cundinamarca","Guainía","Guaviare","Huila","La Guajira","Magdalena","Meta","Nariño","Norte de Santander","Putumayo","Quindío","Risaralda","San Andrés y Providencia","Santander","Sucre","Tolima","Valle del Cauca","Vaupés","Vichada"];

export const CATEGORIAS = ["Emergencias y desastres","Infraestructura y vías","Salud","Educación","Agua y saneamiento","Tecnología y datos","Ambiente","Bienestar social"] as const;

export const GLIFOS: Record<string, string> = {
  "Todas": "☷",
  "Emergencias y desastres": "▲",
  "Infraestructura y vías": "▤",
  "Salud": "✚",
  "Educación": "◆",
  "Agua y saneamiento": "●",
  "Tecnología y datos": "◫",
  "Ambiente": "◇",
  "Bienestar social": "■",
};

export const EVENTOS = ["Sismo 7,4 · 10 ago 2026","Temporada de lluvias 2026","Incendios forestales 2026","Deslizamiento Rosas 2025","Sin foco (gasto ordinario)"];

export const TRAZA: TrazaItem[] = [
  { fecha: "13 AGO", evento: "Contrato firmado y publicado en SECOP II" },
  { fecha: "13 AGO", evento: "LupIA lo analiza: riesgo 87, tres señales detectadas" },
  { fecha: "15 AGO", evento: "Se publica el acta de inicio" },
  { fecha: "18 AGO", evento: "Adición por $210 M (11,4% del valor inicial)" },
  { fecha: "18 AGO", evento: "LupIA recalcula el score: 87 → 89" },
  { fecha: "20 AGO", evento: "Derecho de petición radicado por 3 usuarios" },
  { fecha: "22 AGO", evento: "La entidad responde: pendiente de revisión" },
];

export const CONTRATOS: Contrato[] = [
  {
      "id": "c1",
      "idContrato": "CO1.PCCNTR.7742911",
      "objeto": "Adquisición de mobiliario de oficina, equipos de cómputo y dotación administrativa para dependencias municipales",
      "entidad": "Alcaldía de Pereira",
      "proveedor": "Suministros del Eje S.A.S.",
      "nit": "901.xxx.xxx-4",
      "dept": "Risaralda",
      "ciudad": "Pereira",
      "lat": 4.79,
      "lon": -75.72,
      "valor": 1840,
      "score": 87,
      "cat": "Bienestar social",
      "evento": "Sismo 7,4 · 10 ago 2026",
      "fecha": "13 ago 2026",
      "modalidad": "Urgencia manifiesta",
      "senales": [
        "Objeto sin relación con la emergencia",
        "Sobrecosto 61% vs. histórico",
        "Contratista debutante"
      ],
      "iaTexto": "El objeto contratado bajo urgencia manifiesta describe dotación administrativa, no atención de la emergencia: no hay mención de albergue, agua, alimentación, salud, vías ni remoción de escombros. El precio unitario declarado por equipo de cómputo queda 61% sobre la mediana histórica del mismo código UNSPSC en el departamento, y el NIT del proveedor no registra contratos previos en SECOP. Los tres elementos, juntos, ameritan revisión.",
      "capas": [
        {
          "capa": "CAPA 1 · ENTENDER",
          "titulo": "Pertinencia con el foco activo",
          "metrica": "12/100",
          "pct": 12,
          "detalle": "Claude clasificó el objeto frente a la declaratoria de emergencia. Ninguna categoría de atención humanitaria aparece en la descripción del proceso."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Precio unitario vs. mediana histórica",
          "metrica": "+61%",
          "pct": 78,
          "detalle": "La IA extrajo del texto libre 120 equipos a $6.9M por unidad. La mediana histórica del UNSPSC 43211508 en Risaralda es $4.3M (p90: $5.6M)."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Historia del proveedor",
          "metrica": "0 contratos",
          "pct": 100,
          "detalle": "Primera aparición del NIT en SECOP. La sociedad se registró en cámara de comercio hace 5 meses."
        }
      ],
      "evidencia": [
        {
          "fuente": "SECOP II",
          "dato": "modalidad_de_contratacion = Contratación directa · justificación: urgencia manifiesta"
        },
        {
          "fuente": "SECOP II",
          "dato": "valor_del_contrato = $1.840.000.000 · fecha_de_firma = 2026-08-13"
        },
        {
          "fuente": "Histórico UNSPSC",
          "dato": "mediana 2023–2026 (Risaralda, 412 contratos) = $4.300.000 por unidad"
        },
        {
          "fuente": "Proveedores",
          "dato": "documento_proveedor sin registros anteriores en contratos electrónicos"
        }
      ]
    },
    {
      "id": "c2",
      "idContrato": "CO1.PCCNTR.7743088",
      "objeto": "Suministro de 40.000 kits de aseo y ayuda humanitaria para población afectada en zona rural",
      "entidad": "Gobernación del Chocó",
      "proveedor": "Logística Húmeda Ltda.",
      "nit": "800.xxx.xxx-1",
      "dept": "Chocó",
      "ciudad": "Quibdó",
      "lat": 5.69,
      "lon": -76.66,
      "valor": 3120,
      "score": 74,
      "cat": "Emergencias y desastres",
      "evento": "Sismo 7,4 · 10 ago 2026",
      "fecha": "12 ago 2026",
      "modalidad": "Urgencia manifiesta",
      "senales": [
        "Sobrecosto 38% vs. histórico",
        "Concentración: 4 entidades en 6 días"
      ],
      "iaTexto": "El objeto es pertinente con la emergencia. La señal está en el precio y en la concentración: el kit sale a $78.000 cuando la mediana histórica comparable es $56.500, y el mismo NIT aparece adjudicado en cuatro entidades distintas en seis días por un total de $9.400 millones.",
      "capas": [
        {
          "capa": "CAPA 1 · ENTENDER",
          "titulo": "Pertinencia con el foco activo",
          "metrica": "94/100",
          "pct": 94,
          "detalle": "Ayuda humanitaria directa a población afectada."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Precio unitario vs. mediana histórica",
          "metrica": "+38%",
          "pct": 58,
          "detalle": "40.000 unidades a $78.000. Mediana histórica: $56.500. El flete fluvial explica parte del diferencial."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Concentración del proveedor",
          "metrica": "4 entidades",
          "pct": 72,
          "detalle": "Mismo NIT adjudicado en Quibdó, Istmina, Condoto y la gobernación entre el 10 y el 16 de agosto."
        }
      ],
      "evidencia": [
        {
          "fuente": "SECOP II",
          "dato": "4 contratos con el mismo documento_proveedor en 6 días"
        },
        {
          "fuente": "Tienda Virtual",
          "dato": "precio de referencia kit de aseo institucional = $56.500"
        }
      ]
    },
    {
      "id": "c3",
      "idContrato": "CO1.PCCNTR.7742640",
      "objeto": "Obras de estabilización de taludes y reapertura de la vía Armenia–Calarcá en tres puntos críticos",
      "entidad": "Alcaldía de Armenia",
      "proveedor": "Constructora Cordillera S.A.",
      "nit": "890.xxx.xxx-7",
      "dept": "Quindío",
      "ciudad": "Armenia",
      "lat": 4.53,
      "lon": -75.68,
      "valor": 5400,
      "score": 41,
      "cat": "Infraestructura y vías",
      "evento": "Sismo 7,4 · 10 ago 2026",
      "fecha": "14 ago 2026",
      "modalidad": "Urgencia manifiesta",
      "senales": [
        "Precio en rango histórico",
        "Publicación tardía: 4 días"
      ],
      "iaTexto": "Objeto plenamente pertinente y precio dentro del rango histórico para obra de estabilización por kilómetro. La única señal es de forma: el contrato se publicó cuatro días después de la firma.",
      "capas": [
        {
          "capa": "CAPA 1 · ENTENDER",
          "titulo": "Pertinencia con el foco activo",
          "metrica": "98/100",
          "pct": 98,
          "detalle": "Restablecimiento de conectividad vial afectada por el sismo."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Precio por kilómetro intervenido",
          "metrica": "−4%",
          "pct": 22,
          "detalle": "3 frentes y 2,8 km. Valor por kilómetro levemente por debajo de la mediana departamental."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Oportunidad de publicación",
          "metrica": "4 días",
          "pct": 45,
          "detalle": "Diferencia entre fecha_de_firma y primera publicación. Señal de forma, no de fondo."
        }
      ],
      "evidencia": [
        {
          "fuente": "SECOP II",
          "dato": "fecha_de_firma = 2026-08-14 · publicación = 2026-08-18"
        },
        {
          "fuente": "Histórico UNSPSC",
          "dato": "23 contratos previos del proveedor en obra de estabilización"
        }
      ]
    },
    {
      "id": "c4",
      "idContrato": "CO1.PCCNTR.7743301",
      "objeto": "Compra de insumos médico-quirúrgicos y medicamentos para atención de lesionados",
      "entidad": "Hospital Departamental de Caldas",
      "proveedor": "MedAndes Distribuciones S.A.S.",
      "nit": "900.xxx.xxx-2",
      "dept": "Caldas",
      "ciudad": "Manizales",
      "lat": 5.04,
      "lon": -75.47,
      "valor": 980,
      "score": 63,
      "cat": "Salud",
      "evento": "Sismo 7,4 · 10 ago 2026",
      "fecha": "11 ago 2026",
      "modalidad": "Urgencia manifiesta",
      "senales": [
        "Fraccionamiento semántico: 3 contratos gemelos",
        "Sin experiencia en el objeto"
      ],
      "iaTexto": "Los embeddings de la descripción encontraron tres contratos casi idénticos de la misma entidad firmados en cuatro días, cada uno por debajo del umbral que obligaría a un proceso competitivo. Sumados llegan a $2.780 millones.",
      "capas": [
        {
          "capa": "CAPA 1 · ENTENDER",
          "titulo": "Pertinencia con el foco activo",
          "metrica": "91/100",
          "pct": 91,
          "detalle": "Atención en salud de lesionados."
        },
        {
          "capa": "CAPA 3 · SEÑALAR",
          "titulo": "Similitud entre contratos",
          "metrica": "0.94 cos",
          "pct": 94,
          "detalle": "Tres descripciones con similitud coseno superior a 0.9, misma entidad, firmadas el 11, 12 y 14 de agosto."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Experiencia en el objeto",
          "metrica": "0 previos",
          "pct": 80,
          "detalle": "7 contratos estatales, ninguno en el UNSPSC de insumos médico-quirúrgicos."
        }
      ],
      "evidencia": [
        {
          "fuente": "SECOP II",
          "dato": "3 contratos, misma entidad, $980M + $910M + $890M en 4 días"
        },
        {
          "fuente": "Embeddings",
          "dato": "similitud coseno 0.94 / 0.91 entre descripciones"
        }
      ]
    },
    {
      "id": "c5",
      "idContrato": "CO1.PCCNTR.7742115",
      "objeto": "Suministro de raciones alimentarias preparadas para albergues temporales en cinco municipios",
      "entidad": "Gobernación del Valle del Cauca",
      "proveedor": "Alimentos del Pacífico S.A.S.",
      "nit": "805.xxx.xxx-9",
      "dept": "Valle del Cauca",
      "ciudad": "Cali",
      "lat": 3.44,
      "lon": -76.52,
      "valor": 2260,
      "score": 22,
      "cat": "Bienestar social",
      "evento": "Sismo 7,4 · 10 ago 2026",
      "fecha": "11 ago 2026",
      "modalidad": "Urgencia manifiesta",
      "senales": [
        "Precio en rango histórico",
        "Proveedor con historial en el objeto"
      ],
      "iaTexto": "Objeto pertinente, precio unitario por ración dentro del rango histórico y proveedor con 31 contratos previos del mismo tipo. No se detectaron señales que ameriten revisión.",
      "capas": [
        {
          "capa": "CAPA 1 · ENTENDER",
          "titulo": "Pertinencia con el foco activo",
          "metrica": "97/100",
          "pct": 97,
          "detalle": "Alimentación en albergues temporales."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Precio por ración",
          "metrica": "+3%",
          "pct": 18,
          "detalle": "180.000 raciones a $12.550. Mediana histórica: $12.180."
        },
        {
          "capa": "CAPA 2 · RAZONAR",
          "titulo": "Historia del proveedor",
          "metrica": "31 previos",
          "pct": 12,
          "detalle": "Historial amplio en el mismo UNSPSC, sin concentración anómala."
        }
      ],
      "evidencia": [
        {
          "fuente": "SECOP II",
          "dato": "valor_del_contrato = $2.260.000.000 · 180.000 raciones"
        },
        {
          "fuente": "Histórico UNSPSC",
          "dato": "mediana por ración (5 dptos, 2024–2026) = $12.180"
        }
      ]
    },
  { id:"c6", idContrato:"CO1.PCCNTR.7742222", objeto:"Reconstrucción de puente vehicular", entidad:"INVÍAS", dept:"Risaralda", ciudad:"Pereira", lat:4.81, lon:-75.7, valor:12500, score:62, cat:"Infraestructura y vías", evento:"Sismo 7,4 · 10 ago 2026", fecha:"14 ago 2026", modalidad:"Contratación directa" },
  { id:"c7", idContrato:"CO1.PCCNTR.7742259", objeto:"Alquiler de maquinaria pesada para remoción", entidad:"Alcaldía de Buenaventura", dept:"Valle del Cauca", ciudad:"Buenaventura", lat:3.88, lon:-77.03, valor:7800, score:91, cat:"Emergencias y desastres", evento:"Temporada de lluvias 2026", fecha:"13 ago 2026", modalidad:"Contratación directa" },
  { id:"c8", idContrato:"CO1.PCCNTR.7742296", objeto:"Dotación escolar en sedes afectadas", entidad:"Secretaría de Educación de Caldas", dept:"Caldas", ciudad:"Manizales", lat:5.07, lon:-75.51, valor:1450, score:24, cat:"Educación", evento:"Sismo 7,4 · 10 ago 2026", fecha:"11 ago 2026", modalidad:"Contratación directa" },
  { id:"c9", idContrato:"CO1.PCCNTR.7742333", objeto:"Interventoría de obras de mitigación", entidad:"Gobernación del Quindío", dept:"Quindío", ciudad:"Armenia", lat:4.56, lon:-75.63, valor:2100, score:47, cat:"Infraestructura y vías", evento:"Sismo 7,4 · 10 ago 2026", fecha:"14 ago 2026", modalidad:"Contratación directa" },
  { id:"c10", idContrato:"CO1.PCCNTR.7742370", objeto:"Acueducto rural veredal", entidad:"Empresas Públicas de Nariño", dept:"Nariño", ciudad:"Pasto", lat:1.21, lon:-77.28, valor:3400, score:58, cat:"Agua y saneamiento", evento:"Temporada de lluvias 2026", fecha:"09 ago 2026", modalidad:"Contratación directa" },
  { id:"c11", idContrato:"CO1.PCCNTR.7742407", objeto:"Plataforma de trazabilidad de subsidios", entidad:"DNP", dept:"Bogotá D.C.", ciudad:"Bogotá", lat:4.71, lon:-74.07, valor:9800, score:44, cat:"Tecnología y datos", evento:"Sin foco (gasto ordinario)", fecha:"10 ago 2026", modalidad:"Contratación directa" },
  { id:"c12", idContrato:"CO1.PCCNTR.7742444", objeto:"Ambulancias medicalizadas", entidad:"Secretaría de Salud de Antioquia", dept:"Antioquia", ciudad:"Medellín", lat:6.24, lon:-75.58, valor:6600, score:71, cat:"Salud", evento:"Sin foco (gasto ordinario)", fecha:"12 ago 2026", modalidad:"Contratación directa" },
  { id:"c13", idContrato:"CO1.PCCNTR.7742481", objeto:"Reforestación de cuenca alta", entidad:"CVC", dept:"Valle del Cauca", ciudad:"Buga", lat:3.9, lon:-76.3, valor:1200, score:33, cat:"Ambiente", evento:"Incendios forestales 2026", fecha:"07 ago 2026", modalidad:"Contratación directa" },
  { id:"c14", idContrato:"CO1.PCCNTR.7742518", objeto:"Placa huella en vía terciaria", entidad:"Alcaldía de Sincelejo", dept:"Sucre", ciudad:"Sincelejo", lat:9.3, lon:-75.4, valor:2900, score:66, cat:"Infraestructura y vías", evento:"Temporada de lluvias 2026", fecha:"08 ago 2026", modalidad:"Contratación directa" },
  { id:"c15", idContrato:"CO1.PCCNTR.7742555", objeto:"Carrotanques de agua potable", entidad:"Gobernación de La Guajira", dept:"La Guajira", ciudad:"Riohacha", lat:11.54, lon:-72.91, valor:5100, score:88, cat:"Agua y saneamiento", evento:"Sin foco (gasto ordinario)", fecha:"12 ago 2026", modalidad:"Contratación directa" },
  { id:"c16", idContrato:"CO1.PCCNTR.7742592", objeto:"Kits de aseo para damnificados", entidad:"Alcaldía de Mocoa", dept:"Putumayo", ciudad:"Mocoa", lat:1.15, lon:-76.65, valor:890, score:54, cat:"Emergencias y desastres", evento:"Temporada de lluvias 2026", fecha:"10 ago 2026", modalidad:"Contratación directa" },
  { id:"c17", idContrato:"CO1.PCCNTR.7742629", objeto:"Reconstrucción de aula múltiple", entidad:"Secretaría de Educación del Cauca", dept:"Cauca", ciudad:"Popayán", lat:2.44, lon:-76.61, valor:1700, score:29, cat:"Educación", evento:"Deslizamiento Rosas 2025", fecha:"06 ago 2026", modalidad:"Contratación directa" },
  { id:"c18", idContrato:"CO1.PCCNTR.7742666", objeto:"Estabilización de talud urbano", entidad:"Alcaldía de Bucaramanga", dept:"Santander", ciudad:"Bucaramanga", lat:7.12, lon:-73.12, valor:4400, score:51, cat:"Infraestructura y vías", evento:"Temporada de lluvias 2026", fecha:"09 ago 2026", modalidad:"Contratación directa" },
  { id:"c19", idContrato:"CO1.PCCNTR.7742703", objeto:"Brigadas de salud en zona rural", entidad:"Secretaría de Salud del Meta", dept:"Meta", ciudad:"Villavicencio", lat:4.14, lon:-73.63, valor:760, score:38, cat:"Salud", evento:"Sin foco (gasto ordinario)", fecha:"11 ago 2026", modalidad:"Contratación directa" },
  { id:"c20", idContrato:"CO1.PCCNTR.7742740", objeto:"Retroexcavadoras para remoción de escombros", entidad:"Alcaldía de Barranquilla", dept:"Atlántico", ciudad:"Barranquilla", lat:10.96, lon:-74.8, valor:3300, score:74, cat:"Emergencias y desastres", evento:"Temporada de lluvias 2026", fecha:"13 ago 2026", modalidad:"Contratación directa" },
  { id:"c21", idContrato:"CO1.PCCNTR.7742777", objeto:"Sensores de monitoreo de ríos", entidad:"IDEAM", dept:"Huila", ciudad:"Neiva", lat:2.93, lon:-75.28, valor:640, score:21, cat:"Tecnología y datos", evento:"Temporada de lluvias 2026", fecha:"05 ago 2026", modalidad:"Contratación directa" },
  { id:"c22", idContrato:"CO1.PCCNTR.7742814", objeto:"Alimentación escolar reforzada", entidad:"Alcaldía de Cartagena", dept:"Bolívar", ciudad:"Cartagena", lat:10.39, lon:-75.51, valor:5600, score:69, cat:"Bienestar social", evento:"Sin foco (gasto ordinario)", fecha:"12 ago 2026", modalidad:"Contratación directa" },
  { id:"c23", idContrato:"CO1.PCCNTR.7742851", objeto:"Combate de incendios forestales", entidad:"Bomberos de Cundinamarca", dept:"Cundinamarca", ciudad:"Girardot", lat:4.3, lon:-74.8, valor:1100, score:43, cat:"Emergencias y desastres", evento:"Incendios forestales 2026", fecha:"07 ago 2026", modalidad:"Contratación directa" },
  { id:"c24", idContrato:"CO1.PCCNTR.7742888", objeto:"Vivienda temporal modular", entidad:"Ministerio de Vivienda", dept:"Chocó", ciudad:"Quibdó", lat:5.5, lon:-76.5, valor:8300, score:77, cat:"Emergencias y desastres", evento:"Sismo 7,4 · 10 ago 2026", fecha:"14 ago 2026", modalidad:"Contratación directa" },
  { id:"c25", idContrato:"CO1.PCCNTR.7742925", objeto:"Planta de tratamiento de agua", entidad:"Aguas de Córdoba", dept:"Córdoba", ciudad:"Montería", lat:8.75, lon:-75.88, valor:4700, score:36, cat:"Agua y saneamiento", evento:"Sin foco (gasto ordinario)", fecha:"08 ago 2026", modalidad:"Contratación directa" },
  { id:"c26", idContrato:"CO1.PCCNTR.7742962", objeto:"Restauración de humedal", entidad:"Corpoamazonia", dept:"Amazonas", ciudad:"Leticia", lat:-4.21, lon:-69.94, valor:520, score:26, cat:"Ambiente", evento:"Sin foco (gasto ordinario)", fecha:"04 ago 2026", modalidad:"Contratación directa" }
] as Contrato[];

export const porId = (id: string) => CONTRATOS.find((c) => c.id === id);
