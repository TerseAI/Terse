import { User } from "../shared/types";

export class UserFormatter {
  static formatForAgent(user: User): string {
    const parts: string[] = [];

    if (user.displayName) {
      parts.push(`Name: ${user.displayName}`);
    }

    if (user.email) {
      parts.push(`Email: ${user.email}`);
    }

    if (user.displayPhotoUrl) {
      parts.push(`Photo: ${user.displayPhotoUrl}`);
    }

    if (user.organizationName) {
      parts.push(`Organization: ${user.organizationName}`);
    }

    if (user.roles) {
      parts.push(`Roles: ${user.roles.join(", ")}`);
    }

    return parts.join("\n") || "User information not available";
  }
}
