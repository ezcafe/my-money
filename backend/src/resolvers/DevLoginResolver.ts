/**
 * Dev Login Resolver
 * Handles development login with username and password
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import type {GraphQLContext} from '../middleware/context';
import {UnauthorizedError, ValidationError} from '../utils/errors';
import {generateDevToken} from '../utils/devAuth';

export class DevLoginResolver {
  /**
   * Dev login with username and password
   * Validates credentials against environment variables and returns a JWT token
   */
  async devLogin(
    _: unknown,
    {username, password}: {username: string; password: string},
    context: GraphQLContext,
  ): Promise<string> {
    // Check if dev login is enabled
    const devUsername = process.env.DEV_USERNAME;
    const devPassword = process.env.DEV_PASSWORD;

    if (!devUsername || !devPassword) {
      throw new ValidationError('Dev login is not configured');
    }

    // Validate credentials
    if (username !== devUsername || password !== devPassword) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Create or find user with dev oidcSubject
    const oidcSubject = `dev:${username}`;
    const email = `${username}@dev.local`;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const user = await context.prisma.user.upsert({
      where: {oidcSubject},
      update: {
        // Update email if it has changed
        email,
      },
      create: {
        oidcSubject,
        email,
      },
    });

    // Generate and return JWT token
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return generateDevToken(username, user.email);
  }
}

