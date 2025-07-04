import jwt from 'jsonwebtoken';

export class Jwt {
  async sign(username: string) {
    return jwt.sign({ username }, process.env.JWT_SECRET!);
  }
}