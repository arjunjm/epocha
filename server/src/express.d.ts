import type { User } from './types.js';

declare global {
  namespace Express {
    // Merge our User type into Express.User so passport and our middleware agree
    interface User extends import('./types.js').User {}
  }
}
