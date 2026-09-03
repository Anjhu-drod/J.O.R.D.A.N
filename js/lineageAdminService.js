import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { firestore } from "./firebaseService.js";
import { lineageService } from "./lineageService.js";
import { getLineageMember } from "./lineageConfig.js";

export class LineageAdminService {
  async getMemoryOverview() {
    if (!lineageService.isCreator) return [];
    const bindings = await lineageService.listBindings();
    const result = [];

    for (const binding of bindings) {
      const member = getLineageMember(binding.identityId || binding.id);
      if (!member || !binding.ownerUid) continue;
      try {
        const snap = await getDocs(collection(firestore, "users", binding.ownerUid, "memories"));
        result.push({
          identity: member,
          ownerUid: binding.ownerUid,
          memories: snap.docs.map((item) => ({ id: item.id, ...item.data() }))
        });
      } catch (error) {
        console.warn(`JORDAN Creator Console: ${member.firstName}`, error);
        result.push({ identity: member, ownerUid: binding.ownerUid, memories: [], error: error.message });
      }
    }

    return result.sort((a, b) => a.identity.firstName.localeCompare(b.identity.firstName, "pt-BR"));
  }
}

export const lineageAdminService = new LineageAdminService();
