import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { findOrCreateUser, findUser } from './userStore.js';
import { getSecret } from './secrets.js';
import type { User } from './types.js';

const JWT_EXPIRES = '7d';
const COOKIE_NAME = 'timeline_token';
const IS_PROD = process.env.NODE_ENV === 'production';

// Called after loadSecrets() so getSecret() has the Key Vault values ready
export function configurePassport() {
  passport.use(new GoogleStrategy(
    {
      clientID: getSecret('google-client-id'),
      clientSecret: getSecret('google-client-secret'),
      callbackURL: getSecret('google-callback-url') || 'http://localhost:3001/api/auth/google/callback',
      scope: ['profile', 'email'],
    },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value ?? '';
      const picture = profile.photos?.[0]?.value;
      const user = await findOrCreateUser({
        id: profile.id,
        email,
        name: profile.displayName,
        picture,
      });
      if (!user) {
        return done(null, false, { message: 'User limit reached. No new accounts can be created.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err as Error);
    }
  }
));
}

// Passport session serialisation (not used — we use JWT — but passport requires it)
passport.serializeUser((user, done) => done(null, (user as User).id));
passport.deserializeUser(async (id: string, done) => {
  const user = await findUser(id);
  done(null, user);
});

// ── JWT helpers ────────────────────────────────────────────────────────────

export function signToken(user: User): string {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, picture: user.picture },
    getSecret('jwt-secret') || 'dev-secret-change-in-production',
    { expiresIn: JWT_EXPIRES }
  );
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

// ── Auth middleware ────────────────────────────────────────────────────────

export interface AuthRequest extends Request {
  user?: User;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  try {
    const payload = jwt.verify(token, getSecret('jwt-secret') || 'dev-secret-change-in-production') as { sub: string; email: string; name: string; picture?: string };
    req.user = { id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture } as User;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Attach user to request if a valid token is present — does not block unauthenticated requests. */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (token) {
    try {
      const payload = jwt.verify(token, getSecret('jwt-secret') || 'dev-secret-change-in-production') as { sub: string; email: string; name: string; picture?: string };
      req.user = { id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture } as User;
    } catch {
      // ignore invalid token
    }
  }
  next();
}

export { passport, COOKIE_NAME };
