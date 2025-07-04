import jwt from 'jsonwebtoken';
import { db } from '../prismaClient.js';
export class Jwt {
    async sign(userId) {
        const user = await db().users.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        return jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    }
    async verify(token) {
        try {
            let decoded = jwt.verify(token, process.env.JWT_SECRET);
            const decodedUser = decoded;
            const user = await db().users.findUnique({ where: { id: decodedUser.userId } });
            return user || null;
        }
        catch (error) {
            throw new Error('Invalid token');
        }
    }
    async verifyGitHubApp(token) {
        try {
            let decoded = jwt.verify(token, process.env.JWT_SECRET);
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
//# sourceMappingURL=jwt.js.map