export const SERVICES = [
  {
    title: "Bomba injetora",
    desc: "Revisão, reparo e calibração de bombas rotativas e em linha.",
  },
  {
    title: "Bicos injetores",
    desc: "Limpeza, teste de vazão e substituição de bicos mecânicos e eletrônicos.",
  },
  {
    title: "Common Rail",
    desc: "Diagnóstico e reparo de bombas de alta pressão e injetores eletrônicos.",
  },
  {
    title: "Teste em bancada",
    desc: "Aferição precisa de débito e pressão antes da entrega.",
  },
  {
    title: "Diagnóstico com scanner",
    desc: "Leitura de falhas e parâmetros da injeção eletrônica diesel.",
  },
  {
    title: "Unidade injetora UI / UP",
    desc: "Manutenção de unidades injetoras de caminhões e máquinas.",
  },
] as const;

export const SERVICE_OPTIONS = [...SERVICES.map((s) => s.title), "Outro / não sei"];
