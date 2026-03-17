import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_prod';

export function signToken(userId: string, role: string) {
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string) {
    try {
        return jwt.verify(token, JWT_SECRET) as { userId: string, role: string };
    } catch (error: any) {
        console.error(`[Auth] Token verification failed:`, error.message);
        return null;
    }
}

export async function hashPassword(password: string) {
    return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
}
