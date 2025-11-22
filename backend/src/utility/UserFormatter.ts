import { User } from '../types/prisma';


export class UserFormatter {
    static formatForAgent(user: User): string {
        const parts: string[] = [];
        
        if (user.display_name) {
            parts.push(`Name: ${user.display_name}`);
        }
        
        if (user.email) {
            parts.push(`Email: ${user.email}`);
        }
        
        if (user.github_username) {
            parts.push(`GitHub: ${user.github_username}`);
        }
        
        return parts.join('\n') || 'User information not available';
    }
}

