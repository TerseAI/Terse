import jwt from 'jsonwebtoken';
import { db } from '../prismaClient';
import { users } from '@prisma/client';

export class Jwt {
  private readonly TOKEN_EXPIRY = '7d'; // 7 days

  async sign(userId: string) {
    const user = await db().users.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const payload = { 
      userId: user.id
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.TOKEN_EXPIRY
    });
  }

  async verify(token: string): Promise<users | null> {
    try {
      let decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      const user = await db().users.findUnique({ where: { id: decoded.userId } });
      return user || null;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async verifyGitHubApp(token: string): Promise<boolean> {
    try {
      let decoded = jwt.verify(token, process.env.JWT_SECRET!);
      return true;
    } catch (error) {
      return false;
    }
  }
}