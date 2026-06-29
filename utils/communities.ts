export type CommunityDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
};

export const communities: CommunityDefinition[] = [
  {
    id: "sanayi-dostlari",
    name: "Sanayi Dostları",
    description: "Kronik sorunlar, usta tavsiyeleri, parça fiyatları...",
    icon: "wrench",
    iconBg: "rgba(96, 165, 250, 0.2)",
    iconColor: "#60a5fa",
  },
  {
    id: "az-yakanlar",
    name: "Az Yakanlar Kulübü",
    description: "Yakıt tasarrufu taktikleri, LPG uyumu, hibritler...",
    icon: "leaf",
    iconBg: "rgba(74, 222, 128, 0.2)",
    iconColor: "#4ade80",
  },
  {
    id: "modifikasyon-detailing",
    name: "Modifiye, Konsept & Aksesuar",
    description: "Jant, body kit, iç mekan, aksesuar ve konsept fikirleri.",
    icon: "spray-can-sparkles",
    iconBg: "rgba(192, 132, 252, 0.2)",
    iconColor: "#c084fc",
  },
  {
    id: "arac-onerileri",
    name: "Araç Önerileri",
    description: "Bütçeye, kullanıma ve ihtiyaca göre araç tavsiyeleri.",
    icon: "clipboard-check",
    iconBg: "rgba(45, 212, 191, 0.2)",
    iconColor: "#2dd4bf",
  },
  {
    id: "oto-muhabbet",
    name: "Oto Muhabbet",
    description: "Gündem, sohbet, soru-cevap ve otomobil kültürü.",
    icon: "comments",
    iconBg: "rgba(250, 204, 21, 0.2)",
    iconColor: "#facc15",
  },
  {
    id: "bakim-onarim",
    name: "Bakım & Onarım",
    description: "Periyodik bakım, arıza çözümü, servis ve parça deneyimleri.",
    icon: "screwdriver-wrench",
    iconBg: "rgba(248, 113, 113, 0.2)",
    iconColor: "#f87171",
  },
  {
    id: "kamp-karavan",
    name: "Kamp & Karavan",
    description: "4x4 modifikasyonları, rota tavsiyeleri, çadırlar...",
    icon: "campground",
    iconBg: "rgba(251, 146, 60, 0.2)",
    iconColor: "#fb923c",
  },
];

export const getCommunityById = (id?: string | null) =>
  communities.find((community) => community.id === id);

export const getCommunityName = (id?: string | null) => {
  const community = getCommunityById(id);
  if (community) return community.name;

  return (id || "Topluluk")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
