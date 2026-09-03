export const FAMILY_GATE = Object.freeze({
  // UX gate only. Real account security is Firebase Authentication + Firestore Rules.
  pinHashSha256: "e5e53c784d5d49de1cabb6e904bf3380026aadcb9769775a268dd304dd9aa2df",
  version: 1
});

export const LINEAGE_MEMBERS = Object.freeze({
  alef: {
    id: "alef",
    firstName: "Alef",
    confirmationName: "Macedo",
    birthday: { month: 3, day: 14 },
    role: "member"
  },
  jhuan: {
    id: "jhuan",
    firstName: "Jhuan",
    confirmationName: "Alexandre",
    birthday: { month: 6, day: 20 },
    role: "creator",
    creator: true,
    spokenName: "Ruan"
  },
  kauan: {
    id: "kauan",
    firstName: "Kauan",
    confirmationName: "Kewen",
    birthday: { month: 8, day: 19 },
    role: "member"
  },
  poliana: {
    id: "poliana",
    firstName: "Poliana",
    confirmationName: "Santana",
    birthday: { month: 5, day: 27 },
    role: "member"
  },
  laerte: {
    id: "laerte",
    firstName: "Laerte",
    confirmationName: "Geraldo",
    birthday: { month: 8, day: 20 },
    role: "member"
  }
});

export const LINEAGE_RELATIONSHIPS = Object.freeze({
  jhuan: {
    mother: ["poliana"],
    father: ["laerte"],
    siblings: ["kauan", "alef"]
  },
  kauan: {
    mother: ["poliana"],
    father: ["laerte"],
    siblings: ["jhuan", "alef"]
  },
  alef: {
    mother: ["poliana"],
    father: [],
    siblings: ["jhuan", "kauan"]
  },
  poliana: {
    children: ["jhuan", "kauan", "alef"]
  },
  laerte: {
    children: ["jhuan", "kauan"]
  }
});

export const LINEAGE_PRIVACY_NOTICE =
  "A JORDAN é privada para esta linhagem. Cada identidade tem dados separados. O criador Jhuan possui função administrativa para manutenção e recuperação do sistema; essa condição é exibida no cadastro.";

export function getLineageMember(id) {
  return LINEAGE_MEMBERS[String(id || "").toLowerCase()] || null;
}

export function listLineageMembers() {
  return Object.values(LINEAGE_MEMBERS);
}

export function getSystemBirthdays() {
  return listLineageMembers().map((member) => ({
    identityId: member.id,
    name: member.firstName,
    month: member.birthday.month,
    day: member.birthday.day,
    title: `Aniversário de ${member.firstName}`
  }));
}
