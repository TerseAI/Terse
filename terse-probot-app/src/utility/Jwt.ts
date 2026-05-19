import jwt from "jsonwebtoken"

export class Jwt {
    async sign(username: string) {
        const secret = process.env.JWT_SECRET
        if (!secret) {
            throw new Error("JWT_SECRET is not configured")
        }
        // Short-lived, algorithm-pinned token. The backend verifies the bearer
        // on every /github/unified-event call (see backend/src/routes/github.ts);
        // without expiresIn the token was valid indefinitely, so any one of
        // them captured in logs became a permanent impersonation credential.
        return jwt.sign({ username }, secret, {
            algorithm: "HS256",
            expiresIn: "5m"
        })
    }
}
